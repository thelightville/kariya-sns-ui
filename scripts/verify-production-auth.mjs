import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sourceDir = join(root, "src");
const failures = [];
const packageManifest = readFileSync(join(root, "package.json"), "utf8");

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
  if (text.includes("alpha1-stub-session")) {
    failures.push(`${file}: stub session token must not be used`);
  }
  if (text.includes("NEXT_PUBLIC_KSNS_API_URL")) {
    failures.push(`${file}: NEXT_PUBLIC_KSNS_API_URL must not be used`);
  }
}

const read = (...parts) => readFileSync(join(sourceDir, ...parts), "utf8");
const loginRoute = read("app", "api", "auth", "login", "route.ts");
const mfaRoute = read("app", "api", "auth", "mfa", "route.ts");
const startRoute = read("app", "api", "auth", "exchange", "start", "route.ts");
const callbackRoute = read("app", "api", "auth", "exchange", "callback", "route.ts");
const loginPage = read("app", "login", "page.tsx");
const proxy = read("proxy.ts");
const runtime = read("server", "auth", "runtimeComposition.mjs");
const productionConfig = read("server", "auth", "productionConfig.mjs");
const cloudClient = read("server", "auth", "cloudMtlsClient.mjs");
const custody = read("server", "auth", "regionalEnvelopeKeyProvider.mjs");
const syntheticReview = read("server", "auth", "syntheticReviewRuntime.mjs");

for (const [label, text] of [["login", loginRoute], ["mfa", mfaRoute]]) {
  for (const forbidden of [
    "KARIYA_CLOUD_AUTH_BASE_URL",
    "/cloud/login",
    "/cloud/mfa/verify",
    "access_token",
    "mfa_token",
    "password",
  ]) {
    if (text.includes(forbidden)) failures.push(`${label} route retains ${forbidden}`);
  }
  if (!text.includes("status: 410") || !text.includes("Direct K-SNS credential")) {
    failures.push(`${label} route must fail closed with retired credential guidance`);
  }
}

if (
  !loginPage.includes("/api/auth/exchange/start") ||
  /type="password"|\/api\/auth\/mfa|sessionStore/u.test(loginPage)
) {
  failures.push("login page must use only the Cloud exchange start route");
}
if (
  !startRoute.includes("authRuntime.exchange.start") ||
  !callbackRoute.includes('keys.join(",") !== "code,state"') ||
  !callbackRoute.includes("hostLocalSessionCookie")
) {
  failures.push("exact start/callback composition is required");
}
if (
  !proxy.includes("await authRuntime.sessions.authorize") ||
  /!token\)\s*return\s+NextResponse\.next/u.test(proxy)
) {
  failures.push("Proxy must require fresh Cloud session authority");
}
for (const required of [
  "httpOnly: true",
  "secure: true",
  'sameSite: "lax"',
  "maxAge",
]) {
  if (!runtime.includes(required)) failures.push(`host-local cookie missing ${required}`);
}
if (/domain\s*:/iu.test(runtime)) {
  failures.push("host-local sns_token must not set Domain");
}
if (!runtime.includes("unavailableTransactionStore()") ||
    !runtime.includes("unavailableSessionIntrospector()") ||
    !runtime.includes("productionRuntimeRequested")) {
  failures.push("production composition must remain unavailable by default");
}
for (const required of [
  "K_SNS_AUTH_RUNTIME !== PRODUCTION_RUNTIME_MODE",
  "CREDENTIALS_DIRECTORY",
  "K_SNS_TRANSACTION_KEK_ID",
  "K_SNS_TRANSACTION_KEK_CURRENT_VERSION",
  "K_SNS_TRANSACTION_KEK_PREVIOUS_VERSION",
  "K_SNS_CLOUD_CLIENT_KEY_PATH",
  "K_SNS_CLOUD_CA_BUNDLE_PATH",
]) {
  if (!productionConfig.includes(required)) failures.push(`production config missing ${required}`);
}
for (const required of [
  'minVersion: "TLSv1.3"',
  'maxVersion: "TLSv1.3"',
  "maxCachedSessions: 0",
  "keepAlive: false",
]) {
  if (!cloudClient.includes(required)) failures.push(`mTLS client missing ${required}`);
}
for (const required of [
  "createSecretKey",
  "SYSTEMD_CURRENT_CREDENTIAL",
  "PREAUTHORIZATION_TENANT_SCOPE",
  "TRANSACTION_WRAP_PURPOSE",
  "expectedUid < 1",
  "fileMetadata.uid !== expectedUid",
  "(fileMetadata.mode & 0o777) !== 0o400",
  "plaintext.fill(0)",
]) {
  if (!custody.includes(required)) failures.push(`systemd custody missing ${required}`);
}
if (/process\.env|console\.|\.export\s*\(/u.test(custody)) {
  failures.push("custody provider must not read key environment values, log, or export keys");
}
for (const required of [
  'NODE_ENV !== "development"',
  'K_SNS_AUTH_RUNTIME === "production"',
  'K_SNS_SYNTHETIC_REVIEW !== SYNTHETIC_REVIEW_MODE',
  'KARIYA_SNS_ALLOW_LOOPBACK_ORIGIN !== "1"',
  'parsed.hostname === "127.0.0.1"',
  'parsed.port !== ""',
]) {
  if (!syntheticReview.includes(required)) {
    failures.push(`synthetic review gate missing ${required}`);
  }
}
for (const forbidden of [
  "request.headers",
  "x-forwarded-host",
  "forwarded",
  "NEXT_PUBLIC",
  "https://sns.kariya.ng",
  "https://sns.kariya.ca",
]) {
  if (syntheticReview.toLowerCase().includes(forbidden.toLowerCase())) {
    failures.push(`synthetic review runtime must not trust or target ${forbidden}`);
  }
}

if (packageManifest.includes("@google-cloud/kms")) {
  failures.push("rejected GCP KMS dependency remains");
}
for (const forbidden of [
  "@google-cloud/kms",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "K_SNS_TRANSACTION_KMS_KEY_RESOURCE",
  "K_SNS_GCP_WIF_CONFIG_PATH",
]) {
  if (custody.includes(forbidden) || productionConfig.includes(forbidden)) {
    failures.push(`rejected GCP custody marker remains: ${forbidden}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("production-auth verification passed");
