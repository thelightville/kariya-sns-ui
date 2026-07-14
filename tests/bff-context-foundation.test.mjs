import assert from "node:assert/strict";
import test from "node:test";

import {
  BFF_CONTEXT_KEYS,
  BFF_CONTEXT_VERSION,
  buildBffContext,
  mapCloudRoleToBackend,
  stripInboundAuthorityHeaders,
  validateBffContext,
} from "../src/server/backend/bffContext.mjs";

const REQUEST_ID = "BgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgY";

function introspection(role = "analyst") {
  return {
    contract_version: "cloud.session-authority.v1",
    active: true,
    issuer: "https://console.kariya.ng",
    audience: "https://sns.kariya.ng",
    destination_host: "sns.kariya.ng",
    region: "ng",
    subject: "user-0001",
    tenant_id: "tenant-0001",
    current_role: role,
    mfa_authenticated: true,
    issued_at: 2_000_000_000,
    expires_at: 2_000_000_899,
  };
}

test("BFF context uses the exact v1 key set and Cloud-derived authority", () => {
  const context = buildBffContext(introspection(), "ng", REQUEST_ID);
  assert.deepEqual(Object.keys(context).sort(), [...BFF_CONTEXT_KEYS]);
  assert.equal(context["x-kariya-context-version"], BFF_CONTEXT_VERSION);
  assert.equal(context["x-kariya-region"], "ng");
  assert.equal(context["x-kariya-role"], "soc_analyst");
  assert.equal(context["x-kariya-tenant-id"], "tenant-0001");
  assert.equal(context["x-kariya-subject-id"], "user-0001");
  assert.equal(context["x-kariya-request-id"], REQUEST_ID);
  assert.equal(context["x-kariya-authority-expires-at"], "2000000899");
  assert.deepEqual(validateBffContext(context), context);
});

test("role mapping is exact and has no permissive default", () => {
  assert.equal(mapCloudRoleToBackend("owner"), "admin");
  assert.equal(mapCloudRoleToBackend("admin"), "admin");
  assert.equal(mapCloudRoleToBackend("analyst"), "soc_analyst");
  assert.equal(mapCloudRoleToBackend("viewer"), "viewer");
  assert.throws(() => mapCloudRoleToBackend("soc_manager"), /no K-SNS backend mapping/);
  assert.throws(() => mapCloudRoleToBackend("unknown"), /no K-SNS backend mapping/);
});

test("inactive, cross-country, malformed, missing and extra context fail closed", () => {
  assert.throws(
    () =>
      buildBffContext(
        { contract_version: "cloud.session-authority.v1", active: false },
        "ng",
        REQUEST_ID
      ),
    /active introspection/
  );
  assert.throws(
    () =>
      buildBffContext(
        { ...introspection(), issuer: "https://console.kariya.ca" },
        "ng",
        REQUEST_ID
      ),
    /crosses/
  );

  const ca = {
    ...introspection(),
    issuer: "https://console.kariya.ca",
    audience: "https://sns.kariya.ca",
    destination_host: "sns.kariya.ca",
    region: "ca",
  };
  assert.throws(() => buildBffContext(ca, "ng", REQUEST_ID), /crosses/);
  assert.throws(() => buildBffContext(introspection(), "ca", REQUEST_ID), /crosses/);

  const valid = buildBffContext(introspection(), "ng", REQUEST_ID);
  const missing = { ...valid };
  delete missing["x-kariya-region"];
  assert.throws(() => validateBffContext(missing), /exactly/);
  assert.throws(() => validateBffContext({ ...valid, authorization: "Bearer raw" }), /exactly/);
  assert.throws(
    () =>
      validateBffContext({
        ...valid,
        "x-kariya-authority-expires-at": "2000000899.0",
      }),
    /positive safe integer/
  );
});

test("stripping keeps only inert content negotiation headers", () => {
  const inbound = new Headers({
    accept: "application/json",
    authorization: "Bearer browser-value",
    connection: "keep-alive",
    cookie: "sns_token=opaque",
    "content-type": "application/json",
    forwarded: "host=evil.example",
    host: "evil.example",
    "x-forwarded-host": "evil.example",
    "x-kariya-tenant-id": "attacker-tenant",
    "x-tenant-id": "attacker-tenant",
  });
  const stripped = stripInboundAuthorityHeaders(inbound);
  assert.deepEqual([...stripped.entries()], [
    ["accept", "application/json"],
    ["content-type", "application/json"],
  ]);
  for (const forbidden of [
    "authorization",
    "connection",
    "cookie",
    "forwarded",
    "host",
    "x-forwarded-host",
    "x-kariya-tenant-id",
    "x-tenant-id",
  ]) {
    assert.equal(stripped.has(forbidden), false);
  }
});
