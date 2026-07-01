"use client";

import { FolderKanban } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useKsnsQuery } from "@/lib/useKsnsQuery";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";
import type { IncidentState } from "@/types/ksns";

const STATE_BADGE: Record<IncidentState, string> = {
  new: "badge-warn",
  investigating: "badge-neutral",
  awaiting_approval: "badge-warn",
  resolved: "badge-ok",
  closed: "badge-neutral",
};

export default function IncidentsPage() {
  const incidents = useKsnsQuery(() => ksnsPlatformClient.getIncidents());

  if (incidents.status === "loading") {
    return <p className="text-xs text-gray-500">Loading incidents…</p>;
  }

  if (incidents.status === "error") {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No connection to the K-SNS API"
        description={incidents.error}
      />
    );
  }

  if (incidents.data.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No incidents yet"
        description="Incidents produced by the Understand stage, and the cases that group them, will appear here."
      />
    );
  }

  // Group incidents by case_id for a lightweight case-grouping placeholder.
  const grouped = new Map<string, typeof incidents.data>();
  for (const i of incidents.data) {
    const key = i.case_id ?? "ungrouped";
    grouped.set(key, [...(grouped.get(key) ?? []), i]);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([caseId, items]) => (
        <div key={caseId} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {caseId === "ungrouped" ? "Ungrouped Incidents" : `Case ${caseId}`}
          </p>
          <div className="card divide-y divide-navy-700/40">
            {items.map((i) => (
              <div key={i.incident_id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-white">{i.title}</p>
                  <p className="text-xs text-gray-500">Opened {i.opened_at}</p>
                </div>
                <span className={`badge ${STATE_BADGE[i.state]}`}>
                  {i.state.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
