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

export interface KsnsLifecycleStatus {
  sense?: string;
  understand?: string;
  decide?: string;
  act?: string;
  verify?: string;
  explain?: string;
  residual_risk?: string;
  dispatch_status?: string;
  verification_status?: string;
  honesty?: {
    dispatch_success_fabricated?: boolean;
    verification_success_fabricated?: boolean;
    kai_live_required?: boolean;
  };
}

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
  lifecycle_status?: KsnsLifecycleStatus | null;
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
  decisions?: KsnsLifecycleDecision[];
  actions?: KsnsAction[];
  verifications?: KsnsVerification[];
  residual_risk_records?: KsnsResidualRisk[];
  timeline?: KsnsTimelineEntry[];
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

export interface KsnsKaiAdvisoryHandoff {
  handoff_id: string;
  assessment_id: string;
  incident_id: string | null;
  decision_id: string | null;
  correlation_id: string | null;
  source_service: string;
  source_response_id: string | null;
  severity: string | null;
  confidence: {
    score: number;
    band: "high" | "medium" | "low" | string;
  };
  uncertainty_reasons: string[];
  evidence: {
    status: "present" | "partial" | "absent" | string;
    evidence_refs: string[];
    reference_count: number;
  };
  recommended_actions: string[];
  advisory_summary: string;
  review: {
    required: boolean;
    state: "pending" | "completed" | string;
    reasons: string[];
  };
  runtime: {
    availability: "available" | "degraded" | "unavailable" | string;
    detail: string;
  };
  provenance: {
    kai_version: string;
    model_version: string;
    source_service: string;
    source_response_id: string | null;
    contract_version: string;
  };
  unresolved_gates: string[];
  created_at: string;
  advisory_only: true;
  system_of_record: "kariya-sns";
  decision_authority: "kariya-sns";
  orchestration_owner: "kariya-sns";
  enforcement_lifecycle_owner: "kariya-sns";
  execution_status: "advisory_only" | "review_required" | string;
  verification_status: "not_claimed" | string;
  private_payload_available: false;
  browser_to_kai_allowed: false;
}

export interface KsnsKaiAdvisoryHandoffList {
  tenant_id: string;
  count: number;
  filters: Record<string, string | null>;
  handoffs: KsnsKaiAdvisoryHandoff[];
  boundary: {
    kai_role: "advisory_reasoning_only";
    system_of_record: "kariya-sns";
    browser_to_kai_allowed: false;
    direct_enforcement_allowed: false;
  };
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
  enforcement_surface: string;
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


export interface KsnsLifecycleDecision {
  decision_id: string;
  decision_type?: string;
  decision_mode?: string;
  policy_authority?: string | null;
  confidence_score?: number | null;
  risk_score?: number | null;
  reason_codes?: string[];
  recommended_action?: string | null;
  approved_action?: string | null;
  executed_action?: string | null;
  blocked_reason?: string | null;
  created_at?: string;
}

export interface KsnsVerification {
  verification_id: string;
  action_id?: string | null;
  verification_type?: string;
  verification_status?: string;
  verification_source?: string;
  expected_result?: string;
  observed_result?: string | null;
  evidence_refs?: string[];
  verified_at?: string | null;
}

export interface KsnsResidualRisk {
  risk_id: string;
  pre_action_risk?: number;
  post_action_risk?: number;
  risk_delta?: number;
  remaining_indicators?: string[];
  remaining_exposure?: string;
  required_follow_up?: string[];
  business_impact?: string | null;
  closure_recommendation?: string;
}

export interface KsnsTimelineEntry {
  stage?: string;
  event_type?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  occurred_at?: string;
}

export interface KsnsLifecycleEvidenceBundle {
  tenant_id: string;
  incident_id: string;
  source_events: string[];
  correlation_result: unknown;
  decision_refs: string[];
  action_refs: string[];
  verification_refs: string[];
  kai_explanation_ref: string | null;
  lifecycle_status?: KsnsLifecycleStatus | null;
  evidence_lifecycle?: KsnsEvidenceLifecycleStage[];
  missing_stages?: string[];
  integrity?: KsnsEvidenceLifecycleIntegrity;
  ownership?: KsnsEvidenceLifecycleOwnership;
  generated_at: string;
}

export interface KsnsEvidenceLifecycleStage {
  stage:
    | "source_event"
    | "incident"
    | "kai_advisory"
    | "decision"
    | "proposed_action"
    | "approval_review"
    | "execution_evidence"
    | "verification"
    | "residual_risk"
    | string;
  state: string;
  available: boolean;
  record?: Record<string, unknown> | null;
  missing_reason?: string | null;
}

export interface KsnsEvidenceLifecycleIntegrity {
  tenant_scoped: boolean;
  conflicting_correlation: boolean;
  conflicting_kai_handoff_ids: string[];
  kai_advisory_is_decision: false;
  action_execution_fabricated: false;
  verification_success_fabricated: false;
  private_payloads_exposed: false;
}

export interface KsnsEvidenceLifecycleOwnership {
  incident_system_of_record: "kariya-sns";
  decision_authority: "kariya-sns";
  action_lifecycle_owner: "kariya-sns";
  enforcement_owner: string;
  kai_role: "advisory_reasoning_only";
}

export interface KsnsKaiExplanationPayload {
  request_type: string;
  incident_summary: Record<string, unknown>;
  decision_rationale: KsnsLifecycleDecision[];
  action_justification: KsnsAction[];
  verification_result: KsnsVerification[];
  residual_risk: KsnsResidualRisk[];
  evidence_bundle_ref: string;
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
  lifecycle_status?: string | null;
  lifecycle_chain?: KsnsEvidenceLifecycleStage[];
  missing_stages?: string[];
  integrity?: KsnsEvidenceLifecycleIntegrity | null;
  ownership?: KsnsEvidenceLifecycleOwnership | null;
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
