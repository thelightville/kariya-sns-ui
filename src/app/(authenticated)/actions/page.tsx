"use client";

import { Activity, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";
import { useKsnsQuery } from "@/lib/useKsnsQuery";
import type { KsnsAction } from "@/types/ksns";

const STATUS_BADGE: Record<string, string> = {
  pending: "badge-warn",
  approved: "badge-ok",
  rejected: "badge-error",
  executed: "badge-ok",
  dry_run: "badge-neutral",
  failed: "badge-error",
  verification_pending: "badge-warn",
  verified: "badge-ok",
};

function formatConfidence(value: number | null) {
  if (value === null || Number.isNaN(value)) return "Unavailable";
  return `${Math.round(value * 100)}%`;
}

function surfaceLabel(action: KsnsAction) {
  return action.enforcement_surface === "unknown" ? "Surface unavailable" : action.enforcement_surface;
}

export default function ActionsPage() {
  const actions = useKsnsQuery(() => ksnsPlatformClient.getActions());

  if (actions.status === "loading") {
    return <p className="text-xs text-gray-500">Loading autonomous actions...</p>;
  }

  if (actions.status === "error") {
    return (
      <EmptyState
        icon={Activity}
        title="Autonomous action records unavailable"
        description={actions.error}
      />
    );
  }

  if (actions.data.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No action records"
        description="KES, KEA, connector, cloud, identity, and manual action records will appear here when the tenant-scoped action API is configured. No action success is inferred."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-gray-500">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Action Records</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{actions.data.length}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-gray-500">
            <Clock3 className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Pending Verification</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-white">
            {actions.data.filter((a) => String(a.status).includes("verification") || a.verification_result === null).length}
          </p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-gray-500">
            <ShieldAlert className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Failed Dispatch</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-white">
            {actions.data.filter((a) => a.status === "failed" || a.dispatch_result === "failed").length}
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-3 border-b border-navy-700/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Action</span>
          <span>Target</span>
          <span>Surface</span>
          <span>Decision</span>
          <span>Status</span>
        </div>
        {actions.data.map((action) => (
          <div
            key={action.action_id}
            className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-3 border-b border-navy-700/30 px-4 py-4 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{action.action_type}</p>
              <p className="mt-1 text-xs text-gray-500">{action.action_id}</p>
              {action.incident_id && <p className="mt-1 text-xs text-gray-600">Incident {action.incident_id}</p>}
            </div>
            <div className="min-w-0 text-sm text-gray-300">
              <p className="truncate">{action.target}</p>
              <p className="mt-1 text-xs text-gray-500">Confidence {formatConfidence(action.confidence)}</p>
            </div>
            <div className="text-sm text-gray-300">
              <p>{surfaceLabel(action)}</p>
              <p className="mt-1 text-xs text-gray-500">Policy {action.policy_authority ?? "unavailable"}</p>
            </div>
            <div className="text-sm text-gray-300">
              <p>{action.decision_mode.replace(/_/g, " ")}</p>
              <p className="mt-1 text-xs text-gray-500">Verification {action.verification_required === null ? "pending" : action.verification_required ? "required" : "not required"}</p>
            </div>
            <div className="text-sm text-gray-300">
              <span className={`badge ${STATUS_BADGE[action.status] ?? "badge-neutral"}`}>{String(action.status).replace(/_/g, " ")}</span>
              <p className="mt-2 text-xs text-gray-500">Dispatch {action.dispatch_result ?? "pending"}</p>
              <p className="mt-1 text-xs text-gray-500">Residual risk {action.residual_risk ?? "unavailable"}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600">
        This page displays action lifecycle records only. It does not execute actions or mark verification successful unless the backend reports that state.
      </p>
    </div>
  );
}
