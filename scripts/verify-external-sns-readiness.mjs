import { fileURLToPath } from "node:url";

export const DEFAULT_EXTERNAL_SNS_ORIGINS = Object.freeze([
  "https://sns.kariya.ng",
  "https://sns.kariya.ca",
]);

const DEFAULT_TIMEOUT_MS = 8_000;
const PAGE_REDIRECT_CHECKS = Object.freeze([
  ["/", "/login?next=%2F"],
  ["/overview", "/login?next=%2Foverview"],
]);

function normalizeOrigin(value, { requireHttps }) {
  const url = new URL(value);
  if (requireHttps && url.protocol !== "https:") {
    throw new Error(`${value} must use https for external SNS verification`);
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error(`${value} must be an origin without credentials, path, query, or fragment`);
  }
  return url.origin;
}

export function externalOriginsFromEnv(value = process.env.SNS_EXTERNAL_ORIGINS) {
  if (!value) return [...DEFAULT_EXTERNAL_SNS_ORIGINS];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function checkLoginRedirect(response, origin, expectedLocation) {
  const location = response.headers.get("location");
  const expectedAbsolute = `${origin}${expectedLocation}`;
  if (![307, 308].includes(response.status)) {
    return `expected login redirect status 307/308, received ${response.status}`;
  }
  if (location !== expectedLocation && location !== expectedAbsolute) {
    return `expected location ${expectedLocation} or ${expectedAbsolute}, received ${location ?? "<missing>"}`;
  }
  return null;
}

async function runCheck(check) {
  try {
    const response = await check.run();
    const error = check.validate(response);
    return {
      name: check.name,
      ok: error === null,
      status: response.status,
      location: response.headers.get("location") ?? null,
      error,
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      status: null,
      location: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function verifyOrigin(origin, { fetchImpl, timeoutMs }) {
  const requestOptions = {
    method: "GET",
    redirect: "manual",
    headers: {
      accept: "application/json,text/html;q=0.9,*/*;q=0.8",
      "user-agent": "kariya-sns-external-readiness/1.0",
    },
  };
  const fetchUrl = (pathname) =>
    fetchWithTimeout(fetchImpl, `${origin}${pathname}`, requestOptions, timeoutMs);
  const checks = [
    ...PAGE_REDIRECT_CHECKS.map(([pathname, expectedLocation]) => ({
      name: `auth redirect ${pathname}`,
      run: () => fetchUrl(pathname),
      validate: (response) => checkLoginRedirect(response, origin, expectedLocation),
    })),
    {
      name: "unauthenticated BFF events gate",
      run: () => fetchUrl("/api/ksns/events"),
      validate: (response) =>
        response.status === 401
          ? null
          : `expected unauthenticated /api/ksns/events to return 401, received ${response.status}`,
    },
  ];
  const results = [];
  for (const check of checks) results.push(await runCheck(check));
  return {
    origin,
    ok: results.every((result) => result.ok),
    checks: results,
  };
}

export async function checkExternalSnsReadiness({
  origins = externalOriginsFromEnv(),
  timeoutMs = Number(process.env.SNS_EXTERNAL_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  fetchImpl = globalThis.fetch,
  requireHttps = true,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("global fetch is required for external SNS verification");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error("SNS_EXTERNAL_TIMEOUT_MS must be a positive integer");
  }
  const normalizedOrigins = origins.map((origin) => normalizeOrigin(origin, { requireHttps }));
  const originResults = [];
  for (const origin of normalizedOrigins) {
    originResults.push(await verifyOrigin(origin, { fetchImpl, timeoutMs }));
  }
  return {
    ok: originResults.every((result) => result.ok),
    origins: originResults,
  };
}

export function formatExternalSnsReadiness(result) {
  const lines = [];
  for (const origin of result.origins) {
    lines.push(`${origin.ok ? "PASS" : "FAIL"} ${origin.origin}`);
    for (const check of origin.checks) {
      const suffix = check.ok ? "" : ` - ${check.error}`;
      lines.push(`  ${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.status ?? "no response"}${suffix}`);
    }
  }
  return lines.join("\n");
}

async function main() {
  const result = await checkExternalSnsReadiness();
  const output = formatExternalSnsReadiness(result);
  if (result.ok) {
    console.log(output);
    return;
  }
  console.error(output);
  process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
