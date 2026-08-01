import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadProtectedMtlsMaterial } from "../src/server/auth/cloudMtlsClient.mjs";
import { loadProductionAuthConfig } from "../src/server/auth/productionConfig.mjs";

const CONTRACT_URL = new URL("../deploy/ct119-ui-instances.json", import.meta.url);

function fail() {
  throw new Error("regional_ui_instance_unavailable");
}

export function loadTopologyContract() {
  try {
    return JSON.parse(readFileSync(CONTRACT_URL, "utf8"));
  } catch {
    fail();
  }
}

export function validateTopologyContract(contract) {
  const regions = Object.keys(contract?.instances ?? {}).sort();
  if (contract?.schema !== "kariya.ksns.ct119-ui-instances.v1" || regions.join(",") !== "ca,ng" || contract?.legacy_ui?.fallback !== "prohibited" || contract?.backend_api?.public_ui_routing !== "prohibited") fail();
  const instances = regions.map((region) => contract.instances[region]);
  for (const field of ["service", "hostname", "listener", "environment_file", "client_identity", "credential_source_prefix"]) {
    if (new Set(instances.map((instance) => instance[field])).size !== 2) fail();
  }
  return contract;
}

export function validateRegionalEnvironment(region, env = process.env, contract = loadTopologyContract()) {
  validateTopologyContract(contract);
  const instance = contract.instances[region];
  if (!instance) fail();
  const [host, port] = instance.listener.split(":");
  const expected = { K_SNS_AUTH_RUNTIME: "production", KARIYA_SNS_REGION: region, KARIYA_SNS_PUBLIC_ORIGIN: instance.public_origin, KARIYA_SNS_LISTEN_HOST: host, HOSTNAME: host, PORT: port, K_SNS_TRANSACTION_KEK_ID: `ksns-auth-${region}-transaction-kek`, K_SNS_CLOUD_MTLS_TRANSPORT_ORIGIN: "https://172.16.16.119:8445", K_SNS_CLOUD_MTLS_SERVER_NAME: instance.cloud_server_name };
  for (const [name, value] of Object.entries(expected)) if (env[name] !== value) fail();
  for (const name of contract.required_environment) if (typeof env[name] !== "string") fail();
  return instance;
}

export function verifyRegionalRuntime(region, env = process.env) {
  validateRegionalEnvironment(region, env);
  const config = loadProductionAuthConfig(env);
  if (config.region !== region) fail();
  loadProtectedMtlsMaterial(config);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const index = process.argv.indexOf("--region");
    if (index >= 0) verifyRegionalRuntime(process.argv[index + 1]);
    else validateTopologyContract(loadTopologyContract());
  } catch {
    process.exitCode = 1;
  }
}
