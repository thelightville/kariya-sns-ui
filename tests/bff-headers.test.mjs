import assert from "node:assert/strict";
import test from "node:test";
import {
  isKsnsBffRequestAllowed,
  KSNS_BFF_PRODUCTION_ROUTE_INVENTORY,
  KSNS_BFF_UI_READ_ROUTE_INVENTORY,
} from "../src/lib/ksnsBffAllowlist.mjs";
import { stripInboundAuthorityHeaders } from "../src/server/backend/bffContext.mjs";

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
  "forwarded",
  "x-kariya-tenant-id",
  "x-tenant-id",
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

test("BFF strips caller authority and keeps only inert content negotiation headers", () => {
  const headers = stripInboundAuthorityHeaders(hostileInboundHeaders());

  assert.equal(headers.get("accept"), "application/json");
  assert.equal(headers.get("content-type"), "application/json");
  for (const name of blockedHeaders) {
    assert.equal(headers.has(name), false, `forwarded blocked header: ${name}`);
  }
});

test("production BFF exposes the tenant-scoped incident read contract only", () => {
  assert.deepEqual(KSNS_BFF_PRODUCTION_ROUTE_INVENTORY, [
    "GET soc/metrics",
    "GET explanations",
    "GET incidents",
    "GET incidents/{incident_id}",
    "GET incidents/{incident_id}/timeline",
    "GET incidents/evidence/{ref_id}",
    "GET lifecycle/incidents/{incident_id}",
    "GET lifecycle/incidents/{incident_id}/history",
    "GET lifecycle/incidents/{incident_id}/kai-explanation-payload",
    "GET lifecycle/evidence/{incident_id}",
  ]);
  const incidentId = "00000000-0000-4000-8000-000000000001";
  for (const path of [
    ["soc", "metrics"],
    ["explanations"],
    ["incidents"],
    ["incidents", incidentId],
    ["incidents", incidentId, "timeline"],
    ["incidents", "evidence", "event-1"],
    ["lifecycle", "incidents", incidentId],
    ["lifecycle", "incidents", incidentId, "history"],
    ["lifecycle", "incidents", incidentId, "kai-explanation-payload"],
    ["lifecycle", "evidence", incidentId],
  ]) {
    assert.equal(isKsnsBffRequestAllowed("GET", path), true, path.join("/"));
  }
  for (const [method, path] of [
    ["GET", ["events"]],
    ["POST", ["events"]],
    ["PATCH", ["incidents", incidentId, "assignment"]],
    ["PATCH", ["incidents", incidentId, "status"]],
    ["POST", ["actions", "action-1", "approve"]],
    ["GET", ["incidents", "not-a-uuid"]],
  ]) {
    assert.equal(isKsnsBffRequestAllowed(method, path), false);
  }
});

test("BFF UI read inventory lists every read surface explicitly", () => {
  assert.ok(KSNS_BFF_UI_READ_ROUTE_INVENTORY.length >= 28);
  for (const entry of [
    "GET events",
    "GET incidents/{incident_id}/timeline",
    "GET lifecycle/incidents/{incident_id}/history",
    "GET lifecycle/incidents/{incident_id}/kai-explanation-payload",
    "GET connectors/types",
    "GET tool-governance",
    "GET kai-advisory-handoffs/{handoff_id}",
    "GET policy/rules",
  ]) {
    assert.ok(KSNS_BFF_UI_READ_ROUTE_INVENTORY.includes(entry), entry);
  }
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
    ["GET", ["kai-advisory-handoffs"]],
    ["GET", ["policy", "rules"]],
    ["POST", ["decisions", "decision-1", "request-action"]],
    ["POST", ["recommendations", "recommendation-1", "approve"]],
  ];

  for (const [method, path] of allowed) {
    assert.equal(
      isKsnsBffRequestAllowed(method, path, { production: false }),
      true,
      `${method} ${path.join("/")}`
    );
  }

  const blocked = [
    ["POST", ["actions", "action-1", "execute"]],
    ["POST", ["lifecycle", "actions", "00000000-0000-4000-8000-000000000001", "dispatch"]],
    ["POST", ["lifecycle", "verifications"]],
    ["POST", ["lifecycle", "residual-risk"]],
    ["POST", ["kai-advisory-handoffs"]],
    ["GET", ["kai", "v1", "ops", "ksns-handoff"]],
    ["POST", ["connectors"]],
    ["GET", ["policies"]],
    ["POST", ["policies", "policy-1", "request-activation"]],
    ["DELETE", ["events"]],
    ["GET", ["api", "openapi.json"]],
  ];

  for (const [method, path] of blocked) {
    assert.equal(isKsnsBffRequestAllowed(method, path), false, `${method} ${path.join("/")}`);
  }
});
