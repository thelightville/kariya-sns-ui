import { safeNextPath } from "./safeNextPath.mjs";

export const LOGIN_REDIRECT_PATH = "/login";
export const AUTHENTICATED_HOME_PATH = "/overview";
export const APPROVED_SNS_ORIGINS = Object.freeze([
  "https://sns.kariya.ng",
  "https://sns.kariya.ca",
]);

function trustedAuthOrigin(value, allowLoopback) {
  if (typeof value !== "string" || value.length === 0) return null;

  let candidate;
  try {
    candidate = new URL(value);
  } catch {
    return null;
  }

  if (
    candidate.username ||
    candidate.password ||
    candidate.pathname !== "/" ||
    candidate.search ||
    candidate.hash ||
    candidate.origin !== value
  ) {
    return null;
  }

  if (APPROVED_SNS_ORIGINS.includes(candidate.origin)) {
    return candidate.origin;
  }

  if (
    allowLoopback &&
    candidate.protocol === "http:" &&
    candidate.hostname === "127.0.0.1" &&
    candidate.port
  ) {
    return candidate.origin;
  }

  return null;
}

export function loginRedirectLocation(
  pathname,
  configuredOrigin,
  { allowLoopback = false } = {}
) {
  const origin = trustedAuthOrigin(configuredOrigin, allowLoopback);
  if (!origin) return null;

  const target = new URL(LOGIN_REDIRECT_PATH, origin);
  target.searchParams.set("next", safeNextPath(pathname));
  return target.toString();
}

export function authenticatedHomeLocation(
  configuredOrigin,
  { allowLoopback = false } = {}
) {
  const origin = trustedAuthOrigin(configuredOrigin, allowLoopback);
  return origin ? new URL(AUTHENTICATED_HOME_PATH, origin).toString() : null;
}
