import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
const health = readFileSync(new URL("../src/app/api/health/route.ts", import.meta.url), "utf8");
const nextConfig = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
const dropIn = readFileSync(
  new URL(
    "../deploy/systemd/kariya-sns-ui.service.d/20-envelope-credentials.conf.example",
    import.meta.url
  ),
  "utf8"
);
const dockerignore = readFileSync(new URL("../.dockerignore", import.meta.url), "utf8");

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
  "K_SNS_TRANSACTION_KEK_ID",
  "K_SNS_TRANSACTION_KEK_CURRENT_VERSION",
  "K_SNS_TRANSACTION_KEK_PREVIOUS_VERSION",
  "LoadCredentialEncrypted",
  "K_SNS_CLOUD_CLIENT_CERT_PATH",
  "K_SNS_CLOUD_CLIENT_KEY_PATH",
  "K_SNS_CLOUD_MTLS_TRANSPORT_ORIGIN",
  "K_SNS_CLOUD_MTLS_SERVER_NAME",
  "org.opencontainers.image.revision",
  ".rollback",
  "prior image digest restored",
]) assert.ok(workflow.includes(marker), marker);

for (const marker of [
  "LoadCredentialEncrypted=ksns-transaction-kek-current",
  "LoadCredentialEncrypted=ksns-transaction-kek-previous",
  "UMask=0077",
  "NoNewPrivileges=true",
]) assert.ok(dropIn.includes(marker), marker);

for (const marker of ["*.cred", "credstore.encrypted", "credentials"]) {
  assert.ok(dockerignore.includes(marker), marker);
}

for (const forbidden of [
  "StrictHostKeyChecking=no",
  "ssh-keyscan",
  "172.16.",
  "secrets.",
  "latest",
  "@google-cloud/kms",
]) {
  assert.equal(workflow.includes(forbidden), false, forbidden);
}
assert.ok(health.includes('{ status: "ok" }'));
assert.ok(health.includes('"Cache-Control": "no-store"'));
assert.ok(health.includes('"Referrer-Policy": "no-referrer"'));
for (const rejectedAssignment of [
  "K_SNS_TRANSACTION_KMS_KEY_RESOURCE=",
  "K_SNS_GCP_WIF_CONFIG_PATH=",
  "GOOGLE_APPLICATION_CREDENTIALS=",
  "K_SNS_CLOUD_CLIENT_KEY=",
]) {
  assert.equal(workflow.includes(rejectedAssignment), false, rejectedAssignment);
}
assert.equal(dropIn.includes("Environment=K_SNS_TRANSACTION_KEK"), false);

console.log("immutable K-SNS deployment boundary: pass");
