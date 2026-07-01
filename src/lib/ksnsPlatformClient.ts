/**
 * ksnsPlatformClient — typed fetch client for the K-SNS C-009 external API.
 *
 * Per ADR-0019 §2/§6, this client calls `NEXT_PUBLIC_KSNS_API_URL` directly
 * from the browser (unlike kariya-central's BFF-proxy pattern). Auth is via
 * the httpOnly `sns_token` cookie, sent automatically by the browser on
 * same-site requests; if the K-SNS API is on a different origin in
 * production, requests are made with `credentials: "include"` and the API
 * must accept the cookie cross-site (see SECURITY.md).
 *
 * The K-SNS backend (kariya-sns) is an early scaffold and is not live in
 * Alpha 1. Every method here fails closed: network errors and non-2xx
 * responses are surfaced as a typed KsnsClientError so pages can render an
 * EmptyState/error state instead of throwing or fabricating data.
 */

import type {
  KsnsEvent,
  KsnsTrustScore,
  KsnsDecision,
  KsnsIncident,
  KsnsRecommendation,
  KsnsExplanation,
  KsnsConnector,
  KsnsPolicy,
} from "@/types/ksns";

const API_BASE = process.env.NEXT_PUBLIC_KSNS_API_URL ?? "";

export class KsnsClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "KsnsClientError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new KsnsClientError(
      "NEXT_PUBLIC_KSNS_API_URL is not configured — K-SNS API is unreachable."
    );
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch (err) {
    throw new KsnsClientError(
      `K-SNS API request failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!res.ok) {
    throw new KsnsClientError(`K-SNS API error ${res.status}: ${path}`, res.status);
  }

  return (await res.json()) as T;
}

export const ksnsPlatformClient = {
  // GET /api/v1/events — Sense/Understand stage event feed
  getEvents: (params?: { severity?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.severity) qs.set("severity", params.severity);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<KsnsEvent[]>(`/events${suffix}`);
  },

  // GET /api/v1/trust/score
  getTrustScore: () => request<KsnsTrustScore>("/trust/score"),

  // Decisions awaiting/given approval (Decide stage). K-SNS recommends —
  // approval/rejection/action-request is always an explicit operator step.
  getDecisions: () => request<KsnsDecision[]>("/decisions"),
  approveDecision: (decisionId: string) =>
    request<KsnsDecision>(`/decisions/${decisionId}/approve`, { method: "POST" }),
  rejectDecision: (decisionId: string) =>
    request<KsnsDecision>(`/decisions/${decisionId}/reject`, { method: "POST" }),
  requestDecisionAction: (decisionId: string) =>
    request<KsnsDecision>(`/decisions/${decisionId}/request-action`, {
      method: "POST",
    }),

  // GET /api/v1/incidents
  getIncidents: () => request<KsnsIncident[]>("/incidents"),

  // KAI-sourced recommendations awaiting approval
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
    request<KsnsRecommendation>(
      `/recommendations/${recommendationId}/request-action`,
      { method: "POST" }
    ),

  // POST /kai/v1/explain — narrative explanations
  getExplanations: (subjectId?: string) =>
    request<KsnsExplanation[]>(
      subjectId ? `/explanations?subject_id=${subjectId}` : "/explanations"
    ),

  // GET /api/v1/connectors — KIF connector status (read-only)
  getConnectors: () => request<KsnsConnector[]>("/connectors"),

  // GET /api/v1/policies — policy CRUD (activation gated behind approval)
  getPolicies: () => request<KsnsPolicy[]>("/policies"),
  requestPolicyActivation: (policyId: string) =>
    request<KsnsPolicy>(`/policies/${policyId}/request-activation`, {
      method: "POST",
    }),
};

export default ksnsPlatformClient;
