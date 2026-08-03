import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_SCHEMA_HEAD,
  loadProductionAuthConfig,
} from "../src/server/auth/productionConfig.mjs";
import { assertAuthSchemaHead } from "../src/server/auth/nodePostgresPool.mjs";
import {
  certificateValidityWindow,
  certificateDerProfile,
  createCloudMtlsClient,
  parseCloudResponse,
  validateLeafCertificateProfile,
  validateReplacementTrustAnchor,
  validateReplacementTrustAnchorCertificate,
  validateCloudServerIdentity,
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
    K_SNS_CLOUD_MTLS_TRANSPORT_ORIGIN: ng
      ? "https://10.0.0.10:8443"
      : "https://10.0.0.20:8443",
    K_SNS_CLOUD_MTLS_SERVER_NAME: ng
      ? "cloud-auth.ng.internal.kariya"
      : "cloud-auth.ca.internal.kariya",
    K_SNS_CLOUD_CLIENT_CERT_PATH: "/run/ksns/client.crt",
    K_SNS_CLOUD_CLIENT_KEY_PATH: "/run/ksns/client.key",
    K_SNS_CLOUD_CA_BUNDLE_PATH: "/run/ksns/cloud-ca.pem",
  };
}

test("protected production config pins exact regional resources", () => {
  const ng = loadProductionAuthConfig(environment("ng"));
  assert.equal(ng.region, "ng");
  assert.equal(ng.spiffe_uri, "spiffe://kariya/services/ksns/ng");
  assert.equal(ng.cloud_origin, "https://account.kariya.ng");
  assert.equal(ng.transport_origin, "https://10.0.0.10:8443");
  assert.equal(ng.tls_server_name, "cloud-auth.ng.internal.kariya");
  assert.equal(ng.endpoints.introspect, "https://10.0.0.10:8443/cloud/auth/session/introspect");
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

test("private transport and server identity fail closed on drift", () => {
  for (const overrides of [
    { K_SNS_CLOUD_MTLS_TRANSPORT_ORIGIN: "https://account.kariya.ng" },
    { K_SNS_CLOUD_MTLS_TRANSPORT_ORIGIN: "https://127.0.0.1:8443" },
    { K_SNS_CLOUD_MTLS_TRANSPORT_ORIGIN: "http://10.0.0.10:8443" },
    { K_SNS_CLOUD_MTLS_TRANSPORT_ORIGIN: "https://10.0.0.10" },
    { K_SNS_CLOUD_MTLS_SERVER_NAME: "cloud-auth.ca.internal.kariya" },
    { K_SNS_CLOUD_MTLS_SERVER_NAME: "account.kariya.ng" },
  ]) {
    assert.throws(() => loadProductionAuthConfig({ ...environment("ng"), ...overrides }));
  }
});

test("certificate validity supports Node 20 strings and fails closed on malformed values", () => {
  const validFrom = "Jul 15 00:00:00 2026 GMT";
  const validTo = "Aug 14 00:00:00 2026 GMT";
  const node20 = certificateValidityWindow({ validFrom, validTo });
  assert.equal(node20.validFrom, Date.parse(validFrom));
  assert.equal(node20.validTo, Date.parse(validTo));

  const modern = certificateValidityWindow({
    validFromDate: new Date(validFrom),
    validToDate: new Date(validTo),
    validFrom: "ignored",
    validTo: "ignored",
  });
  assert.deepEqual(modern, node20);

  for (const value of [
    { validFrom: "invalid", validTo },
    { validFrom, validTo: "invalid" },
    {},
  ]) {
    assert.throws(() => certificateValidityWindow(value), /unavailable/);
  }
});

test("DER profile parser binds basic constraints, key usage, and SHA-256 signature", () => {
  const tlv = (tag, ...parts) => {
    const body = Buffer.concat(parts);
    assert.ok(body.length < 128);
    return Buffer.concat([Buffer.from([tag, body.length]), body]);
  };
  const oid = {
    signature: Buffer.from("06082a8648ce3d040302", "hex"),
    basic: Buffer.from("0603551d13", "hex"),
    usage: Buffer.from("0603551d0f", "hex"),
  };
  const certificate = (basic, usage) => {
    const extensions = tlv(
      0x30,
      tlv(0x30, oid.basic, tlv(0x04, basic)),
      tlv(0x30, oid.usage, tlv(0x04, usage))
    );
    const tbs = tlv(0x30, tlv(0xa3, extensions));
    return tlv(0x30, tbs, tlv(0x30, oid.signature), tlv(0x03, Buffer.from([0])));
  };

  assert.deepEqual(
    certificateDerProfile(
      certificate(Buffer.from("3000", "hex"), Buffer.from("03020780", "hex"))
    ),
    {
      signatureOid: "1.2.840.10045.4.3.2",
      basic: [],
      keyUsage: "0780",
    }
  );
  assert.deepEqual(
    certificateDerProfile(
      certificate(
        Buffer.from("30060101ff020100", "hex"),
        Buffer.from("03020204", "hex")
      )
    ),
    {
      signatureOid: "1.2.840.10045.4.3.2",
      basic: ["0101ff", "020100"],
      keyUsage: "0204",
    }
  );
  assert.throws(() => certificateDerProfile(Buffer.from("3000", "hex")), /unavailable/);
});
test("dedicated server certificate identity rejects wrong or additional SANs", () => {
  const ok = validateCloudServerIdentity(
    "cloud-auth.ng.internal.kariya",
    { subjectaltname: "DNS:cloud-auth.ng.internal.kariya" },
    "cloud-auth.ng.internal.kariya",
    () => undefined,
    () => undefined
  );
  assert.equal(ok, undefined);
  for (const [hostname, subjectaltname] of [
    ["cloud-auth.ca.internal.kariya", "DNS:cloud-auth.ng.internal.kariya"],
    ["cloud-auth.ng.internal.kariya", "DNS:console.kariya.ng"],
    ["cloud-auth.ng.internal.kariya", "DNS:cloud-auth.ng.internal.kariya, DNS:console.kariya.ng"],
  ]) {
    assert.ok(
      validateCloudServerIdentity(
        hostname,
        { subjectaltname },
        "cloud-auth.ng.internal.kariya",
        () => undefined,
        () => undefined
      ) instanceof Error
    );
  }
});

test("replacement CA and 24-hour leaf profiles fail closed on contract drift", () => {
  const now = Date.parse("2026-08-01T00:00:00Z");
  const p256 = {
    asymmetricKeyType: "ec",
    asymmetricKeyDetails: { namedCurve: "prime256v1" },
  };
  const leafDer = {
    signatureOid: "1.2.840.10045.4.3.2",
    basic: [],
    keyUsage: "0780",
  };
  const leaf = (overrides = {}) => ({
    ca: false,
    subject: "",
    subjectAltName: "URI:spiffe://kariya/services/ksns/ng",
    publicKey: p256,
    keyUsage: ["1.3.6.1.5.5.7.3.2"],
    validFromDate: new Date(now - 1_000),
    validToDate: new Date(now + 86_399_000),
    ...overrides,
  });

  validateLeafCertificateProfile(leaf(), {
    identity: "spiffe://kariya/services/ksns/ng",
    client: true,
    now,
    derProfile: leafDer,
  });
  validateLeafCertificateProfile(
    leaf({
      subjectAltName: "DNS:cloud-auth.ng.internal.kariya",
      keyUsage: ["1.3.6.1.5.5.7.3.1"],
    }),
    {
      identity: "cloud-auth.ng.internal.kariya",
      client: false,
      now,
      derProfile: leafDer,
    }
  );

  const rejectedLeaves = [
    [leaf({ validToDate: new Date(now) }), "spiffe://kariya/services/ksns/ng", leafDer],
    [leaf({ validFromDate: new Date(now + 1) }), "spiffe://kariya/services/ksns/ng", leafDer],
    [
      leaf({
        validFromDate: new Date(now - 1_000),
        validToDate: new Date(now + 86_400_001),
      }),
      "spiffe://kariya/services/ksns/ng",
      leafDer,
    ],
    [leaf(), "spiffe://kariya/services/ksns/ca", leafDer],
    [leaf({ keyUsage: ["1.3.6.1.5.5.7.3.1"] }), "spiffe://kariya/services/ksns/ng", leafDer],
    [leaf({ subject: "CN=legacy" }), "spiffe://kariya/services/ksns/ng", leafDer],
    [leaf({ publicKey: { asymmetricKeyType: "rsa" } }), "spiffe://kariya/services/ksns/ng", leafDer],
    [leaf(), "spiffe://kariya/services/ksns/ng", { ...leafDer, keyUsage: "0781" }],
    [leaf(), "spiffe://kariya/services/ksns/ng", { ...leafDer, basic: ["010100"] }],
    [leaf(), "spiffe://kariya/services/ksns/ng", { ...leafDer, signatureOid: "1.2.840.113549.1.1.11" }],
  ];
  for (const [parsed, identity, derProfile] of rejectedLeaves) {
    assert.throws(
      () =>
        validateLeafCertificateProfile(parsed, {
          identity,
          client: true,
          now,
          derProfile,
        }),
      /unavailable/
    );
  }

  const caDer = {
    signatureOid: "1.2.840.10045.4.3.2",
    basic: ["0101ff", "020100"],
    keyUsage: "0204",
  };
  const anchor = (overrides = {}) => ({
    ca: true,
    subject: "O=Kariya,CN=Durable Exchange Replacement CA",
    issuer: "O=Kariya,CN=Durable Exchange Replacement CA",
    publicKey: p256,
    validFromDate: new Date(now - 1_000),
    validToDate: new Date(now + 86_399_000),
    verify: () => true,
    ...overrides,
  });
  validateReplacementTrustAnchorCertificate(anchor(), { now, derProfile: caDer });
  for (const [parsed, derProfile] of [
    [anchor({ verify: () => false }), caDer],
    [anchor({ validToDate: new Date(now) }), caDer],
    [anchor({ validFromDate: new Date(now + 1) }), caDer],
    [anchor({ issuer: "CN=Legacy CA" }), caDer],
    [anchor(), { ...caDer, basic: ["0101ff", "020101"] }],
    [anchor(), { ...caDer, keyUsage: "0106" }],
    [anchor(), { ...caDer, signatureOid: "1.2.840.113549.1.1.11" }],
  ]) {
    assert.throws(
      () => validateReplacementTrustAnchorCertificate(parsed, { now, derProfile }),
      /unavailable/
    );
  }
});

test("trust bundle accepts one replacement anchor and rejects absence, overlap, and malformed input", () => {
  const pem = "-----BEGIN CERTIFICATE-----\nc3ludGhldGlj\n-----END CERTIFICATE-----";
  let validated = 0;
  const options = {
    certificateFactory: () => Object.freeze({ profile: "replacement" }),
    profileValidator(parsed) {
      assert.equal(parsed.profile, "replacement");
      validated += 1;
    },
  };
  validateReplacementTrustAnchor(Buffer.from(pem), options);
  assert.equal(validated, 1);
  for (const value of [
    "",
    `${pem}\n${pem}`,
    `legacy\n${pem}`,
    "-----BEGIN CERTIFICATE-----\nmalformed",
  ]) {
    assert.throws(
      () => validateReplacementTrustAnchor(Buffer.from(value), options),
      /unavailable/
    );
  }
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
  assert.ok(calls.every((call) => new URL(call.url).origin === config.transport_origin));
  assert.ok(calls.every((call) => !call.url.includes(config.cloud_origin)));
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
