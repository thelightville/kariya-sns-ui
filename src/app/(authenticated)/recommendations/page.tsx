"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import ApprovalAction from "@/components/ApprovalAction";
import { useKsnsQuery } from "@/lib/useKsnsQuery";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";
import type { KsnsRecommendation, DecisionStatus } from "@/types/ksns";

const STATUS_BADGE: Record<DecisionStatus, string> = {
  awaiting_approval: "badge-warn",
  approved: "badge-ok",
  rejected: "badge-error",
  action_requested: "badge-neutral",
};

export default function RecommendationsPage() {
  const recs = useKsnsQuery(() => ksnsPlatformClient.getRecommendations());
  const [overrides, setOverrides] = useState<Record<string, DecisionStatus>>({});

  if (recs.status === "loading") {
    return <p className="text-xs text-gray-500">Loading recommendations…</p>;
  }

  if (recs.status === "error") {
    return (
      <EmptyState
        icon={Sparkles}
        title="No connection to the K-SNS API"
        description={recs.error}
      />
    );
  }

  if (recs.data.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No recommendations yet"
        description="KAI-sourced recommendations will appear here for operator approval. KAI recommends — it does not act autonomously."
      />
    );
  }

  return (
    <div className="space-y-3">
      {recs.data.map((r: KsnsRecommendation) => {
        const status = overrides[r.recommendation_id] ?? r.status;
        return (
          <div key={r.recommendation_id} className="card p-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white">{r.title}</p>
              <span className={`badge ${STATUS_BADGE[status]}`}>
                {status.replace(/_/g, " ")}
              </span>
              <span className="badge badge-neutral">KAI</span>
            </div>
            <p className="mt-2 text-xs text-gray-400">{r.narrative}</p>
            {status === "awaiting_approval" && (
              <div className="mt-3 flex gap-2">
                <ApprovalAction
                  intent="approve"
                  onAction={async () => {
                    await ksnsPlatformClient.approveRecommendation(r.recommendation_id);
                    setOverrides((s) => ({ ...s, [r.recommendation_id]: "approved" }));
                  }}
                />
                <ApprovalAction
                  intent="reject"
                  onAction={async () => {
                    await ksnsPlatformClient.rejectRecommendation(r.recommendation_id);
                    setOverrides((s) => ({ ...s, [r.recommendation_id]: "rejected" }));
                  }}
                />
                <ApprovalAction
                  intent="request"
                  onAction={async () => {
                    await ksnsPlatformClient.requestRecommendationAction(r.recommendation_id);
                    setOverrides((s) => ({ ...s, [r.recommendation_id]: "action_requested" }));
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
