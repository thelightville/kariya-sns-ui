"use client";

import { useState } from "react";
import { FileCog } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import ApprovalAction from "@/components/ApprovalAction";
import { useKsnsQuery } from "@/lib/useKsnsQuery";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";
import type { PolicyState } from "@/types/ksns";

const STATE_BADGE: Record<PolicyState, string> = {
  draft: "badge-neutral",
  awaiting_approval: "badge-warn",
  active: "badge-ok",
  retired: "badge-neutral",
};

export default function PoliciesPage() {
  const policies = useKsnsQuery(() => ksnsPlatformClient.getPolicies());
  const [overrides, setOverrides] = useState<Record<string, PolicyState>>({});

  if (policies.status === "loading") {
    return <p className="text-xs text-gray-500">Loading policies…</p>;
  }

  if (policies.status === "error") {
    return (
      <EmptyState
        icon={FileCog}
        title="No connection to the K-SNS API"
        description={policies.error}
      />
    );
  }

  if (policies.data.length === 0) {
    return (
      <EmptyState
        icon={FileCog}
        title="No policies yet"
        description="Policy CRUD and activation will appear here. Activation is gated behind explicit operator approval — it is never a direct on/off toggle."
      />
    );
  }

  return (
    <div className="card divide-y divide-navy-700/40">
      {policies.data.map((p) => {
        const state = overrides[p.policy_id] ?? p.state;
        return (
          <div key={p.policy_id} className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">{p.name}</p>
                <span className={`badge ${STATE_BADGE[state]}`}>
                  {state.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{p.description}</p>
            </div>
            {(state === "draft" || state === "awaiting_approval") && (
              <ApprovalAction
                intent="request"
                label="Request Activation"
                onAction={async () => {
                  await ksnsPlatformClient.requestPolicyActivation(p.policy_id);
                  setOverrides((s) => ({ ...s, [p.policy_id]: "awaiting_approval" }));
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
