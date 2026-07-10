import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sourceDir = join(root, "src");
const failures = [];

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      entries.push(...walk(full));
    } else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
      entries.push(full);
    }
  }
  return entries;
}

for (const file of walk(sourceDir)) {
  const text = readFileSync(file, "utf8");
  if (text.includes("alpha1-stub-session")) {
    failures.push(`${file}: stub session token must not be used`);
  }
  if (/always\s+["']?succeeds/i.test(text)) {
    failures.push(`${file}: auth route must not document an always-success path`);
  }
  if (text.includes("NEXT_PUBLIC_KSNS_API_URL")) {
    failures.push(`${file}: NEXT_PUBLIC_KSNS_API_URL must not be used`);
  }
}

const loginRoutePath = join(sourceDir, "app", "api", "auth", "login", "route.ts");
const mfaRoutePath = join(sourceDir, "app", "api", "auth", "mfa", "route.ts");
const loginPagePath = join(sourceDir, "app", "login", "page.tsx");

const loginRoute = readFileSync(loginRoutePath, "utf8");
if (!loginRoute.includes("process.env.KARIYA_CLOUD_AUTH_BASE_URL")) {
  failures.push("login route must use server-side KARIYA_CLOUD_AUTH_BASE_URL");
}
if (!loginRoute.includes("/cloud/login")) {
  failures.push("login route must proxy to /cloud/login");
}
if (!loginRoute.includes("mfa_required") || !loginRoute.includes("mfa_token")) {
  failures.push("login route must preserve MFA challenge flow without setting a session cookie");
}

if (!existsSync(mfaRoutePath)) {
  failures.push("MFA route is required");
} else {
  const mfaRoute = readFileSync(mfaRoutePath, "utf8");
  if (!mfaRoute.includes("process.env.KARIYA_CLOUD_AUTH_BASE_URL")) {
    failures.push("MFA route must use server-side KARIYA_CLOUD_AUTH_BASE_URL");
  }
  if (!mfaRoute.includes("/cloud/mfa/verify")) {
    failures.push("MFA route must proxy to /cloud/mfa/verify");
  }
  if (!mfaRoute.includes("access_token")) {
    failures.push("MFA route must set a session only after a full access token is returned");
  }
}

const loginPage = readFileSync(loginPagePath, "utf8");
if (!loginPage.includes("/api/auth/mfa") || !loginPage.includes("mfa_required")) {
  failures.push("login page must support MFA challenge completion");
}
if (/local\s+stub/i.test(loginPage) || /Alpha\s+1\s+baseline/i.test(loginPage)) {
  failures.push("login page must not present local stub auth as the public path");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("production-auth verification passed");
