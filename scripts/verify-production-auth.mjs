import { readFileSync, readdirSync, statSync } from "node:fs";
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
  !startRoute.includes("runtime.exchange.start") ||
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
    !runtime.includes("unavailableSessionIntrospector()")) {
  failures.push("production composition must remain unavailable by default");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("production-auth verification passed");
