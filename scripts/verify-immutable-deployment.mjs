import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
const health = readFileSync(new URL("../src/app/api/health/route.ts", import.meta.url), "utf8");
const nextConfig = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");

assert.ok(nextConfig.includes("output: 'standalone'"));
for (const marker of ["org.opencontainers.image.revision", "KARIYA_SOURCE_REVISION", "HEALTHCHECK", "/api/health"]) {
  assert.ok(dockerfile.includes(marker), marker);
}
for (const marker of [
  "StrictHostKeyChecking=yes",
  "UserKnownHostsFile=",
  "KNOWN_HOSTS_SHA256",
  "RUNNER_ATTESTATION_SHA256",
  "persist-credentials: false",
  "K_SNS_TRANSACTION_KMS_KEY_RESOURCE",
  "K_SNS_GCP_WIF_CONFIG_PATH",
  "K_SNS_CLOUD_CLIENT_CERT_PATH",
  "K_SNS_CLOUD_CLIENT_KEY_PATH",
  "org.opencontainers.image.revision",
  ".rollback",
  "prior image digest restored",
]) assert.ok(workflow.includes(marker), marker);

for (const forbidden of ["StrictHostKeyChecking=no", "ssh-keyscan", "172.16.", "secrets.", "latest"]) {
  assert.equal(workflow.includes(forbidden), false, forbidden);
}
assert.ok(health.includes('{ status: "ok" }'));
assert.ok(health.includes('"Cache-Control": "no-store"'));
assert.ok(health.includes('"Referrer-Policy": "no-referrer"'));
assert.equal(workflow.includes("K_SNS_CLOUD_CLIENT_KEY="), false);
assert.equal(workflow.includes("GOOGLE_APPLICATION_CREDENTIALS="), false);

console.log("immutable K-SNS deployment boundary: pass");
