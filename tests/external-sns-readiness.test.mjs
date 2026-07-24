import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";

import {
  checkExternalSnsReadiness,
  externalOriginsFromEnv,
  formatExternalSnsReadiness,
} from "../scripts/verify-external-sns-readiness.mjs";

async function startServer(handler) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.equal(typeof address, "object");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    async close() {
      server.closeAllConnections?.();
      server.close();
      await once(server, "close");
    },
  };
}

function compliantHandler(request, response) {
  if (request.url === "/") {
    response.writeHead(307, { location: "/login?next=%2F" }).end();
    return;
  }
  if (request.url === "/overview") {
    response.writeHead(307, { location: "/login?next=%2Foverview" }).end();
    return;
  }
  if (request.url === "/api/ksns/events") {
    response
      .writeHead(401, { "content-type": "application/json" })
      .end(JSON.stringify({ error: "Unauthorized: sign in to K-SNS and try again." }));
    return;
  }
  response.writeHead(404).end();
}

test("external SNS readiness passes only when both regional origins auth-gate pages and BFF", async () => {
  const servers = [
    await startServer(compliantHandler),
    await startServer(compliantHandler),
  ];
  try {
    const result = await checkExternalSnsReadiness({
      origins: servers.map((server) => server.origin),
      requireHttps: false,
      timeoutMs: 500,
    });
    assert.equal(result.ok, true, formatExternalSnsReadiness(result));
    assert.deepEqual(
      result.origins.map((origin) => origin.ok),
      [true, true]
    );
  } finally {
    await Promise.all(servers.map((server) => server.close()));
  }
});

test("external SNS readiness fails if unauthenticated BFF exposes data", async () => {
  const server = await startServer((request, response) => {
    if (request.url === "/api/ksns/events") {
      response.writeHead(200, { "content-type": "application/json" }).end("[]");
      return;
    }
    compliantHandler(request, response);
  });
  try {
    const result = await checkExternalSnsReadiness({
      origins: [server.origin],
      requireHttps: false,
      timeoutMs: 500,
    });
    assert.equal(result.ok, false);
    assert.match(formatExternalSnsReadiness(result), /expected unauthenticated \/api\/ksns\/events to return 401/);
  } finally {
    await server.close();
  }
});

test("external SNS readiness fails on a hanging unauthenticated BFF request", async () => {
  const server = await startServer((request, response) => {
    if (request.url === "/api/ksns/events") return;
    compliantHandler(request, response);
  });
  try {
    const result = await checkExternalSnsReadiness({
      origins: [server.origin],
      requireHttps: false,
      timeoutMs: 75,
    });
    assert.equal(result.ok, false);
    assert.match(formatExternalSnsReadiness(result), /timed out after 75ms/);
  } finally {
    await server.close();
  }
});

test("external SNS verifier keeps public origins as the default live evidence target", () => {
  assert.deepEqual(externalOriginsFromEnv(""), [
    "https://sns.kariya.ng",
    "https://sns.kariya.ca",
  ]);
  assert.deepEqual(externalOriginsFromEnv(" https://sns.kariya.ng , https://sns.kariya.ca "), [
    "https://sns.kariya.ng",
    "https://sns.kariya.ca",
  ]);
});
