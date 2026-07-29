import { createServer } from "node:http";

const port = Number.parseInt(process.env.K_SNS_SYNTHETIC_BACKEND_PORT ?? "3011", 10);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  throw new Error("invalid synthetic backend port");
}

const server = createServer((request, response) => {
  const payload = JSON.stringify({
    provenance: "deterministic-synthetic-customer-free",
    customer_data: false,
    path: request.url,
    received_context_version: request.headers["x-kariya-context-version"] ?? null,
    received_tenant: request.headers["x-kariya-tenant-id"] ?? null,
    received_role: request.headers["x-kariya-role"] ?? null,
    authorization_forwarded: "authorization" in request.headers,
    cookie_forwarded: "cookie" in request.headers,
  });
  response.writeHead(200, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  response.end(payload);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`synthetic K-SNS backend listening on 127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
