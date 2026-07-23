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
  ["GET", /^policies$/],
  ["POST", new RegExp(`^policies/${SIMPLE_ID_SEGMENT}/request-activation$`)],
];

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
