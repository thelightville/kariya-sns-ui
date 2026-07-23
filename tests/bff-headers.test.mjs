import assert from "node:assert/strict";
import test from "node:test";
import { buildBffHeaders } from "../src/lib/bffHeaders.mjs";
import { isKsnsBffRequestAllowed } from "../src/lib/ksnsBffAllowlist.mjs";

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

test("K-SNS BFF allowlist permits UI contract routes and blocks mutation/execute surfaces", () => {
  const allowed = [
    ["GET", ["events"]],
    ["POST", ["events"]],
    ["GET", ["trust", "score"]],
    ["GET", ["incidents", "00000000-0000-4000-8000-000000000001"]],
    ["GET", ["lifecycle", "incidents", "00000000-0000-4000-8000-000000000001"]],
    [
      "GET",
      [
        "lifecycle",
        "incidents",
        "00000000-0000-4000-8000-000000000001",
        "kai-explanation-payload",
      ],
    ],
    ["GET", ["connectors"]],
    ["GET", ["tool-governance"]],
    ["POST", ["decisions", "decision-1", "request-action"]],
    ["POST", ["recommendations", "recommendation-1", "approve"]],
  ];

  for (const [method, path] of allowed) {
    assert.equal(isKsnsBffRequestAllowed(method, path), true, `${method} ${path.join("/")}`);
  }

  const blocked = [
    ["POST", ["actions", "action-1", "execute"]],
    ["POST", ["lifecycle", "actions", "00000000-0000-4000-8000-000000000001", "dispatch"]],
    ["POST", ["lifecycle", "verifications"]],
    ["POST", ["lifecycle", "residual-risk"]],
    ["POST", ["connectors"]],
    ["DELETE", ["events"]],
    ["GET", ["api", "openapi.json"]],
  ];

  for (const [method, path] of blocked) {
    assert.equal(isKsnsBffRequestAllowed(method, path), false, `${method} ${path.join("/")}`);
  }
});
