import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_SCHEMA_HEAD,
  loadProductionAuthConfig,
} from "../src/server/auth/productionConfig.mjs";
import { assertAuthSchemaHead } from "../src/server/auth/nodePostgresPool.mjs";
import { createRegionalEnvelopeKeyProvider } from "../src/server/auth/regionalEnvelopeKeyProvider.mjs";
import { createCloudMtlsClient } from "../src/server/auth/cloudMtlsClient.mjs";
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
    K_SNS_TRANSACTION_KMS_KEY_RESOURCE: ng
      ? "projects/synthetic-ksns/locations/africa-south1/keyRings/ksns/cryptoKeys/transactions"
      : "projects/synthetic-ksns/locations/northamerica-northeast2/keyRings/ksns/cryptoKeys/transactions",
    K_SNS_CLOUD_CLIENT_CERT_PATH: "/run/ksns/client.crt",
    K_SNS_CLOUD_CLIENT_KEY_PATH: "/run/ksns/client.key",
    K_SNS_CLOUD_CA_BUNDLE_PATH: "/run/ksns/cloud-ca.pem",
    K_SNS_CLOUD_CRL_PATH: "/run/ksns/cloud.crl",
  };
}

test("protected production config pins exact regional resources", () => {
  const ng = loadProductionAuthConfig(environment("ng"));
  assert.equal(ng.region, "ng");
  assert.equal(ng.kms_location, "africa-south1");
  assert.equal(ng.spiffe_uri, "spiffe://kariya/services/ksns/ng");
  assert.equal(ng.endpoints.introspect, "https://console.kariya.ng/cloud/auth/session/introspect");
  const ca = loadProductionAuthConfig(environment("ca"));
  assert.equal(ca.region, "ca");
  assert.equal(ca.kms_location, "northamerica-northeast2");
  assert.throws(() =>
    loadProductionAuthConfig({
      ...environment("ng"),
      K_SNS_TRANSACTION_KMS_KEY_RESOURCE:
        "projects/synthetic-ksns/locations/northamerica-northeast2/keyRings/ksns/cryptoKeys/transactions",
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
  await assert.rejects(disabled.runtime.exchange.start({}), /unavailable/);

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

test("regional KMS adapter wraps only 32-byte DEKs with the configured HSM key", async () => {
  const keyResource =
    "projects/synthetic-ksns/locations/africa-south1/keyRings/ksns/cryptoKeys/transactions";
  const version = `${keyResource}/cryptoKeyVersions/7`;
  const calls = [];
  const kmsClient = {
    async getCryptoKey(request) {
      calls.push(["get", request]);
      return [{ primary: { name: version } }];
    },
    async encrypt(request) {
      calls.push(["encrypt", request]);
      return [{ name: version, ciphertext: Buffer.from("wrapped") }];
    },
    async decrypt(request) {
      calls.push(["decrypt", request]);
      return [{ plaintext: Buffer.alloc(32, 9) }];
    },
    async close() {},
  };
  const provider = createRegionalEnvelopeKeyProvider(
    { region: "ng", keyResource },
    { kmsClient }
  );
  const reference = await provider.currentKeyReference();
  const wrapped = await provider.wrapKey(Buffer.alloc(32, 1), reference);
  assert.equal(wrapped.toString(), "wrapped");
  assert.equal((await provider.unwrapKey(wrapped, reference)).length, 32);
  await assert.rejects(provider.wrapKey(Buffer.alloc(31), reference), /unavailable/);
  assert.deepEqual(calls.map(([name]) => name), ["get", "encrypt", "decrypt"]);
});

test("Cloud client uses exact operation endpoints and never follows redirects", async () => {
  const config = loadProductionAuthConfig(environment("ng"));
  const calls = [];
  const client = createCloudMtlsClient(config, {
    materialLoader() {
      return Object.freeze({});
    },
    async transport(url, body, receivedConfig) {
      calls.push({ url, body, receivedConfig });
      return { ok: true };
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

test("source evidence is synthetic and performs no PostgreSQL, KMS, certificate, or Cloud provisioning", () => {
  assert.equal(process.env.K_SNS_AUTH_RUNTIME, undefined);
});
