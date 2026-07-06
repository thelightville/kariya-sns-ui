"use client";

import { useState } from "react";
import { GitBranch } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import ApprovalAction from "@/components/ApprovalAction";
import { useKsnsQuery } from "@/lib/useKsnsQuery";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";
import type { KsnsDecision } from "@/types/ksns";

const STATUS_BADGE: Record<KsnsDecision["status"], string> = {
  awaiting_approval: "badge-warn",
  approved: "badge-ok",
  rejected: "badge-error",
  action_requested: "badge-neutral",
};

export default function DecisionsPage() {
  const decisions = useKsnsQuery(() => ksnsPlatformClient.getDecisions());
  const [overrides, setOverrides] = useState<Record<string, KsnsDecision["status"]>>({});

  if (decisions.status === "loading") {
    return <p className="text-xs text-gray-500">Loading decisions…</p>;
  }

  if (decisions.status === "error") {
    return (
      <EmptyState
        icon={GitBranch}
        title="No connection to the K-SNS API"
        description={decisions.error}
      />
    );
  }

  if (decisions.data.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        title="No decisions yet"
        description="K-SNS decisions produced by the Decide stage will appear here with operator approval state, action-request state, and downstream lifecycle visibility when available."
      />
    );
  }

  return (
    <div className="space-y-3">
      {decisions.data.map((d) => {
        const status = overrides[d.decision_id] ?? d.status;
        return (
          <div key={d.decision_id} className="card flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">{d.summary}</p>
                <span className={`badge ${STATUS_BADGE[status]}`}>
                  {status.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Recommended by {d.recommended_by === "kai" ? "KAI" : "SNS Policy Engine"}
                {d.incident_id ? ` · Incident ${d.incident_id}` : ""}
              </p>
            </div>
            {status === "awaiting_approval" && (
              <div className="flex gap-2">
                <ApprovalAction
                  intent="approve"
                  onAction={async () => {
                    await ksnsPlatformClient.approveDecision(d.decision_id);
                    setOverrides((s) => ({ ...s, [d.decision_id]: "approved" }));
                  }}
                />
                <ApprovalAction
                  intent="reject"
                  onAction={async () => {
                    await ksnsPlatformClient.rejectDecision(d.decision_id);
                    setOverrides((s) => ({ ...s, [d.decision_id]: "rejected" }));
                  }}
                />
                <ApprovalAction
                  intent="request"
                  onAction={async () => {
                    await ksnsPlatformClient.requestDecisionAction(d.decision_id);
                    setOverrides((s) => ({ ...s, [d.decision_id]: "action_requested" }));
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
