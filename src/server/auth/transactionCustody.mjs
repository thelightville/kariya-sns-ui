import { Buffer } from "node:buffer";

import {
  CONSUMER_TRANSACTION_TRANSITIONS,
  PREAUTHORIZATION_TTL_SECONDS,
  assertConsumerTransactionTransition,
  canonical32,
  regionalTuple,
} from "./cloudExchangeFoundation.mjs";

export const TRANSACTION_SCHEMA_VERSION = "ksns.auth-transaction.v1";
export const TRANSACTION_ENVELOPE_PROFILE =
  "ksns.transaction-envelope.aes-256-gcm.v1";
export const TRANSACTION_AAD_PROFILE =
  "ksns.auth-transaction-envelope.aad.v1";
export const TRANSACTION_TOMBSTONE_SECONDS = 86_400;

export const TRANSACTION_RECORD_KEYS = Object.freeze([
  "schema_version",
  "id",
  "region",
  "state_digest",
  "cloud_request_id_digest",
  "normalized_return_path",
  "envelope",
  "state",
  "state_version",
  "cloud_issued_at",
  "cloud_expires_at",
  "reservation_id_digest",
  "reservation_expires_at",
  "terminal_at",
  "terminal_reason",
  "purge_after",
  "created_at",
  "updated_at",
]);

export const TRANSACTION_ENVELOPE_KEYS = Object.freeze([
  "crypto_profile",
  "kek_key_id",
  "kek_key_version",
  "wrapped_dek_b64url",
  "iv_b64url",
  "tag_b64url",
  "ciphertext_b64url",
  "aad_sha256",
]);

