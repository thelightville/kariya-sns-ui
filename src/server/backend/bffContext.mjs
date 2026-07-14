import {
  canonical32,
  validateIntrospectionResult,
} from "../auth/cloudExchangeFoundation.mjs";

export const BFF_CONTEXT_VERSION = "ksns.bff-context.v1";

export const BFF_CONTEXT_KEYS = Object.freeze([
  "x-kariya-authority-expires-at",
  "x-kariya-context-version",
  "x-kariya-region",
  "x-kariya-request-id",
  "x-kariya-role",
  "x-kariya-subject-id",
  "x-kariya-tenant-id",
]);

const CLOUD_TO_BACKEND_ROLE = Object.freeze({
  owner: "admin",
  admin: "admin",
  analyst: "soc_analyst",
  viewer: "viewer",
});

const SAFE_INBOUND_HEADERS = Object.freeze(["accept", "content-type"]);

function fail(message) {
  throw new TypeError(message);
}

function canonicalHeaderEntries(input) {
  const headers = input instanceof Headers ? input : new Headers(input);
  return [...headers.entries()].map(([name, value]) => [name.toLowerCase(), value]);
}

function exactContextKeys(context) {
  const keys = Object.keys(context).map((key) => key.toLowerCase()).sort();
  if (
    keys.length !== BFF_CONTEXT_KEYS.length ||
    keys.some((key, index) => key !== BFF_CONTEXT_KEYS[index])
  ) {
    fail(`BFF context must contain exactly: ${BFF_CONTEXT_KEYS.join(", ")}`);
  }
}

function boundedIdentity(value, label) {
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

export function mapCloudRoleToBackend(role) {
  const mapped = CLOUD_TO_BACKEND_ROLE[role];
  if (!mapped) fail("Cloud role has no K-SNS backend mapping");
  return mapped;
}

export function buildBffContext(activeIntrospection, requestId) {
  const validated = validateIntrospectionResult(
    activeIntrospection,
    activeIntrospection?.region
  );
  if (validated.active !== true) fail("only an active introspection can create context");
  canonical32(requestId, "request_id");

  return Object.freeze({
    "x-kariya-authority-expires-at": String(validated.expires_at),
    "x-kariya-context-version": BFF_CONTEXT_VERSION,
    "x-kariya-region": validated.region,
    "x-kariya-request-id": requestId,
    "x-kariya-role": mapCloudRoleToBackend(validated.current_role),
    "x-kariya-subject-id": validated.subject,
    "x-kariya-tenant-id": validated.tenant_id,
  });
}

export function validateBffContext(context) {
  if (context === null || typeof context !== "object" || Array.isArray(context)) {
    fail("BFF context must be an object");
  }
  exactContextKeys(context);

  const normalized = Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key.toLowerCase(), value])
  );
  if (normalized["x-kariya-context-version"] !== BFF_CONTEXT_VERSION) {
    fail("unsupported BFF context version");
  }
  if (!["ng", "ca"].includes(normalized["x-kariya-region"])) {
    fail("invalid BFF context region");
  }
  if (!["admin", "soc_analyst", "viewer"].includes(normalized["x-kariya-role"])) {
    fail("invalid BFF context role");
  }
  boundedIdentity(normalized["x-kariya-subject-id"], "subject");
  boundedIdentity(normalized["x-kariya-tenant-id"], "tenant");
  canonical32(normalized["x-kariya-request-id"], "request_id");

  const expiry = Number(normalized["x-kariya-authority-expires-at"]);
  if (
    !/^[1-9][0-9]*$/u.test(normalized["x-kariya-authority-expires-at"]) ||
    !Number.isSafeInteger(expiry)
  ) {
    fail("authority expiry must be a positive safe integer string");
  }
  return Object.freeze(normalized);
}

export function stripInboundAuthorityHeaders(input) {
  const sanitized = new Headers();
  for (const [name, value] of canonicalHeaderEntries(input)) {
    if (SAFE_INBOUND_HEADERS.includes(name)) sanitized.set(name, value);
  }
  return sanitized;
}
