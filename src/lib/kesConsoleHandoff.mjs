export const KES_CONSOLE_REVIEW_PATH = "/products/kes/response-orchestration";

export const KES_CONSOLE_ORIGINS = Object.freeze({
  "sns.kariya.ng": "https://console.kariya.ng",
  "sns.kariya.ca": "https://console.kariya.ca",
});

const OPAQUE_LOOKUP_HINT = /^[A-Za-z0-9._:-]{1,128}$/;

function isOpaqueLookupHint(value) {
  return typeof value === "string" && OPAQUE_LOOKUP_HINT.test(value);
}

export function isKesTargetedAction(enforcementSurface) {
  return (
    typeof enforcementSurface === "string" &&
    enforcementSurface.trim().toLowerCase() === "kes"
  );
}

export function buildKesConsoleReviewUrl({ hostname, actionId, incidentId }) {
  const consoleOrigin = Object.prototype.hasOwnProperty.call(
    KES_CONSOLE_ORIGINS,
    hostname
  )
    ? KES_CONSOLE_ORIGINS[hostname]
    : null;
  if (
    !consoleOrigin ||
    !isOpaqueLookupHint(actionId) ||
    !isOpaqueLookupHint(incidentId)
  ) {
    return null;
  }

  const target = new URL(KES_CONSOLE_REVIEW_PATH, consoleOrigin);
  target.searchParams.set("source", "ksns");
  target.searchParams.set("action_id", actionId);
  target.searchParams.set("incident_id", incidentId);
  return target.toString();
}
