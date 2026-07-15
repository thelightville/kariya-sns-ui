import { isIP } from "node:net";
import { isAbsolute } from "node:path";

export const PRODUCTION_RUNTIME_MODE = "production";
export const AUTH_SCHEMA_HEAD = "ksns-auth-transaction-0001";
export const CLOUD_REQUEST_TIMEOUT_MS = 3_000;
export const CLOUD_RESPONSE_MAX_BYTES = 65_536;

const REGIONS = Object.freeze({
  ng: Object.freeze({
    public_origin: "https://sns.kariya.ng",
    cloud_origin: "https://console.kariya.ng",
    spiffe_uri: "spiffe://kariya/services/ksns/ng",
    cloud_server_name: "cloud-auth.ng.internal.kariya",
  }),
  ca: Object.freeze({
    public_origin: "https://sns.kariya.ca",
    cloud_origin: "https://console.kariya.ca",
    spiffe_uri: "spiffe://kariya/services/ksns/ca",
    cloud_server_name: "cloud-auth.ca.internal.kariya",
  }),
});

const CLOUD_PATHS = Object.freeze({
  register: "/cloud/auth/exchange/register",
  redeem: "/cloud/auth/exchange/redeem",
  introspect: "/cloud/auth/session/introspect",
  revoke: "/cloud/auth/session/revoke",
  logout: "/cloud/auth/session/logout",
});

function fail() {
  throw new Error("cloud_auth_runtime_unavailable");
}

function exactString(env, name) {
  const value = env[name];
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) fail();
  return value;
}

function protectedAbsolutePath(env, name) {
  const value = exactString(env, name);
  if (!isAbsolute(value) || /[\0\r\n]/u.test(value)) fail();
  return value;
}

function databaseUrl(env) {
  const value = exactString(env, "K_SNS_TRANSACTION_DATABASE_URL");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail();
  }
  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) fail();
  if (!parsed.hostname || parsed.hash || parsed.search) fail();
  return value;
}

function privateIpv4(hostname) {
  if (isIP(hostname) !== 4) return false;
  const octets = hostname.split(".").map(Number);
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function protectedTransportOrigin(env) {
  const value = exactString(env, "K_SNS_CLOUD_MTLS_TRANSPORT_ORIGIN");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail();
  }
  const port = Number(parsed.port);
  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== value ||
    parsed.pathname !== "/" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !privateIpv4(parsed.hostname) ||
    !Number.isSafeInteger(port) ||
    port < 1024 ||
    port > 65535
  ) {
    fail();
  }
  return parsed.origin;
}

function keyVersion(env, name, { optional = false } = {}) {
  if (optional && (env[name] === undefined || env[name] === "")) return null;
  const value = exactString(env, name);
  if (!/^v[1-9][0-9]{0,8}$/u.test(value)) fail();
  return value;
}

function cloudEndpoints(transportOrigin) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(CLOUD_PATHS).map(([operation, path]) => [
        operation,
        `${transportOrigin}${path}`,
      ])
    )
  );
}

export function productionRegionDefinition(region) {
  const value = REGIONS[region];
  if (!value) fail();
  return value;
}

export function loadProductionAuthConfig(env = process.env) {
  if (env.K_SNS_AUTH_RUNTIME !== PRODUCTION_RUNTIME_MODE) fail();
  const publicOrigin = exactString(env, "KARIYA_SNS_PUBLIC_ORIGIN");
  const region = Object.keys(REGIONS).find(
    (candidate) => REGIONS[candidate].public_origin === publicOrigin
  );
  if (!region) fail();
  const definition = REGIONS[region];
  const transportOrigin = protectedTransportOrigin(env);
  const serverName = exactString(env, "K_SNS_CLOUD_MTLS_SERVER_NAME");
  if (serverName !== definition.cloud_server_name) fail();

  return Object.freeze({
    runtime_mode: PRODUCTION_RUNTIME_MODE,
    region,
    public_origin: publicOrigin,
    cloud_origin: definition.cloud_origin,
    transport_origin: transportOrigin,
    tls_server_name: serverName,
    spiffe_uri: definition.spiffe_uri,
    database_url: databaseUrl(env),
    database_ca_path: protectedAbsolutePath(env, "K_SNS_TRANSACTION_DATABASE_CA_PATH"),
    credential_directory: protectedAbsolutePath(env, "CREDENTIALS_DIRECTORY"),
    envelope_key_id: exactString(env, "K_SNS_TRANSACTION_KEK_ID"),
    envelope_current_version: keyVersion(
      env,
      "K_SNS_TRANSACTION_KEK_CURRENT_VERSION"
    ),
    envelope_previous_version: keyVersion(
      env,
      "K_SNS_TRANSACTION_KEK_PREVIOUS_VERSION",
      { optional: true }
    ),
    client_certificate_path: protectedAbsolutePath(env, "K_SNS_CLOUD_CLIENT_CERT_PATH"),
    client_private_key_path: protectedAbsolutePath(env, "K_SNS_CLOUD_CLIENT_KEY_PATH"),
    cloud_ca_bundle_path: protectedAbsolutePath(env, "K_SNS_CLOUD_CA_BUNDLE_PATH"),
    cloud_crl_path: protectedAbsolutePath(env, "K_SNS_CLOUD_CRL_PATH"),
    endpoints: cloudEndpoints(transportOrigin),
    schema_head: AUTH_SCHEMA_HEAD,
    request_timeout_ms: CLOUD_REQUEST_TIMEOUT_MS,
    response_max_bytes: CLOUD_RESPONSE_MAX_BYTES,
  });
}

export function productionRuntimeRequested(env = process.env) {
  return env.K_SNS_AUTH_RUNTIME === PRODUCTION_RUNTIME_MODE;
}
