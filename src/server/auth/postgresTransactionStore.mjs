import {
  assertTransactionCas,
  validateTransactionRecord,
} from "./transactionCustody.mjs";

function fail(message) {
  throw new Error(message);
}

function rowRecord(row) {
  if (!row) fail("transaction_not_found");
  return validateTransactionRecord({
    schema_version: row.schema_version,
    id: row.id,
    region: row.region,
    state_digest: row.state_digest,
    cloud_request_id_digest: row.cloud_request_id_digest,
    normalized_return_path: row.normalized_return_path,
    envelope: row.envelope,
    state: row.state,
    state_version: Number(row.state_version),
    cloud_issued_at: row.cloud_issued_at === null ? null : Number(row.cloud_issued_at),
    cloud_expires_at: row.cloud_expires_at === null ? null : Number(row.cloud_expires_at),
    reservation_id_digest: row.reservation_id_digest,
    reservation_expires_at:
      row.reservation_expires_at === null ? null : Number(row.reservation_expires_at),
    terminal_at: row.terminal_at === null ? null : Number(row.terminal_at),
    terminal_reason: row.terminal_reason,
    purge_after: row.purge_after === null ? null : Number(row.purge_after),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  });
}

async function withTransaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

const RETURNING = " RETURNING *";

export function createPostgresTransactionStore(pool) {
  if (!pool || typeof pool.connect !== "function") {
    throw new TypeError("PostgreSQL pool boundary is required");
  }

  async function terminal(id, expectedVersion, nextState, fields) {
    return withTransaction(pool, async (client) => {
      const locked = rowRecord(
        (
          await client.query(
            "SELECT * FROM ksns_auth_transactions WHERE id = $1 FOR UPDATE",
            [id]
          )
        ).rows[0]
      );
      const next = {
        ...locked,
        envelope: null,
        state: nextState,
        state_version: expectedVersion + 1,
        reservation_id_digest: null,
        reservation_expires_at: null,
        terminal_at: fields.terminal_at,
        terminal_reason: fields.terminal_reason,
        purge_after: fields.purge_after,
        updated_at: fields.terminal_at,
      };
      assertTransactionCas(locked, next, expectedVersion);
      const result = await client.query(
        `UPDATE ksns_auth_transactions
         SET envelope = NULL, state = $3, state_version = state_version + 1,
             reservation_id_digest = NULL, reservation_expires_at = NULL,
             terminal_at = $4, terminal_reason = $5, purge_after = $6, updated_at = $4
         WHERE id = $1 AND state_version = $2${RETURNING}`,
        [
          id,
          expectedVersion,
          nextState,
          fields.terminal_at,
          fields.terminal_reason,
          fields.purge_after,
        ]
      );
      if (result.rowCount !== 1) fail("transaction_cas_conflict");
      return rowRecord(result.rows[0]);
    });
  }

  return Object.freeze({
    async create(record) {
      const value = validateTransactionRecord(record);
      const columns = [
        "schema_version", "id", "region", "state_digest",
        "cloud_request_id_digest", "normalized_return_path", "envelope", "state",
        "state_version", "cloud_issued_at", "cloud_expires_at",
        "reservation_id_digest", "reservation_expires_at", "terminal_at",
        "terminal_reason", "purge_after", "created_at", "updated_at",
      ];
      const values = columns.map((key) => value[key]);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
      const result = await withTransaction(pool, (client) =>
        client.query(
          `INSERT INTO ksns_auth_transactions (${columns.join(", ")})
           VALUES (${placeholders})${RETURNING}`,
          values
        )
      );
      return rowRecord(result.rows[0]);
    },

    async markRegistered(id, expectedVersion, registration) {
      const result = await withTransaction(pool, (client) =>
        client.query(
          `UPDATE ksns_auth_transactions
           SET cloud_request_id_digest = $3, cloud_issued_at = $4,
               cloud_expires_at = $5, state = 'registered',
               state_version = state_version + 1, updated_at = $6
           WHERE id = $1 AND state = 'created' AND state_version = $2${RETURNING}`,
          [
            id,
            expectedVersion,
            registration.cloud_request_id_digest,
            registration.cloud_issued_at,
            registration.cloud_expires_at,
            registration.updated_at,
          ]
        )
      );
      if (result.rowCount !== 1) fail("transaction_cas_conflict");
      return rowRecord(result.rows[0]);
    },

    async reserveCallback(stateDigest, reservation) {
      return withTransaction(pool, async (client) => {
        const current = rowRecord(
          (
            await client.query(
              "SELECT * FROM ksns_auth_transactions WHERE state_digest = $1 FOR UPDATE",
              [stateDigest]
            )
          ).rows[0]
        );
        if (
          current.region !== reservation.region ||
          current.state !== "registered" ||
          reservation.now >= current.cloud_expires_at
        ) {
          fail("authorization_failed");
        }
        const expiry = Math.min(
          reservation.reservation_expires_at,
          current.cloud_expires_at
        );
        const result = await client.query(
          `UPDATE ksns_auth_transactions
           SET state = 'callback_reserved', state_version = state_version + 1,
               reservation_id_digest = $2, reservation_expires_at = $3,
               updated_at = $4
           WHERE id = $1 AND state = 'registered' AND state_version = $5${RETURNING}`,
          [
            current.id,
            reservation.reservation_id_digest,
            expiry,
            reservation.now,
            current.state_version,
          ]
        );
        if (result.rowCount !== 1) fail("transaction_cas_conflict");
        return rowRecord(result.rows[0]);
      });
    },

    async releaseReservation(id, expectedVersion, reservationDigest, update) {
      const result = await withTransaction(pool, (client) =>
        client.query(
          `UPDATE ksns_auth_transactions
           SET state = 'registered', state_version = state_version + 1,
               reservation_id_digest = NULL, reservation_expires_at = NULL,
               updated_at = $4
           WHERE id = $1 AND state = 'callback_reserved'
             AND state_version = $2 AND reservation_id_digest = $3${RETURNING}`,
          [id, expectedVersion, reservationDigest, update.updated_at]
        )
      );
      if (result.rowCount !== 1) fail("transaction_cas_conflict");
      return rowRecord(result.rows[0]);
    },

    async markRedeemSent(id, expectedVersion, reservationDigest, update) {
      const result = await withTransaction(pool, (client) =>
        client.query(
          `UPDATE ksns_auth_transactions
           SET state = 'redeem_sent', state_version = state_version + 1,
               envelope = NULL, reservation_id_digest = NULL,
               reservation_expires_at = NULL, updated_at = $4
           WHERE id = $1 AND state = 'callback_reserved'
             AND state_version = $2 AND reservation_id_digest = $3${RETURNING}`,
          [id, expectedVersion, reservationDigest, update.updated_at]
        )
      );
      if (result.rowCount !== 1) fail("transaction_cas_conflict");
      return rowRecord(result.rows[0]);
    },

    complete(id, expectedVersion, fields) {
      return terminal(id, expectedVersion, "completed", fields);
    },

    failTerminal(id, expectedVersion, fields) {
      return terminal(id, expectedVersion, "terminal_failed", fields);
    },

    expire(id, expectedVersion, fields) {
      return terminal(id, expectedVersion, "expired", fields);
    },

    async purgeTerminal(now) {
      const result = await withTransaction(pool, (client) =>
        client.query(
          `DELETE FROM ksns_auth_transactions
           WHERE state IN ('completed', 'terminal_failed', 'expired')
             AND purge_after <= $1`,
          [now]
        )
      );
      return result.rowCount;
    },
  });
}
