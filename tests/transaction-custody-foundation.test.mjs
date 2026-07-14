import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import {
  TRANSACTION_AAD_PROFILE,
  TRANSACTION_ENVELOPE_PROFILE,
  TRANSACTION_SCHEMA_VERSION,
  TRANSACTION_TOMBSTONE_SECONDS,
  assertTransactionCas,
  canonicalTransactionAad,
  safeTransactionReturnPath,
  transactionCleanupEligible,
  validateTransactionEnvelope,
  validateTransactionRecord,
} from "../src/server/auth/transactionCustody.mjs";
import {
  FOUNDATION_UNAVAILABLE_CODE,
  unavailableKeyEncryptionProvider,
  unavailableTransactionCipher,
  unavailableTransactionStore,
} from "../src/server/auth/ports.mjs";

const START = 2_000_000_000;
const ID = "11111111-1111-4111-8111-111111111111";

function b64(byte, length) {
  return Buffer.alloc(length, byte).toString("base64url");
}

const DIGESTS = Object.freeze({
  state: b64(1, 32),
  request: b64(2, 32),
  reservation: b64(3, 32),
  aad: b64(4, 32),
});

function envelope() {
  return {
    crypto_profile: TRANSACTION_ENVELOPE_PROFILE,
    kek_key_id: "synthetic-test-key-reference",
    kek_key_version: "v1",
    wrapped_dek_b64url: b64(5, 48),
    iv_b64url: b64(6, 12),
    tag_b64url: b64(7, 16),
    ciphertext_b64url: b64(8, 64),
    aad_sha256: DIGESTS.aad,
  };
}

function record(state = "created", version = 1) {
  const registered = state !== "created";
  const custodial = ["created", "registered", "callback_reserved"].includes(state);
  const reserved = state === "callback_reserved";
  const terminal = ["completed", "terminal_failed", "expired"].includes(state);
  return {
    schema_version: TRANSACTION_SCHEMA_VERSION,
    id: ID,
    region: "ng",
    state_digest: DIGESTS.state,
    cloud_request_id_digest: registered ? DIGESTS.request : null,
    normalized_return_path: "/workflow",
    envelope: custodial ? envelope() : null,
    state,
    state_version: version,
    cloud_issued_at: registered ? START : null,
    cloud_expires_at: registered ? START + 300 : null,
    reservation_id_digest: reserved ? DIGESTS.reservation : null,
    reservation_expires_at: reserved ? START + 30 : null,
    terminal_at: terminal ? START + 40 : null,
    terminal_reason: terminal ? "synthetic_terminal" : null,
    purge_after: terminal ? START + 40 + TRANSACTION_TOMBSTONE_SECONDS : null,
    created_at: START - 1,
    updated_at: START + version,
  };
}

test("synthetic-only evidence validates exact transaction and envelope shapes", () => {
  const created = validateTransactionRecord(record());
  assert.equal(created.state, "created");
  assert.deepEqual(
    Object.keys(validateTransactionEnvelope(envelope())).sort(),
    Object.keys(envelope()).sort()
  );

  assert.throws(
    () => validateTransactionEnvelope({ ...envelope(), extra: true }),
    /exactly/
  );
  assert.throws(
    () =>
      validateTransactionEnvelope({
        ...envelope(),
        crypto_profile: "live-capability",
      }),
    /unsupported/
  );
  assert.throws(
    () => validateTransactionEnvelope({ ...envelope(), iv_b64url: b64(1, 13) }),
    /byte boundary/
  );
});

test("canonical AAD is deterministic and region-bound without encrypting", () => {
  const ng = record();
  assert.equal(
    canonicalTransactionAad(ng),
    JSON.stringify([
      TRANSACTION_AAD_PROFILE,
      ID,
      "ng",
      DIGESTS.state,
      "https://sns.kariya.ng",
      "https://sns.kariya.ng/api/auth/exchange/callback",
      START - 1,
    ])
  );
  const ca = { ...ng, region: "ca" };
  assert.notEqual(canonicalTransactionAad(ca), canonicalTransactionAad(ng));
});

