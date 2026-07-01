// Shared K-SNS domain types consumed by src/lib/ksnsPlatformClient.ts and the
// (authenticated) pages. Field names loosely mirror the canonical event/
// decision/incident contracts in kariya-sns/contracts (Python/Pydantic) —
// kept intentionally light for Alpha 1 since the backend is not live yet.

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface KsnsEvent {
  event_id: string;
  type: string;
  stage: "sense" | "understand" | "decide" | "enforce" | "explain";
  severity: Severity;
  summary: string;
  source_component: string;
  occurred_at: string;
}

export interface KsnsTrustScore {
  tenant_id: string;
  overall_score: number;
  tier: "trusted" | "caution" | "untrusted";
  assets_trusted: number;
  assets_caution: number;
  assets_untrusted: number;
  scored_at: string;
}

// A K-SNS decision awaiting or already given operator approval. K-SNS
// recommends; it never marks a decision as self-executed — every decision
// terminates in approved/rejected/action_requested, set by an operator via
// ApprovalAction.
export type DecisionStatus =
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "action_requested";

export interface KsnsDecision {
  decision_id: string;
  incident_id: string | null;
  summary: string;
  recommended_by: "kai" | "sns_policy_engine";
  status: DecisionStatus;
  created_at: string;
}

export type IncidentState =
  | "new"
  | "investigating"
  | "awaiting_approval"
  | "resolved"
  | "closed";

export interface KsnsIncident {
  incident_id: string;
  case_id: string | null;
  title: string;
  severity: Severity;
  state: IncidentState;
  opened_at: string;
}

export interface KsnsRecommendation {
  recommendation_id: string;
  incident_id: string | null;
  title: string;
  narrative: string;
  source: "kai";
  status: DecisionStatus;
  created_at: string;
}

export interface KsnsExplanation {
  explanation_id: string;
  subject_type: "incident" | "trust_change" | "decision";
  subject_id: string;
  narrative: string;
  generated_at: string;
}

export interface KsnsConnector {
  connector_id: string;
  name: string;
  type: string;
  status: "connected" | "degraded" | "disconnected";
  events_24h: number;
  last_event_at: string | null;
}

export type PolicyState = "draft" | "awaiting_approval" | "active" | "retired";

export interface KsnsPolicy {
  policy_id: string;
  name: string;
  description: string;
  state: PolicyState;
  updated_at: string;
}
