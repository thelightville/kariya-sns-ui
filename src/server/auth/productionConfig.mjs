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
    kms_location: "africa-south1",
  }),
  ca: Object.freeze({
    public_origin: "https://sns.kariya.ca",
    cloud_origin: "https://console.kariya.ca",
    spiffe_uri: "spiffe://kariya/services/ksns/ca",
    kms_location: "northamerica-northeast2",
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

function kmsKeyResource(env, expectedLocation) {
  const value = exactString(env, "K_SNS_TRANSACTION_KMS_KEY_RESOURCE");
  const match = /^projects\/([a-z][a-z0-9-]{4,28}[a-z0-9])\/locations\/([a-z0-9-]+)\/keyRings\/([A-Za-z0-9_-]{1,63})\/cryptoKeys\/([A-Za-z0-9_-]{1,63})$/u.exec(value);
  if (!match || match[2] !== expectedLocation) fail();
  return value;
}

function cloudEndpoints(region) {
  const definition = REGIONS[region];
  return Object.freeze(
    Object.fromEntries(
      Object.entries(CLOUD_PATHS).map(([operation, path]) => [
        operation,
        `${definition.cloud_origin}${path}`,
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

  return Object.freeze({
    runtime_mode: PRODUCTION_RUNTIME_MODE,
    region,
    public_origin: publicOrigin,
    cloud_origin: definition.cloud_origin,
    spiffe_uri: definition.spiffe_uri,
    database_url: databaseUrl(env),
    database_ca_path: protectedAbsolutePath(env, "K_SNS_TRANSACTION_DATABASE_CA_PATH"),
    kms_key_resource: kmsKeyResource(env, definition.kms_location),
    kms_location: definition.kms_location,
    gcp_wif_config_path: protectedAbsolutePath(env, "K_SNS_GCP_WIF_CONFIG_PATH"),
    client_certificate_path: protectedAbsolutePath(env, "K_SNS_CLOUD_CLIENT_CERT_PATH"),
    client_private_key_path: protectedAbsolutePath(env, "K_SNS_CLOUD_CLIENT_KEY_PATH"),
    cloud_ca_bundle_path: protectedAbsolutePath(env, "K_SNS_CLOUD_CA_BUNDLE_PATH"),
    cloud_crl_path: protectedAbsolutePath(env, "K_SNS_CLOUD_CRL_PATH"),
    endpoints: cloudEndpoints(region),
    schema_head: AUTH_SCHEMA_HEAD,
    request_timeout_ms: CLOUD_REQUEST_TIMEOUT_MS,
    response_max_bytes: CLOUD_RESPONSE_MAX_BYTES,
  });
}

export function productionRuntimeRequested(env = process.env) {
  return env.K_SNS_AUTH_RUNTIME === PRODUCTION_RUNTIME_MODE;
}
