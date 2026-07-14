import { Buffer } from "node:buffer";

export const CLOUD_CONTRACT_VERSION = "cloud.durable-exchange.v1";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 899;
export const PREAUTHORIZATION_TTL_SECONDS = 300;

export const REGIONAL_TUPLES = Object.freeze({
  ng: Object.freeze({
    region: "ng",
    issuer: "https://console.kariya.ng",
    audience: "https://sns.kariya.ng",
    destination_host: "sns.kariya.ng",
    redirect_uri: "https://sns.kariya.ng/api/auth/exchange/callback",
    client_id: "ksns-ui-ng",
    client_uri_san: "spiffe://kariya/services/ksns/ng",
  }),
  ca: Object.freeze({
    region: "ca",
    issuer: "https://console.kariya.ca",
    audience: "https://sns.kariya.ca",
    destination_host: "sns.kariya.ca",
    redirect_uri: "https://sns.kariya.ca/api/auth/exchange/callback",
    client_id: "ksns-ui-ca",
    client_uri_san: "spiffe://kariya/services/ksns/ca",
  }),
});

/**
 * @typedef {"created"|"registered"|"callback_reserved"|"redeem_sent"|"completed"|"terminal_failed"|"expired"} ConsumerTransactionState
 */

export const CONSUMER_TRANSACTION_TRANSITIONS = Object.freeze({
  created: Object.freeze(["registered", "terminal_failed", "expired"]),
  registered: Object.freeze(["callback_reserved", "terminal_failed", "expired"]),
  callback_reserved: Object.freeze(["registered", "redeem_sent", "terminal_failed", "expired"]),
  redeem_sent: Object.freeze(["completed", "terminal_failed"]),
  completed: Object.freeze([]),
  terminal_failed: Object.freeze([]),
  expired: Object.freeze([]),
});

function fail(message) {
  throw new TypeError(message);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireExactKeys(value, expectedKeys, label) {
  if (!isPlainObject(value)) fail(`${label} must be a plain object`);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(`${label} must contain exactly: ${expected.join(", ")}`);
  }
}

function requireSafeTimestamp(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(`${label} must be a positive safe integer`);
  }
  return value;
}

function requireBoundedIdentity(value, label) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 128 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    fail(`${label} must be a bounded canonical string`);
  }
  return value;
}

export function regionalTuple(region) {
  const tuple = REGIONAL_TUPLES[region];
  if (!tuple) fail("region must be exactly ng or ca");
  return tuple;
}

export function canonical32(value, label = "value") {
  if (
    typeof value !== "string" ||
    value.length !== 43 ||
    !/^[A-Za-z0-9_-]+$/u.test(value)
  ) {
    fail(`${label} must be 43-character unpadded base64url`);
  }

  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== value) {
    fail(`${label} must canonically encode exactly 32 bytes`);
  }
  return value;
}

export function canTransitionConsumerTransaction(from, to) {
  const destinations = CONSUMER_TRANSACTION_TRANSITIONS[from];
  return Array.isArray(destinations) && destinations.includes(to);
}

export function assertConsumerTransactionTransition(from, to) {
  if (!canTransitionConsumerTransaction(from, to)) {
    fail(`illegal consumer transaction transition: ${String(from)} -> ${String(to)}`);
  }
  return to;
}

export function validatePreauthorizationResult(value, expectedRegion) {
  requireExactKeys(
    value,
    ["contract_version", "request_id", "issued_at", "expires_at", "server_time"],
    "preauthorization result"
  );
  if (value.contract_version !== "cloud.exchange-preauthorization.v1") {
    fail("unexpected preauthorization contract version");
  }
  regionalTuple(expectedRegion);
  canonical32(value.request_id, "request_id");
  const issuedAt = requireSafeTimestamp(value.issued_at, "issued_at");
  const expiresAt = requireSafeTimestamp(value.expires_at, "expires_at");
  const serverTime = requireSafeTimestamp(value.server_time, "server_time");
  if (serverTime !== issuedAt || expiresAt - issuedAt !== PREAUTHORIZATION_TTL_SECONDS) {
    fail("Cloud preauthorization time authority or exact TTL is invalid");
  }
  return Object.freeze({ ...value, region: expectedRegion });
}

