/**
 * ksnsPlatformClient — typed fetch client for the K-SNS C-009 and Alpha 1 lifecycle APIs.
 *
 * The client normalises backend response shapes and keeps failures explicit so pages can show
 * unavailable/pending states without fabricating telemetry, action success, or verification success.
 */

import type {
  KsnsAction,
  KsnsConnector,
  KsnsDecision,
  KsnsEvent,
  KsnsEvidenceRecord,
  KsnsExplanation,
  KsnsIncident,
  KsnsKaiExplanationPayload,
  KsnsLifecycleEvidenceBundle,
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

async function requestWithFallback<T>(primaryPath: string, fallbackPath: string): Promise<T> {
  try {
    return await request<T>(primaryPath);
  } catch (err) {
    if (err instanceof KsnsClientError && (err.status === 404 || err.status === 422)) {
      return request<T>(fallbackPath);
    }
    throw err;
  }
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
  const decisions = raw.decisions ?? [];
  const actions = (raw.actions ?? []).map(normaliseAction);
  const verifications = raw.verifications ?? [];
  const residualRisk = raw.residual_risk ?? [];
  const firstDecision = decisions[0];
  const firstAction = actions[0];
  const firstVerification = verifications[0];
  const firstResidual = residualRisk[0];
  const source = raw.incident ?? raw;

  return {
    incident_id: source.incident_id ?? source.id,
    id: source.id,
    case_id: source.case_id ?? null,
    title: source.title ?? source.summary ?? "Untitled incident",
    summary: source.summary,
    severity: source.severity ?? "info",
    state: source.state ?? source.status ?? "investigating",
    status: source.status,
    affected_asset: source.affected_asset ?? source.asset ?? null,
    affected_user: source.affected_user ?? source.user ?? null,
    affected_device: source.affected_device ?? source.device ?? null,
    source_components: source.source_components ?? source.sources ?? [],
    confidence: source.confidence ?? firstDecision?.confidence_score ?? null,
    action_status: source.action_status ?? firstAction?.status ?? null,
    verification_status:
      source.verification_status ?? firstVerification?.verification_status ?? null,
    lifecycle_state: source.lifecycle_state ?? source.stage ?? source.status ?? null,
    residual_risk:
      source.residual_risk ?? firstResidual?.closure_recommendation ?? null,
    narrative: source.narrative ?? null,
    contributing_event_ids: source.contributing_event_ids ?? [],
    trust_risk_changes: source.trust_risk_changes ?? [],
    decision_state:
      source.decision_state ?? firstDecision?.decision_type ?? firstDecision?.recommended_action ?? null,
    action_record: source.action_record ?? firstAction?.action_id ?? null,
    evidence_refs: source.evidence_refs ?? source.contributing_event_ids ?? [],
    opened_at: source.opened_at ?? source.created_at ?? source.updated_at ?? "unavailable",
    created_at: source.created_at,
    updated_at: source.updated_at,
    decisions,
    actions,
    verifications,
    residual_risk_records: residualRisk,
    timeline: raw.timeline ?? [],
  };
}

function normaliseAction(raw: any): KsnsAction {
  return {
    action_id: raw.action_id ?? raw.id,
    id: raw.id,
    incident_id: raw.incident_id ?? null,
    action_type: raw.action_type ?? "unknown",
    target:
      raw.target ?? raw.target_ref ?? raw.target_id ?? raw.target_entity_id ?? "unknown target",
    target_entity_id: raw.target_entity_id ?? raw.target_id,
    enforcement_surface: raw.enforcement_surface ?? "unknown",
    decision_mode: raw.decision_mode ?? "approval",
    policy_authority: raw.policy_authority ?? null,
    confidence: raw.confidence ?? raw.confidence_score ?? null,
    status: raw.status ?? "pending",
    dispatch_result: raw.dispatch_result ?? null,
    verification_required: raw.verification_required ?? null,
    verification_result: raw.verification_result ?? null,
    residual_risk: raw.residual_risk ?? null,
    rationale: raw.rationale ?? raw.dispatch_payload_ref,
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

function summariseCorrelation(correlation: unknown) {
  if (!correlation) return null;
  if (typeof correlation === "string") return correlation;
  if (typeof correlation === "object") {
    const graph = correlation as { nodes?: unknown[]; edges?: unknown[]; reason_codes?: string[] };
    if (graph.reason_codes?.length) return graph.reason_codes.join(", ");
    if (graph.nodes || graph.edges) {
      return `${graph.nodes?.length ?? 0} nodes / ${graph.edges?.length ?? 0} edges`;
    }
  }
  return "Available";
}

export const ksnsPlatformClient = {
  getEvents: (params?: { severity?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.severity) qs.set("severity", params.severity);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<KsnsEvent[]>(`/events${suffix}`);
  },

  ingestDemoEvent: (event: unknown) =>
    request<KsnsEvent>("/events", { method: "POST", body: JSON.stringify(event) }),

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
    const data = await requestWithFallback<any>(
      `/lifecycle/incidents/${incidentId}`,
      `/incidents/${incidentId}`
    );
    return normaliseIncident(data);
  },
  getIncidentTimeline: async (incidentId: string) => {
    const data = await requestWithFallback<any>(
      `/lifecycle/incidents/${incidentId}`,
      `/incidents/${incidentId}/timeline`
    );
    return {
      incident_id: incidentId,
      timeline: Array.isArray(data.timeline) ? data.timeline : [],
    };
  },
  getIncidentEvidence: (refId: string) => request<any>(`/incidents/evidence/${refId}`),
  getLifecycleEvidenceBundle: (incidentId: string) =>
    request<KsnsLifecycleEvidenceBundle>(`/lifecycle/evidence/${incidentId}`),
  getKaiExplanationPayload: (incidentId: string) =>
    request<KsnsKaiExplanationPayload>(`/lifecycle/incidents/${incidentId}/kai-explanation-payload`),

  getActions: async () => {
    const data = await requestWithFallback<KsnsAction[] | { actions?: any[]; items?: any[] }>(
      withTenant("/lifecycle/actions"),
      withTenant("/actions/")
    );
    const items = Array.isArray(data) ? data : data.actions ?? data.items ?? [];
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
    const incidents = await ksnsPlatformClient.getIncidents();
    if (incidents.length > 0) {
      const rows = await Promise.all(
        incidents.map(async (incident) => {
          const [lifecycle, evidence, kaiPayload] = await Promise.allSettled([
            ksnsPlatformClient.getIncident(incident.incident_id),
            ksnsPlatformClient.getLifecycleEvidenceBundle(incident.incident_id),
            ksnsPlatformClient.getKaiExplanationPayload(incident.incident_id),
          ]);
          const lifecycleData = lifecycle.status === "fulfilled" ? lifecycle.value : incident;
          const evidenceData = evidence.status === "fulfilled" ? evidence.value : null;
          const kaiData = kaiPayload.status === "fulfilled" ? kaiPayload.value : null;
          const firstDecision = lifecycleData.decisions?.[0];
          const firstAction = lifecycleData.actions?.[0];
          const firstVerification = lifecycleData.verifications?.[0];
          const firstResidual = lifecycleData.residual_risk_records?.[0];

          return {
            evidence_id: evidenceData?.incident_id ?? incident.incident_id,
            incident_id: incident.incident_id,
            record_type: "incident_lifecycle",
            summary: lifecycleData.title,
            source_system: "K-SNS lifecycle",
            timestamp: lifecycleData.updated_at ?? lifecycleData.created_at,
            normalized_event: (evidenceData?.source_events ?? []).join(", ") || null,
            correlation_result: summariseCorrelation(evidenceData?.correlation_result),
            trust_risk_movement:
              firstDecision?.risk_score == null ? null : `Risk ${firstDecision.risk_score}`,
            decision_record: firstDecision?.decision_id ?? null,
            action_record: firstAction?.action_id ?? null,
            dispatch_result: firstAction?.dispatch_result ?? firstAction?.status ?? null,
            verification_result: firstVerification?.verification_status ?? null,
            kai_explanation: kaiData?.evidence_bundle_ref ?? evidenceData?.kai_explanation_ref ?? null,
            residual_risk:
              firstResidual?.closure_recommendation ?? lifecycleData.residual_risk ?? null,
          } satisfies KsnsEvidenceRecord;
        })
      );
      return rows;
    }

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