test("same-origin return paths reject authority and ambiguous encodings", () => {
  for (const accepted of ["/workflow", "/actions?view=pending", "/evidence/%C3%A9"]) {
    assert.equal(safeTransactionReturnPath(accepted), true, accepted);
  }
  for (const rejected of [
    "https://evil.invalid/workflow",
    "//evil.invalid",
    "/a\\b",
    "/a/../b",
    "/%2Fadmin",
    "/%252Fadmin",
    "/%41",
    "/%2fadmin",
    "/workflow#fragment",
    "/bad path",
    "/%ZZ",
  ]) {
    assert.equal(safeTransactionReturnPath(rejected), false, rejected);
  }
});

test("Cloud registration lifetime is exactly 300 seconds", () => {
  const valid = record("registered", 2);
  assert.equal(validateTransactionRecord(valid).cloud_expires_at, START + 300);
  assert.throws(
    () => validateTransactionRecord({ ...valid, cloud_expires_at: START + 299 }),
    /300-second/
  );
  assert.throws(
    () => validateTransactionRecord({ ...valid, cloud_expires_at: START + 301 }),
    /300-second/
  );
});

test("CAS preserves identity, version and at-most-once redeem ambiguity", () => {
  const registered = record("registered", 2);
  const reserved = record("callback_reserved", 3);
  assert.equal(assertTransactionCas(registered, reserved, 2).state, "callback_reserved");

  const released = record("registered", 4);
  assert.equal(assertTransactionCas(reserved, released, 3).state, "registered");

  const reservedAgain = record("callback_reserved", 5);
  assert.equal(assertTransactionCas(released, reservedAgain, 4).state, "callback_reserved");

  const redeemSent = record("redeem_sent", 6);
  assert.equal(assertTransactionCas(reservedAgain, redeemSent, 5).envelope, null);

  const ambiguous = record("terminal_failed", 7);
  assert.equal(assertTransactionCas(redeemSent, ambiguous, 6).state, "terminal_failed");
  assert.throws(
    () => assertTransactionCas(redeemSent, record("registered", 7), 6),
    /illegal/
  );
  assert.throws(
    () => assertTransactionCas(registered, { ...reserved, state_version: 4 }, 2),
    /version/
  );
  assert.throws(
    () =>
      assertTransactionCas(
        registered,
        { ...reserved, normalized_return_path: "/actions" },
        2
      ),
    /identity/
  );
  assert.throws(
    () =>
      assertTransactionCas(
        registered,
        { ...reserved, cloud_expires_at: START + 301 },
        2
      ),
    /300-second|identity/
  );
  assert.throws(
    () =>
      assertTransactionCas(
        registered,
        {
          ...reserved,
          envelope: { ...reserved.envelope, kek_key_version: "v2" },
        },
        2
      ),
    /identity/
  );
});

test("reservation cannot outlive Cloud expiry and secrets clear before redeem", () => {
  const reserved = record("callback_reserved", 3);
  assert.throws(
    () =>
      validateTransactionRecord({
        ...reserved,
        reservation_expires_at: START + 301,
      }),
    /outlive/
  );
  assert.throws(
    () => validateTransactionRecord({ ...record("redeem_sent", 4), envelope: envelope() }),
    /cleared/
  );
});

test("terminal records enforce exact 24-hour replay tombstones", () => {
  const terminal = record("terminal_failed", 7);
  assert.equal(transactionCleanupEligible(terminal, terminal.purge_after - 1), false);
  assert.equal(transactionCleanupEligible(terminal, terminal.purge_after), true);
  assert.throws(
    () => validateTransactionRecord({ ...terminal, purge_after: terminal.purge_after - 1 }),
    /24 hours/
  );
});

test("PostgreSQL, cipher and KMS ports have only generic unavailable behavior", async () => {
  const adapters = [
    unavailableTransactionStore(),
    unavailableTransactionCipher(),
    unavailableKeyEncryptionProvider(),
  ];
  for (const adapter of adapters) {
    for (const operation of Object.values(adapter)) {
      await assert.rejects(operation(), (error) => {
        assert.equal(error.code, FOUNDATION_UNAVAILABLE_CODE);
        assert.doesNotMatch(error.message, /nonce|verifier|credential|secret value/iu);
        return true;
      });
    }
  }
});
