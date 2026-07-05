/**
 * ksnsPlatformClient — typed fetch client for the K-SNS C-009 external API.
 *
 * The backend is still converging: the UI-safe C-009 routes return arrays
 * directly, while newer module routes return objects such as {items} or
 * {connectors}. This client normalises those shapes and keeps failures explicit
 * so pages can show unavailable/pending states without fabricating telemetry.
 */

import type {
  KsnsAction,
  KsnsConnector,
  KsnsDecision,
  KsnsEvent,
  KsnsEvidenceRecord,
  KsnsExplanation,
  KsnsIncident,
  KsnsPolicy,
  KsnsRecommendation,
  KsnsSocMetrics,
  KsnsToolGovernanceRecord,
  KsnsTrustScore,
} from "@/types/ksns";

const API_BASE = process.env.NEXT_PUBLIC_KSNS_API_URL ?? "";
const TENANT_ID = process.env.NEXT_PUBLIC_KSNS_TENANT_ID ?? "";
const OPERATOR_ID = process.env.NEXT_PUBLIC_KSNS_OPERATOR_ID ?? "sns-ui-alpha1";

export class KsnsClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "KsnsClientError";
  }
}

function statusMessage(status: number, path: string) {
  if (status === 401) return "Unauthorized: sign in to Console or K-SNS and try again.";
  if (status === 403) return "Forbidden: this operator is not allowed to view this K-SNS surface.";
  if (status === 404) return `Endpoint not implemented or unavailable: ${path}`;
  if (status === 422) return `Tenant, query, or payload is missing for ${path}.`;
  if (status >= 500) return `K-SNS backend is unavailable or returned ${status} for ${path}.`;
  return `K-SNS API error ${status}: ${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new KsnsClientError(
      "NEXT_PUBLIC_KSNS_API_URL is not configured; K-SNS API is unreachable."
    );
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    throw new KsnsClientError(
      `K-SNS API request failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!res.ok) {
    throw new KsnsClientError(statusMessage(res.status, path), res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function withTenant(path: string) {
  if (!TENANT_ID) {
    throw new KsnsClientError(
      "NEXT_PUBLIC_KSNS_TENANT_ID is not configured; tenant-scoped K-SNS modules are unavailable."
    );
  }
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}tenant_id=${encodeURIComponent(TENANT_ID)}`;
}

function normaliseIncident(raw: any): KsnsIncident {
  return {
    incident_id: raw.incident_id ?? raw.id,
    id: raw.id,
    case_id: raw.case_id ?? null,
    title: raw.title ?? raw.summary ?? "Untitled incident",
    summary: raw.summary,
    severity: raw.severity ?? "info",
    state: raw.state ?? raw.status ?? "investigating",
    status: raw.status,
    affected_asset: raw.affected_asset ?? raw.asset ?? null,
    affected_user: raw.affected_user ?? raw.user ?? null,
    affected_device: raw.affected_device ?? raw.device ?? null,
    source_components: raw.source_components ?? raw.sources ?? [],
    confidence: raw.confidence ?? null,
    action_status: raw.action_status ?? null,
    verification_status: raw.verification_status ?? null,
    lifecycle_state: raw.lifecycle_state ?? raw.stage ?? null,
    residual_risk: raw.residual_risk ?? null,
    narrative: raw.narrative ?? null,
    contributing_event_ids: raw.contributing_event_ids ?? [],
    trust_risk_changes: raw.trust_risk_changes ?? [],
    decision_state: raw.decision_state ?? null,
    action_record: raw.action_record ?? null,
    evidence_refs: raw.evidence_refs ?? raw.contributing_event_ids ?? [],
    opened_at: raw.opened_at ?? raw.created_at ?? raw.updated_at ?? "unavailable",
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

function normaliseAction(raw: any): KsnsAction {
  return {
    action_id: raw.action_id ?? raw.id,
    id: raw.id,
    incident_id: raw.incident_id ?? null,
    action_type: raw.action_type ?? "unknown",
    target: raw.target ?? raw.target_entity_id ?? "unknown target",
    target_entity_id: raw.target_entity_id,
    enforcement_surface: raw.enforcement_surface ?? "unknown",
    decision_mode: raw.decision_mode ?? "approval",
    policy_authority: raw.policy_authority ?? null,
    confidence: raw.confidence ?? null,
    status: raw.status ?? "pending",
    dispatch_result: raw.dispatch_result ?? null,
    verification_required: raw.verification_required ?? null,
    verification_result: raw.verification_result ?? null,
    residual_risk: raw.residual_risk ?? null,
    rationale: raw.rationale,
    timestamp: raw.timestamp ?? raw.created_at ?? "unavailable",
    created_at: raw.created_at,
  };
}

function normaliseConnector(raw: any): KsnsConnector {
  const enabled = raw.enabled;
  const lastSeen = raw.last_seen ?? raw.last_event_at ?? raw.last_ingestion ?? raw.last_sync ?? null;
  const status = raw.status ?? (enabled === false ? "disconnected" : lastSeen ? "connected" : "pending");
  return {
    connector_id: raw.connector_id ?? raw.id,
    id: raw.id,
    name: raw.name ?? raw.connector_type ?? raw.type ?? "Unnamed connector",
    type: raw.type ?? raw.connector_type ?? "unknown",
    connector_type: raw.connector_type,
    source_system: raw.source_system ?? raw.connector_type,
    status,
    health_status: raw.health_status ?? (status === "connected" ? "healthy" : status),
    readiness: raw.readiness ?? (status === "connected" ? "configured" : status),
    enabled,
    auth_status: raw.auth_status ?? "unknown",
    events_24h: raw.events_24h ?? raw.events_received ?? 0,
    events_received: raw.events_received,
    errors: raw.errors,
    last_event_at: raw.last_event_at ?? null,
    last_seen: raw.last_seen ?? null,
    last_ingestion: raw.last_ingestion ?? null,
    last_sync: raw.last_sync ?? null,
    supported_telemetry_types: raw.supported_telemetry_types ?? [],
    supported_actions: raw.supported_actions ?? [],
  };
}

export const ksnsPlatformClient = {
  getEvents: (params?: { severity?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.severity) qs.set("severity", params.severity);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<KsnsEvent[]>(`/events${suffix}`);
  },

  getTrustScore: () => request<KsnsTrustScore>("/trust/score"),

  getSocMetrics: () => request<KsnsSocMetrics>(withTenant("/soc/metrics")),

  getDecisions: () => request<KsnsDecision[]>("/decisions"),
  approveDecision: (decisionId: string) =>
    request<KsnsDecision>(`/decisions/${decisionId}/approve`, { method: "POST" }),
  rejectDecision: (decisionId: string) =>
    request<KsnsDecision>(`/decisions/${decisionId}/reject`, { method: "POST" }),
  requestDecisionAction: (decisionId: string) =>
    request<KsnsDecision>(`/decisions/${decisionId}/request-action`, { method: "POST" }),

  getIncidents: async () => {
    const data = await request<KsnsIncident[] | { incidents?: any[] }>("/incidents");
    const items = Array.isArray(data) ? data : data.incidents ?? [];
    return items.map(normaliseIncident);
  },
  getIncident: async (incidentId: string) => {
    const data = await request<any>(`/incidents/${incidentId}`);
    return normaliseIncident(data);
  },
  getIncidentTimeline: (incidentId: string) =>
    request<{ incident_id: string; timeline: any[] }>(`/incidents/${incidentId}/timeline`),
  getIncidentEvidence: (refId: string) => request<any>(`/incidents/evidence/${refId}`),

  getActions: async () => {
    const data = await request<KsnsAction[] | { items?: any[] }>(withTenant("/actions/"));
    const items = Array.isArray(data) ? data : data.items ?? [];
    return items.map(normaliseAction);
  },

  getRecommendations: () => request<KsnsRecommendation[]>("/recommendations"),
  approveRecommendation: (recommendationId: string) =>
    request<KsnsRecommendation>(`/recommendations/${recommendationId}/approve`, {
      method: "POST",
    }),
  rejectRecommendation: (recommendationId: string) =>
    request<KsnsRecommendation>(`/recommendations/${recommendationId}/reject`, {
      method: "POST",
    }),
  requestRecommendationAction: (recommendationId: string) =>
    request<KsnsRecommendation>(`/recommendations/${recommendationId}/request-action`, {
      method: "POST",
    }),

  getExplanations: (subjectId?: string) =>
    request<KsnsExplanation[]>(
      subjectId ? `/explanations?subject_id=${subjectId}` : "/explanations"
    ),

  getConnectors: async () => {
    const data = await request<KsnsConnector[] | { connectors?: any[] }>(
      TENANT_ID ? withTenant("/connectors/") : "/connectors"
    );
    const items = Array.isArray(data) ? data : data.connectors ?? [];
    return items.map(normaliseConnector);
  },

  getToolGovernance: () =>
    request<KsnsToolGovernanceRecord[]>(
      TENANT_ID ? withTenant("/tool-governance") : "/tool-governance"
    ),

  getEvidenceRecords: async () => {
    const [events, explanations] = await Promise.all([
      ksnsPlatformClient.getEvents({ limit: 25 }),
      ksnsPlatformClient.getExplanations(),
    ]);
    const explanationBySubject = new Map(explanations.map((e) => [e.subject_id, e.narrative]));
    return events.map<KsnsEvidenceRecord>((event) => ({
      evidence_id: event.event_id,
      record_type: event.type,
      summary: event.summary,
      source_system: event.source_component,
      timestamp: event.occurred_at,
      normalized_event: `${event.stage} / ${event.severity}`,
      correlation_result: null,
      trust_risk_movement: null,
      decision_record: null,
      action_record: null,
      dispatch_result: null,
      verification_result: null,
      kai_explanation: explanationBySubject.get(event.event_id) ?? null,
      residual_risk: null,
    }));
  },

  getPolicies: () => request<KsnsPolicy[]>("/policies"),
  requestPolicyActivation: (policyId: string) =>
    request<KsnsPolicy>(`/policies/${policyId}/request-activation`, {
      method: "POST",
      body: JSON.stringify({ analyst_id: OPERATOR_ID }),
    }),
};

export default ksnsPlatformClient;
