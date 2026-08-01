import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadTopologyContract, validateRegionalEnvironment, validateTopologyContract } from "../scripts/verify-regional-ui-instance.mjs";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

function parseEnvironment(value) {
  return Object.fromEntries(value.split(/\r?\n/u).filter(Boolean).map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

test("contract defines exactly two isolated public UI instances", () => {
  const contract = validateTopologyContract(loadTopologyContract());
  assert.deepEqual(Object.keys(contract.instances).sort(), ["ca", "ng"]);
  assert.equal(contract.instances.ng.listener, "127.0.0.1:3011");
  assert.deepEqual(contract.unit_bound_environment, [
    "K_SNS_TRANSACTION_DATABASE_CA_PATH",
    "K_SNS_CLOUD_CLIENT_CERT_PATH",
    "K_SNS_CLOUD_CLIENT_KEY_PATH",
    "K_SNS_CLOUD_CA_BUNDLE_PATH",
  ]);
  assert.deepEqual(contract.credential_runtime_ids, [
    "ksns-transaction-kek-current",
    "ksns-transaction-kek-previous",
    "ksns-db-ca.pem",
    "cloud-client-cert.pem",
    "cloud-client-key.pem",
    "cloud-ca-bundle.pem",
  ]);
  assert.equal(contract.instances.ca.listener, "127.0.0.1:3012");
  assert.equal(contract.legacy_ui.fallback, "prohibited");
  assert.equal(contract.backend_api.public_ui_routing, "prohibited");
});

for (const region of ["ng", "ca"]) test(`${region} unit binds only its exact environment and credential namespace`, async () => {
  const contract = loadTopologyContract();
  const instance = contract.instances[region];
  const env = parseEnvironment(await source(`deploy/env/sns-ui-${region}.env.example`));
  env.HOSTNAME = "127.0.0.1";
  assert.equal(validateRegionalEnvironment(region, env, contract), instance);
  const unit = await source(`deploy/systemd/${instance.service}`);
  assert.match(unit, /User=kariya_ksns_auth/u);
  assert.match(unit, new RegExp(`EnvironmentFile=${instance.environment_file}`));
  assert.match(unit, new RegExp(`--region ${region}`));
  assert.match(unit, new RegExp(`/ksns-ui-${region}-cloud-client-cert\\.pem`));
  assert.doesNotMatch(unit, /crl/iu);
  assert.doesNotMatch(unit, new RegExp(`ksns-ui-${region === "ng" ? "ca" : "ng"}-`));
  assert.doesNotMatch(unit, /172\.16\.16\.119:8019|127\.0\.0\.1:8019|127\.0\.0\.1:8020/u);
});

test("wrong-region metadata fails before service startup", async () => {
  const contract = loadTopologyContract();
  const env = parseEnvironment(await source("deploy/env/sns-ui-ng.env.example"));
  env.HOSTNAME = "127.0.0.1";
  for (const overrides of [{ KARIYA_SNS_REGION: "ca" }, { KARIYA_SNS_PUBLIC_ORIGIN: "https://sns.kariya.ca" }, { PORT: "3012" }, { K_SNS_CLOUD_MTLS_SERVER_NAME: "cloud-auth.ca.internal.kariya" }]) {
    assert.throws(() => validateRegionalEnvironment("ng", { ...env, ...overrides }, contract), /unavailable/u);
  }
});

test("public UI health and unauthenticated boundaries remain explicit", async () => {
  const [health, proxy, bff] = await Promise.all([source("src/app/api/health/route.ts"), source("src/proxy.ts"), source("src/app/api/ksns/[...path]/route.ts")]);
  assert.match(health, /status:\s*200/u);
  assert.match(proxy, /NextResponse\.redirect\(location, 307\)/u);
  assert.match(proxy, /host === "sns\.kariya\.ca"/u);
  assert.match(bff, /if \(!handle\) return jsonError\("Unauthorized\.", 401\)/u);
});

test("new topology artifacts contain no embedded secret material", async () => {
  const artifacts = ["deploy/ct119-ui-instances.json", "deploy/env/sns-ui-ng.env.example", "deploy/env/sns-ui-ca.env.example", "deploy/systemd/kariya-sns-ui-ng.service", "deploy/systemd/kariya-sns-ui-ca.service", "docs/ct119-regional-ui-topology.md"];
  const forbidden = ["BEGIN PRIVATE KEY", "BEGIN RSA PRIVATE KEY", "BEGIN CERTIFICATE", "ghp_"];
  for (const artifact of artifacts) {
    const content = await source(artifact);
    for (const marker of forbidden) assert.equal(content.includes(marker), false);
  }
});
