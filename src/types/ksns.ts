// Shared K-SNS domain types consumed by src/lib/ksnsPlatformClient.ts and the
// (authenticated) pages. Field names mirror the C-009 UI API where available
// and include optional lifecycle fields for newer K-SNS modules that are still
// being wired through the backend.

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type LifecycleStage =
  | "sense"
  | "understand"
  | "decide"
  | "act"
  | "enforce"
  | "verify"
  | "explain";

export interface KsnsEvent {
  event_id: string;
  type: string;
  stage: LifecycleStage;
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
  id?: string;
  case_id: string | null;
  title: string;
  summary?: string;
  severity: Severity;
  state: IncidentState;
  status?: IncidentState | string;
  affected_asset?: string | null;
  affected_user?: string | null;
  affected_device?: string | null;
  source_components?: string[];
  confidence?: number | null;
  action_status?: string | null;
  verification_status?: string | null;
  lifecycle_state?: LifecycleStage | string | null;
  residual_risk?: string | null;
  narrative?: string | null;
  contributing_event_ids?: string[];
  trust_risk_changes?: string[];
  decision_state?: string | null;
  action_record?: string | null;
  evidence_refs?: string[];
  opened_at: string;
  created_at?: string;
  updated_at?: string;
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
  id?: string;
  name: string;
  type: string;
  connector_type?: string;
  source_system?: string;
  status: "connected" | "degraded" | "disconnected" | "pending" | "unsupported";
  health_status?: "healthy" | "degraded" | "disconnected" | "pending" | "unsupported";
  readiness?: "live" | "configured" | "degraded" | "pending" | "unsupported";
  enabled?: boolean;
  auth_status?: "configured" | "missing" | "unknown";
  events_24h: number;
  events_received?: number;
  errors?: number;
  last_event_at: string | null;
  last_seen?: string | null;
  last_ingestion?: string | null;
  last_sync?: string | null;
  supported_telemetry_types?: string[];
  supported_actions?: string[];
}

export type PolicyState = "draft" | "awaiting_approval" | "active" | "retired";

export interface KsnsPolicy {
  policy_id: string;
  name: string;
  description: string;
  state: PolicyState;
  updated_at: string;
}

export type ActionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executed"
  | "dry_run"
  | "failed"
  | "verification_pending"
  | "verified";

export interface KsnsAction {
  action_id: string;
  id?: string;
  incident_id: string | null;
  action_type: string;
  target: string;
  target_entity_id?: string;
  enforcement_surface:
    | "KES"
    | "KEA"
    | "connector"
    | "cloud"
    | "identity"
    | "manual"
    | "unknown";
  decision_mode: "autonomous" | "supervised" | "recommendation" | "monitor_only" | "approval";
  policy_authority: string | null;
  confidence: number | null;
  status: ActionStatus | string;
  dispatch_result: string | null;
  verification_required: boolean | null;
  verification_result: string | null;
  residual_risk: string | null;
  rationale?: string;
  timestamp: string;
  created_at?: string;
}

export interface KsnsSocMetrics {
  incidents?: {
    total?: number;
    open?: number;
    active?: number;
    high_risk?: number;
  };
  actions?: {
    pending_approval?: number;
    pending_verification?: number;
    autonomous?: number;
  };
  trust?: {
    movement?: string;
    risk_movement?: string;
  };
}

export interface KsnsEvidenceRecord {
  evidence_id: string;
  incident_id?: string | null;
  record_type: string;
  summary: string;
  source_system?: string | null;
  timestamp?: string | null;
  normalized_event?: string | null;
  correlation_result?: string | null;
  trust_risk_movement?: string | null;
  decision_record?: string | null;
  action_record?: string | null;
  dispatch_result?: string | null;
  verification_result?: string | null;
  kai_explanation?: string | null;
  residual_risk?: string | null;
}

export interface KsnsToolGovernanceRecord {
  tool_id: string;
  server_name: string;
  tool_name: string;
  category: string;
  enabled: boolean | null;
  last_invocation: string | null;
  invocation_risk: "low" | "medium" | "high" | "critical" | "unknown";
  policy_decision: string | null;
  allow_deny_status: "allow" | "deny" | "approval_required" | "unknown";
  suspicious_activity: string | null;
  misuse_event: string | null;
  related_incident_id: string | null;
  evidence_ref: string | null;
}
