import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sourceDir = join(root, "src");
const failures = [];

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) entries.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx|mjs)$/u.test(name)) entries.push(full);
  }
  return entries;
}

for (const file of walk(sourceDir)) {
  const text = readFileSync(file, "utf8");
  if (text.includes("NEXT_PUBLIC_KSNS_API_URL")) {
    failures.push(`${file}: NEXT_PUBLIC_KSNS_API_URL must not be used`);
  }
}

const staticDir = join(root, ".next", "static");
const forbiddenClientMarkers = [
  "NEXT_PUBLIC_KSNS_API_URL",
  "K_SNS_BASE_URL",
  "K_SNS_BFF_UPSTREAM_TIMEOUT_MS",
  "K_SNS_TENANT_ID",
  "KARIYA_CLOUD_AUTH_BASE_URL",
  "K_SNS_TRANSACTION_DATABASE_URL",
  "K_SNS_TRANSACTION_KEK_ID",
  "K_SNS_TRANSACTION_KEK_CURRENT_VERSION",
  "K_SNS_TRANSACTION_KEK_PREVIOUS_VERSION",
  "CREDENTIALS_DIRECTORY",
  "K_SNS_CLOUD_CLIENT_KEY_PATH",
  "K_SNS_CLOUD_CA_BUNDLE_PATH",
  "alpha1-stub-session",
];

if (!existsSync(staticDir)) {
  failures.push("built client bundle is required before public-bff verification");
} else {
  for (const file of walk(staticDir)) {
    const text = readFileSync(file, "utf8");
    for (const marker of forbiddenClientMarkers) {
      if (text.includes(marker)) failures.push(`${file}: forbidden client marker ${marker}`);
    }
  }
}

const client = readFileSync(join(sourceDir, "lib", "ksnsPlatformClient.ts"), "utf8");
if (!client.includes('const API_BASE = "/api/ksns";')) {
  failures.push("ksnsPlatformClient must use same-origin /api/ksns");
}

const route = readFileSync(
  join(sourceDir, "app", "api", "ksns", "[...path]", "route.ts"),
  "utf8"
);
for (const required of [
  "await authRuntime.sessions.authorize",
  "buildBffContext",
  "validateBffContext",
  "stripInboundAuthorityHeaders",
  "K_SNS_BFF_UPSTREAM_TIMEOUT_MS",
  "AbortController",
  "clearTimeout(timeout)",
]) {
  if (!route.includes(required)) failures.push(`BFF route missing ${required}`);
}
for (const forbidden of [
  "K_SNS_TENANT_ID",
  "buildBffHeaders",
  "Authorization",
  "request.nextUrl.searchParams",
  "Bearer ",
]) {
  if (route.includes(forbidden)) failures.push(`BFF route retains forbidden authority: ${forbidden}`);
}
if (!route.includes("process.env.K_SNS_BASE_URL")) {
  failures.push("BFF route must keep the backend location server-only");
}

const context = readFileSync(
  join(sourceDir, "server", "backend", "bffContext.mjs"),
  "utf8"
);
if (
  !context.includes('export const BFF_CONTEXT_VERSION = "ksns.bff-context.v1"') ||
  !context.includes('Object.freeze(["accept", "content-type"])')
) {
  failures.push("BFF context must retain exact version and inbound allowlist");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("public-bff verification passed");
