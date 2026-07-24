const UUID_SEGMENT = "[0-9a-fA-F-]{32,36}";
const SIMPLE_ID_SEGMENT = "[^/]+";

const ALLOWED_ROUTES = [
  ["GET", /^events$/],
  ["POST", /^events$/],
  ["GET", /^trust\/score$/],
  ["GET", /^trust\/risk\/[^/]+\/[^/]+$/],
  ["GET", /^trust\/risk\/[^/]+\/[^/]+\/history$/],
  ["GET", /^trust\/risk\/[^/]+\/[^/]+\/contributors$/],
  ["GET", /^trust\/movement-summary$/],
  ["GET", /^correlations\/events\/[^/]+$/],
  ["GET", /^soc\/metrics$/],
  ["GET", /^decisions$/],
  ["POST", new RegExp(`^decisions/${SIMPLE_ID_SEGMENT}/(approve|reject|request-action)$`)],
  ["GET", /^recommendations$/],
  ["POST", new RegExp(`^recommendations/${SIMPLE_ID_SEGMENT}/(approve|reject|request-action)$`)],
  ["GET", /^explanations$/],
  ["GET", /^kai-advisory-handoffs$/],
  ["GET", /^kai-advisory-handoffs\/[^/]+$/],
  ["GET", /^incidents$/],
  ["GET", new RegExp(`^incidents/${UUID_SEGMENT}$`)],
  ["GET", new RegExp(`^incidents/${UUID_SEGMENT}/timeline$`)],
  ["GET", /^incidents\/evidence\/[^/]+$/],
  ["GET", /^actions\/?$/],
  ["POST", new RegExp(`^actions/${SIMPLE_ID_SEGMENT}/(approve|reject)$`)],
  ["GET", /^lifecycle\/actions$/],
  ["GET", new RegExp(`^lifecycle/actions/${UUID_SEGMENT}$`)],
  ["GET", new RegExp(`^lifecycle/incidents/${UUID_SEGMENT}$`)],
  ["GET", new RegExp(`^lifecycle/incidents/${UUID_SEGMENT}/decisions$`)],
  ["GET", new RegExp(`^lifecycle/incidents/${UUID_SEGMENT}/kai-explanation-payload$`)],
  ["GET", new RegExp(`^lifecycle/evidence/${UUID_SEGMENT}$`)],
  ["GET", /^connectors\/?$/],
  ["GET", /^connectors\/types$/],
  ["GET", new RegExp(`^connectors/${UUID_SEGMENT}/health$`)],
  ["GET", /^tool-governance$/],
  ["GET", /^policy\/rules$/],
  ["POST", new RegExp(`^policies/${SIMPLE_ID_SEGMENT}/request-activation$`)],
];

export const KSNS_BFF_UI_READ_ROUTE_INVENTORY = Object.freeze([
  "GET events",
  "GET trust/score",
  "GET trust/risk/{entity_type}/{entity_id}",
  "GET trust/risk/{entity_type}/{entity_id}/history",
  "GET trust/risk/{entity_type}/{entity_id}/contributors",
  "GET trust/movement-summary",
  "GET correlations/events/{event_id}",
  "GET soc/metrics",
  "GET decisions",
  "GET recommendations",
  "GET explanations",
  "GET kai-advisory-handoffs",
  "GET kai-advisory-handoffs/{handoff_id}",
  "GET incidents",
  "GET incidents/{incident_id}",
  "GET incidents/{incident_id}/timeline",
  "GET incidents/evidence/{ref_id}",
  "GET actions",
  "GET lifecycle/actions",
  "GET lifecycle/actions/{action_id}",
  "GET lifecycle/incidents/{incident_id}",
  "GET lifecycle/incidents/{incident_id}/decisions",
  "GET lifecycle/incidents/{incident_id}/kai-explanation-payload",
  "GET lifecycle/evidence/{incident_id}",
  "GET connectors",
  "GET connectors/types",
  "GET connectors/{config_id}/health",
  "GET tool-governance",
  "GET policy/rules",
]);

export function normalizeKsnsBffPath(pathSegments) {
  return pathSegments.filter(Boolean).join("/").replace(/^\/+|\/+$/g, "");
}

export function isKsnsBffRequestAllowed(method, pathSegments) {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = normalizeKsnsBffPath(pathSegments);
  return ALLOWED_ROUTES.some(
    ([allowedMethod, pattern]) =>
      allowedMethod === normalizedMethod && pattern.test(normalizedPath)
  );
}
