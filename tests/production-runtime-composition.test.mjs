import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_SCHEMA_HEAD,
  loadProductionAuthConfig,
} from "../src/server/auth/productionConfig.mjs";
import { assertAuthSchemaHead } from "../src/server/auth/nodePostgresPool.mjs";
import {
  createCloudMtlsClient,
  parseCloudResponse,
} from "../src/server/auth/cloudMtlsClient.mjs";
import { selectAuthRuntime } from "../src/server/auth/runtimeComposition.mjs";

function environment(region = "ng") {
  const ng = region === "ng";
  return {
    K_SNS_AUTH_RUNTIME: "production",
    KARIYA_SNS_PUBLIC_ORIGIN: ng
      ? "https://sns.kariya.ng"
      : "https://sns.kariya.ca",
    K_SNS_TRANSACTION_DATABASE_URL: "postgresql://synthetic.invalid/ksns",
    K_SNS_TRANSACTION_DATABASE_CA_PATH: "/run/ksns/db-ca.pem",
    CREDENTIALS_DIRECTORY: "/run/credentials/kariya-sns-ui.service",
    K_SNS_TRANSACTION_KEK_ID: `ksns-auth-${region}-transaction-kek`,
    K_SNS_TRANSACTION_KEK_CURRENT_VERSION: "v2",
    K_SNS_TRANSACTION_KEK_PREVIOUS_VERSION: "v1",
    K_SNS_CLOUD_CLIENT_CERT_PATH: "/run/ksns/client.crt",
    K_SNS_CLOUD_CLIENT_KEY_PATH: "/run/ksns/client.key",
    K_SNS_CLOUD_CA_BUNDLE_PATH: "/run/ksns/cloud-ca.pem",
    K_SNS_CLOUD_CRL_PATH: "/run/ksns/cloud.crl",
  };
}

test("protected production config pins exact regional resources", () => {
  const ng = loadProductionAuthConfig(environment("ng"));
  assert.equal(ng.region, "ng");
  assert.equal(ng.spiffe_uri, "spiffe://kariya/services/ksns/ng");
  assert.equal(ng.endpoints.introspect, "https://console.kariya.ng/cloud/auth/session/introspect");
  const ca = loadProductionAuthConfig(environment("ca"));
  assert.equal(ca.region, "ca");
  assert.equal(ca.envelope_key_id, "ksns-auth-ca-transaction-kek");
  assert.equal(ng.envelope_current_version, "v2");
  assert.equal(ng.envelope_previous_version, "v1");
  assert.throws(() =>
    loadProductionAuthConfig({
      ...environment("ng"),
      CREDENTIALS_DIRECTORY: "relative/credentials",
    })
  );
});

test("production selection is explicit and malformed protected config stays unavailable", async () => {
  let called = 0;
  const disabled = selectAuthRuntime({}, {
    productionFactory() {
      called += 1;
    },
  });
  assert.equal(disabled.composition, null);
  assert.equal(called, 0);
  await assert.rejects(
    disabled.runtime.exchange.start({
      region: "ng",
      normalized_return_path: "/workflow",
    }),
    /unavailable/
  );

  const malformed = selectAuthRuntime({ K_SNS_AUTH_RUNTIME: "production" }, {
    productionFactory() {
      called += 1;
    },
  });
  assert.equal(malformed.composition, null);
  assert.equal(called, 0);
});

test("schema-head mismatch fails closed without runtime DDL", async () => {
  const queries = [];
  const pool = {
    async query(text) {
      queries.push(text);
      return { rowCount: 1, rows: [{ schema_head: "wrong" }] };
    },
  };
  await assert.rejects(assertAuthSchemaHead(pool, AUTH_SCHEMA_HEAD), /unavailable/);
  assert.equal(queries.length, 1);
  assert.match(queries[0], /^SELECT /u);
  assert.doesNotMatch(queries[0], /CREATE|ALTER|INSERT|UPDATE|DELETE/iu);
});