const CUSTODIAL_STATES = new Set(["created", "registered", "callback_reserved"]);
const TERMINAL_STATES = new Set(["completed", "terminal_failed", "expired"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PERCENT_ESCAPE = /%[0-9A-F]{2}/gu;
const UNRESERVED_BYTE = /^[A-Za-z0-9._~-]$/u;

function fail(message) {
  throw new TypeError(message);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys, label) {
  if (!isPlainObject(value)) fail(`${label} must be a plain object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(`${label} must contain exactly: ${expected.join(", ")}`);
  }
}

function safeInteger(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(`${label} must be a positive safe integer`);
  }
  return value;
}

function boundedString(value, label, maximum) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximum ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    fail(`${label} must be a bounded canonical string`);
  }
  return value;
}

function canonicalBase64url(value, label, { exactBytes, maximumBytes } = {}) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    !/^[A-Za-z0-9_-]+$/u.test(value)
  ) {
    fail(`${label} must be canonical unpadded base64url`);
  }
  const decoded = Buffer.from(value, "base64url");
  if (
    decoded.toString("base64url") !== value ||
    (exactBytes !== undefined && decoded.length !== exactBytes) ||
    (maximumBytes !== undefined && decoded.length > maximumBytes)
  ) {
    fail(`${label} violates its canonical byte boundary`);
  }
  return value;
}

function nullableCanonical32(value, label) {
  if (value === null) return null;
  return canonical32(value, label);
}

export function safeTransactionReturnPath(value) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 512 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("#") ||
    /[\u0000-\u001f\u007f\s]/u.test(value)
  ) {
    return false;
  }

  let parsed;
  try {
    parsed = new URL(value, "https://sns.kariya.invalid");
  } catch {
    return false;
  }
  if (
    parsed.origin !== "https://sns.kariya.invalid" ||
    parsed.username ||
    parsed.password ||
    `${parsed.pathname}${parsed.search}` !== value
  ) {
    return false;
  }

  const percentIndexes = [...value.matchAll(/%/gu)].map((match) => match.index);
  const escapes = [...value.matchAll(PERCENT_ESCAPE)];
  if (percentIndexes.length !== escapes.length) return false;
  for (const match of escapes) {
    const byte = Number.parseInt(match[0].slice(1), 16);
    const character = String.fromCharCode(byte);
    if (
      match[0] !== match[0].toUpperCase() ||
      UNRESERVED_BYTE.test(character) ||
      [0x2f, 0x5c, 0x25, 0x3f, 0x23].includes(byte) ||
      byte < 0x20 ||
      byte === 0x7f
    ) {
      return false;
    }
  }

  const path = value.split("?", 1)[0];
  return !path.split("/").some((segment) => segment === "." || segment === "..");
}

export function validateTransactionEnvelope(envelope) {
  exactKeys(envelope, TRANSACTION_ENVELOPE_KEYS, "transaction envelope");
  if (envelope.crypto_profile !== TRANSACTION_ENVELOPE_PROFILE) {
    fail("unsupported transaction envelope profile");
  }
  boundedString(envelope.kek_key_id, "kek_key_id", 255);
  boundedString(envelope.kek_key_version, "kek_key_version", 128);
  canonicalBase64url(envelope.wrapped_dek_b64url, "wrapped_dek", {
    maximumBytes: 1_024,
  });
  canonicalBase64url(envelope.iv_b64url, "iv", { exactBytes: 12 });
  canonicalBase64url(envelope.tag_b64url, "tag", { exactBytes: 16 });
  canonicalBase64url(envelope.ciphertext_b64url, "ciphertext", {
    maximumBytes: 4_096,
  });
  canonical32(envelope.aad_sha256, "aad_sha256");
  return Object.freeze({ ...envelope });
}

export function canonicalTransactionAad(record) {
  if (!isPlainObject(record)) fail("transaction AAD source must be an object");
  if (!UUID.test(record.id)) fail("transaction id must be a canonical UUID");
  const tuple = regionalTuple(record.region);
  canonical32(record.state_digest, "state_digest");
  safeInteger(record.created_at, "created_at");
  return JSON.stringify([
    TRANSACTION_AAD_PROFILE,
    record.id,
    record.region,
    record.state_digest,
    tuple.audience,
    tuple.redirect_uri,
    record.created_at,
  ]);
}

export function validateTransactionRecord(record) {
  exactKeys(record, TRANSACTION_RECORD_KEYS, "transaction record");
  if (record.schema_version !== TRANSACTION_SCHEMA_VERSION) {
    fail("unsupported transaction schema version");
  }
  if (!UUID.test(record.id)) fail("transaction id must be a canonical UUID");
  regionalTuple(record.region);
  canonical32(record.state_digest, "state_digest");
  nullableCanonical32(record.cloud_request_id_digest, "cloud_request_id_digest");
  if (!safeTransactionReturnPath(record.normalized_return_path)) {
    fail("normalized_return_path violates the same-origin profile");
  }
  if (!(record.state in CONSUMER_TRANSACTION_TRANSITIONS)) {
    fail("unknown transaction state");
  }
  safeInteger(record.state_version, "state_version");
  safeInteger(record.created_at, "created_at");
  safeInteger(record.updated_at, "updated_at");

  if (CUSTODIAL_STATES.has(record.state)) {
    validateTransactionEnvelope(record.envelope);
  } else if (record.envelope !== null) {
    fail("secrets must be cleared before redeem_sent or terminal state");
  }

  const cloudAuthorityAbsent =
    record.cloud_request_id_digest === null &&
    record.cloud_issued_at === null &&
    record.cloud_expires_at === null;
  const unregisteredTerminal =
    TERMINAL_STATES.has(record.state) &&
    record.state !== "completed" &&
    cloudAuthorityAbsent;
  if (record.state === "created" || unregisteredTerminal) {
    if (!cloudAuthorityAbsent) {
      fail("unregistered transaction cannot claim partial Cloud authority");
    }
  } else {
    canonical32(record.cloud_request_id_digest, "cloud_request_id_digest");
    const issuedAt = safeInteger(record.cloud_issued_at, "cloud_issued_at");
    const expiresAt = safeInteger(record.cloud_expires_at, "cloud_expires_at");
    if (expiresAt - issuedAt !== PREAUTHORIZATION_TTL_SECONDS) {
      fail("registered transaction must preserve Cloud's exact 300-second lifetime");
    }
  }

  if (record.state === "callback_reserved") {
    canonical32(record.reservation_id_digest, "reservation_id_digest");
    const reservationExpiry = safeInteger(
      record.reservation_expires_at,
      "reservation_expires_at"
    );
    if (reservationExpiry > record.cloud_expires_at) {
      fail("callback reservation cannot outlive the Cloud transaction");
    }
  } else if (
    record.reservation_id_digest !== null ||
    record.reservation_expires_at !== null
  ) {
    fail("only callback_reserved may retain reservation fields");
  }

  if (TERMINAL_STATES.has(record.state)) {
    const terminalAt = safeInteger(record.terminal_at, "terminal_at");
    boundedString(record.terminal_reason, "terminal_reason", 64);
    const purgeAfter = safeInteger(record.purge_after, "purge_after");
    if (purgeAfter - terminalAt !== TRANSACTION_TOMBSTONE_SECONDS) {
      fail("terminal replay tombstone must be retained for exactly 24 hours");
    }
  } else if (
    record.terminal_at !== null ||
    record.terminal_reason !== null ||
    record.purge_after !== null
  ) {
    fail("nonterminal state cannot claim terminal cleanup metadata");
  }

  canonicalTransactionAad(record);
  return Object.freeze({ ...record });
}

export function assertTransactionCas(current, next, expectedVersion) {
  const before = validateTransactionRecord(current);
  const after = validateTransactionRecord(next);
  assertConsumerTransactionTransition(before.state, after.state);
  const immutableIdentityMatches =
    before.id === after.id &&
    before.schema_version === after.schema_version &&
    before.region === after.region &&
    before.state_digest === after.state_digest &&
    before.normalized_return_path === after.normalized_return_path &&
    before.created_at === after.created_at;
  const registeredAuthorityMatches =
    before.state === "created" ||
    (before.cloud_request_id_digest === after.cloud_request_id_digest &&
      before.cloud_issued_at === after.cloud_issued_at &&
      before.cloud_expires_at === after.cloud_expires_at);
  const custodialEnvelopeMatches =
    !CUSTODIAL_STATES.has(after.state) ||
    JSON.stringify(before.envelope) === JSON.stringify(after.envelope);
  if (
    !immutableIdentityMatches ||
    !registeredAuthorityMatches ||
    !custodialEnvelopeMatches ||
    before.state_version !== expectedVersion ||
    after.state_version !== expectedVersion + 1 ||
    after.updated_at < before.updated_at
  ) {
    fail("transaction CAS identity or version mismatch");
  }
  if (after.state === "redeem_sent" && after.envelope !== null) {
    fail("redeem_sent must clear encrypted transaction secrets");
  }
  return after;
}

export function transactionCleanupEligible(record, now) {
  const validated = validateTransactionRecord(record);
  safeInteger(now, "cleanup time");
  return TERMINAL_STATES.has(validated.state) && now >= validated.purge_after;
}
