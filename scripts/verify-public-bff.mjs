import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sourceDir = join(root, "src");

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

const failures = [];
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
  "K_SNS_TENANT_ID",
  "KARIYA_CLOUD_AUTH_BASE_URL",
  "alpha1-stub-session",
];

if (!existsSync(staticDir)) {
  failures.push("built client bundle is required before public-bff verification");
} else {
  for (const file of walk(staticDir)) {
    const text = readFileSync(file, "utf8");
    for (const marker of forbiddenClientMarkers) {
      if (text.includes(marker)) {
        failures.push(`${file}: forbidden client marker ${marker}`);
      }
    }
  }
}

const client = readFileSync(join(sourceDir, "lib", "ksnsPlatformClient.ts"), "utf8");
if (!client.includes('const API_BASE = "/api/ksns";')) {
  failures.push("ksnsPlatformClient must use same-origin /api/ksns");
}

const route = readFileSync(join(sourceDir, "app", "api", "ksns", "[...path]", "route.ts"), "utf8");
if (!route.includes("process.env.K_SNS_BASE_URL")) {
  failures.push("BFF route must use server-side K_SNS_BASE_URL");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("public-bff verification passed");