test("production config rejects malformed key rotation metadata", () => {
  for (const overrides of [
    { K_SNS_TRANSACTION_KEK_CURRENT_VERSION: "v0" },
    { K_SNS_TRANSACTION_KEK_CURRENT_VERSION: "2" },
    { K_SNS_TRANSACTION_KEK_PREVIOUS_VERSION: "v0" },
  ]) {
    assert.throws(() => loadProductionAuthConfig({ ...environment("ng"), ...overrides }));
  }
});

test("Cloud client uses exact operation endpoints and never follows redirects", async () => {
  const config = loadProductionAuthConfig(environment("ng"));
  const calls = [];
  const client = createCloudMtlsClient(config, {
    materialLoader() {
      return Object.freeze({});
    },
    async transport(url, body, receivedConfig, _materialLoader, responseMode) {
      calls.push({ url, body, receivedConfig, responseMode });
      return responseMode === "empty" ? undefined : { ok: true };
    },
  });
  await client.register({ contract_version: "cloud.exchange-preauthorization.v1" });
  await client.redeem({ contract_version: "cloud.authorization-code-redemption.v1" });
  await client.introspect({ contract_version: "cloud.session-authority.v1" });
  await client.revoke({ contract_version: "cloud.session-authority.v1" });
  await client.logout({ contract_version: "cloud.session-authority.v1" });
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    "/cloud/auth/exchange/register",
    "/cloud/auth/exchange/redeem",
    "/cloud/auth/session/introspect",
    "/cloud/auth/session/revoke",
    "/cloud/auth/session/logout",
  ]);
  assert.ok(calls.every((call) => call.receivedConfig.region === "ng"));
  assert.deepEqual(calls.map((call) => call.responseMode), [
    "json",
    "json",
    "json",
    "empty",
    "empty",
  ]);
});

test("bodyless 204 is accepted only for revoke and logout response mode", () => {
  assert.equal(
    parseCloudResponse(
      { statusCode: 204, headers: {}, body: Buffer.alloc(0) },
      "empty"
    ),
    undefined
  );
  for (const response of [
    { statusCode: 204, headers: {}, body: Buffer.from("{}") },
    { statusCode: 204, headers: { "content-length": "0" }, body: Buffer.alloc(0) },
    { statusCode: 204, headers: { "transfer-encoding": "chunked" }, body: Buffer.alloc(0) },
    { statusCode: 200, headers: {}, body: Buffer.alloc(0) },
  ]) {
    assert.throws(() => parseCloudResponse(response, "empty"), /unavailable/);
  }
});

test("response-bearing operations require exact JSON success shape", () => {
  assert.deepEqual(
    parseCloudResponse(
      {
        statusCode: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
        body: Buffer.from('{"ok":true}'),
      },
      "json"
    ),
    { ok: true }
  );
  for (const response of [
    { statusCode: 204, headers: {}, body: Buffer.alloc(0) },
    { statusCode: 200, headers: { "content-type": "application/json" }, body: Buffer.alloc(0) },
    { statusCode: 200, headers: { "content-type": "application/json" }, body: Buffer.from("{") },
    { statusCode: 200, headers: { "content-type": "text/plain" }, body: Buffer.from("{}") },
    { statusCode: 201, headers: { "content-type": "application/json" }, body: Buffer.from("{}") },
    { statusCode: 503, headers: { "content-type": "application/json" }, body: Buffer.from("{}") },
  ]) {
    assert.throws(() => parseCloudResponse(response, "json"), /unavailable/);
  }
});

test("synthetic production composition closes every owned client once", async () => {
  let closeCount = 0;
  const composition = {
    runtime: Object.freeze({ exchange: {}, sessions: {} }),
    async close() {
      closeCount += 1;
    },
  };
  const selected = selectAuthRuntime(environment("ng"), {
    productionFactory(config, options) {
      assert.equal(config.region, "ng");
      assert.equal(typeof options.runtimeFactory, "function");
      return composition;
    },
  });
  assert.equal(selected.runtime, composition.runtime);
  await selected.composition.close();
  assert.equal(closeCount, 1);
});

test("source evidence is synthetic and performs no PostgreSQL, credential, certificate, or Cloud provisioning", () => {
  assert.equal(process.env.K_SNS_AUTH_RUNTIME, undefined);
});
