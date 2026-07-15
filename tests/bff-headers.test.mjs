import assert from "node:assert/strict";
import test from "node:test";
import { buildBffHeaders } from "../src/lib/bffHeaders.mjs";

const blockedHeaders = [
  "cookie",
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "x-forwarded-host",
];

function hostileInboundHeaders() {
  return new Headers({
    accept: "application/json",
    "content-type": "application/json",
    authorization: "Bearer caller-controlled",
    cookie: "sns_token=caller-controlled",
    host: "evil.example",
    connection: "upgrade",
    "keep-alive": "timeout=5",
    "proxy-authenticate": "spoof",
    "proxy-authorization": "spoof",
    te: "trailers",
    trailer: "x-checksum",
    "transfer-encoding": "chunked",
    upgrade: "websocket",
    "x-forwarded-host": "evil.example",
    "x-tenant-id": "caller-tenant",
  });
}

test("BFF replaces caller authorization and tenant headers with trusted values", () => {
  const headers = buildBffHeaders(
    hostileInboundHeaders(),
    "server-session",
    "trusted-tenant"
  );

  assert.equal(headers.get("authorization"), "Bearer server-session");
  assert.equal(headers.get("x-tenant-id"), "trusted-tenant");
  assert.equal(headers.get("accept"), "application/json");
  assert.equal(headers.get("content-type"), "application/json");
  for (const name of blockedHeaders) {
    assert.equal(headers.has(name), false, `forwarded blocked header: ${name}`);
  }
});

test("BFF removes caller tenant context when no trusted tenant is configured", () => {
  const headers = buildBffHeaders(hostileInboundHeaders(), "server-session");
  assert.equal(headers.has("x-tenant-id"), false);
});

test("BFF fails closed without a server-owned session token", () => {
  assert.throws(
    () => buildBffHeaders(hostileInboundHeaders(), "", "trusted-tenant"),
    /server-owned session token/
  );
});
