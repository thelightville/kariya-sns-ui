import { Buffer } from "node:buffer";

import {
  TRANSACTION_TOMBSTONE_SECONDS,
  assertTransactionCas,
  validateTransactionRecord,
} from "../../src/server/auth/transactionCustody.mjs";

export function fixed32(byte) {
  return Buffer.alloc(32, byte).toString("base64url");
}

export function createSyntheticKeyProvider() {
  const fixtureKey = Buffer.alloc(32, 0xa5);
  return Object.freeze({
    async currentKeyReference() {
      return { key_id: "synthetic-test-only", key_version: "v1" };
    },
    async wrapKey(dataKey) {
      return Buffer.from(dataKey).map((value, index) => value ^ fixtureKey[index]);
    },
    async unwrapKey(wrapped) {
      return Buffer.from(wrapped).map((value, index) => value ^ fixtureKey[index]);
    },
  });
}

function terminal(current, expectedVersion, state, fields) {
  const next = {
    ...current,
    envelope: null,
    state,
    state_version: expectedVersion + 1,
    reservation_id_digest: null,
    reservation_expires_at: null,
    terminal_at: fields.terminal_at,
    terminal_reason: fields.terminal_reason,
    purge_after: fields.purge_after,
    updated_at: fields.terminal_at,
  };
  return assertTransactionCas(current, next, expectedVersion);
}

export function createSyntheticTransactionStore() {
  const byId = new Map();
  const byState = new Map();
  let signingAttempts = 0;

  return Object.freeze({
    records: byId,
    get signingAttempts() {
      return signingAttempts;
    },
    async create(record) {
      const value = validateTransactionRecord(record);
      if (byState.has(value.state_digest)) throw new Error("state_conflict");
      byId.set(value.id, value);
      byState.set(value.state_digest, value.id);
      return value;
    },
    async markRegistered(id, expectedVersion, registration) {
      const current = byId.get(id);
      const next = assertTransactionCas(
        current,
        {
          ...current,
          ...registration,
          state: "registered",
          state_version: expectedVersion + 1,
        },
        expectedVersion
      );
      byId.set(id, next);
      return next;
    },
    async reserveCallback(stateDigest, reservation) {
      const id = byState.get(stateDigest);
      let current = byId.get(id);
      if (
        current?.state === "callback_reserved" &&
        current.reservation_expires_at <= reservation.now &&
        reservation.now < current.cloud_expires_at
      ) {
        current = assertTransactionCas(
          current,
          {
            ...current,
            state: "registered",
            state_version: current.state_version + 1,
            reservation_id_digest: null,
            reservation_expires_at: null,
            updated_at: reservation.now,
          },
          current.state_version
        );
        byId.set(id, current);
      }
      if (
        !current ||
        current.state !== "registered" ||
        current.region !== reservation.region ||
        reservation.now >= current.cloud_expires_at
      ) {
        throw new Error("authorization_failed");
      }
      const next = assertTransactionCas(
        current,
        {
          ...current,
          state: "callback_reserved",
          state_version: current.state_version + 1,
          reservation_id_digest: reservation.reservation_id_digest,
          reservation_expires_at: Math.min(
            reservation.reservation_expires_at,
            current.cloud_expires_at
          ),
          updated_at: reservation.now,
        },
        current.state_version
      );
      byId.set(id, next);
      return next;
    },
    async releaseReservation() {
      throw new Error("not_used_by_test_oracle");
    },
    async markRedeemSent(id, expectedVersion, reservationDigest, update) {
      const current = byId.get(id);
      if (current.reservation_id_digest !== reservationDigest) {
        throw new Error("reservation_conflict");
      }
      signingAttempts += 1;
      const next = assertTransactionCas(
        current,
        {
          ...current,
          envelope: null,
          state: "redeem_sent",
          state_version: expectedVersion + 1,
          reservation_id_digest: null,
          reservation_expires_at: null,
          updated_at: update.updated_at,
        },
        expectedVersion
      );
      byId.set(id, next);
      return next;
    },
    async complete(id, expectedVersion, fields) {
      const next = terminal(
        byId.get(id),
        expectedVersion,
        "completed",
        fields
      );
      byId.set(id, next);
      return next;
    },
    async failTerminal(id, expectedVersion, fields) {
      const next = terminal(
        byId.get(id),
        expectedVersion,
        "terminal_failed",
        fields
      );
      byId.set(id, next);
      return next;
    },
    async expire(id, expectedVersion, fields) {
      const next = terminal(byId.get(id), expectedVersion, "expired", fields);
      byId.set(id, next);
      return next;
    },
    async purgeTerminal(now) {
      let count = 0;
      for (const [id, record] of byId) {
        if (record.purge_after !== null && now >= record.purge_after) {
          byId.delete(id);
          byState.delete(record.state_digest);
          count += 1;
        }
      }
      return count;
    },
  });
}

export function syntheticTerminal(now, reason) {
  return {
    terminal_at: now,
    terminal_reason: reason,
    purge_after: now + TRANSACTION_TOMBSTONE_SECONDS,
  };
}
