import { safeNextPath } from "./safeNextPath.mjs";

export const LOGIN_REDIRECT_PATH = "/login";
export const AUTHENTICATED_HOME_PATH = "/overview";

export function loginRedirectLocation(pathname) {
  const next = safeNextPath(pathname);
  return `${LOGIN_REDIRECT_PATH}?next=${encodeURIComponent(next)}`;
}