export function validateRedemptionResult(value, expectedRegion, expectedNonce) {
  requireExactKeys(
    value,
    [
      "contract_version",
      "region",
      "issuer",
      "audience",
      "nonce",
      "subject",
      "tenant_id",
      "session_handle",
      "issued_at",
      "expires_at",
      "server_time",
    ],
    "redemption result"
  );
  if (value.contract_version !== "cloud.authorization-code-redemption.v1") {
    fail("unexpected redemption contract version");
  }
  const tuple = regionalTuple(expectedRegion);
  if (
    value.region !== tuple.region ||
    value.issuer !== tuple.issuer ||
    value.audience !== tuple.audience
  ) {
    fail("redemption result crosses the configured regional tuple");
  }
  canonical32(value.nonce, "nonce");
  canonical32(expectedNonce, "expected nonce");
  if (value.nonce !== expectedNonce) fail("redemption nonce does not match");
  canonical32(value.session_handle, "session_handle");
  requireBoundedIdentity(value.subject, "subject");
  requireBoundedIdentity(value.tenant_id, "tenant_id");
  const issuedAt = requireSafeTimestamp(value.issued_at, "issued_at");
  const expiresAt = requireSafeTimestamp(value.expires_at, "expires_at");
  const serverTime = requireSafeTimestamp(value.server_time, "server_time");
  if (
    expiresAt - issuedAt !== SESSION_COOKIE_MAX_AGE_SECONDS ||
    serverTime < issuedAt ||
    serverTime >= expiresAt
  ) {
    fail("Cloud redemption time authority is invalid or expired");
  }
  return Object.freeze({ ...value });
}

export function validateIntrospectionResult(value, expectedRegion) {
  if (!isPlainObject(value)) fail("introspection result must be a plain object");

  if (value.active === false) {
    requireExactKeys(value, ["contract_version", "active"], "inactive introspection");
    if (value.contract_version !== "cloud.session-authority.v1") {
      fail("unexpected session authority contract version");
    }
    return Object.freeze({ ...value });
  }

  requireExactKeys(
    value,
    [
      "contract_version",
      "active",
      "issuer",
      "audience",
      "destination_host",
      "region",
      "subject",
      "tenant_id",
      "current_role",
      "mfa_authenticated",
      "issued_at",
      "expires_at",
    ],
    "active introspection"
  );
  if (value.contract_version !== "cloud.session-authority.v1" || value.active !== true) {
    fail("unexpected active session authority result");
  }
  const tuple = regionalTuple(expectedRegion);
  if (
    value.region !== tuple.region ||
    value.issuer !== tuple.issuer ||
    value.audience !== tuple.audience ||
    value.destination_host !== tuple.destination_host
  ) {
    fail("introspection result crosses the configured regional tuple");
  }
  requireBoundedIdentity(value.subject, "subject");
  requireBoundedIdentity(value.tenant_id, "tenant_id");
  if (!["owner", "admin", "analyst", "viewer"].includes(value.current_role)) {
    fail("unsupported current_role");
  }
  if (typeof value.mfa_authenticated !== "boolean") {
    fail("mfa_authenticated must be boolean");
  }
  const issuedAt = requireSafeTimestamp(value.issued_at, "issued_at");
  const expiresAt = requireSafeTimestamp(value.expires_at, "expires_at");
  if (expiresAt <= issuedAt) fail("introspection result is expired or inverted");
  return Object.freeze({ ...value });
}

export function calculateSessionCookieMaxAge({ issued_at, expires_at, server_time }) {
  const issuedAt = requireSafeTimestamp(issued_at, "issued_at");
  const expiresAt = requireSafeTimestamp(expires_at, "expires_at");
  const serverTime = requireSafeTimestamp(server_time, "server_time");
  if (
    expiresAt - issuedAt !== SESSION_COOKIE_MAX_AGE_SECONDS ||
    serverTime < issuedAt ||
    serverTime >= expiresAt
  ) {
    fail("Cloud session time profile is invalid or expired");
  }
  const remaining = expiresAt - serverTime;
  return Math.min(SESSION_COOKIE_MAX_AGE_SECONDS, remaining);
}
