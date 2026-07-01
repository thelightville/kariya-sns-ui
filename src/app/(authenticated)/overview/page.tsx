"use client";

import { AlertTriangle, ShieldCheck, Activity } from "lucide-react";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { useKsnsQuery } from "@/lib/useKsnsQuery";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";

export default function OverviewPage() {
  const incidents = useKsnsQuery(() => ksnsPlatformClient.getIncidents());
  const trust = useKsnsQuery(() => ksnsPlatformClient.getTrustScore());
  const events = useKsnsQuery(() => ksnsPlatformClient.getEvents({ limit: 10 }));

  const openIncidents =
    incidents.status === "success"
      ? incidents.data.filter((i) => i.state !== "resolved" && i.state !== "closed").length
      : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={AlertTriangle}
          label="Open Incidents"
          value={openIncidents !== null ? String(openIncidents) : "—"}
          hint={incidents.status === "error" ? "K-SNS API unreachable" : undefined}
        />
        <StatCard
          icon={ShieldCheck}
          label="Trust Posture"
          value={
            trust.status === "success"
              ? `${Math.round(trust.data.overall_score * 100)}%`
              : "—"
          }
          hint={trust.status === "error" ? "K-SNS API unreachable" : undefined}
        />
        <StatCard
          icon={Activity}
          label="Recent Events"
          value={events.status === "success" ? String(events.data.length) : "—"}
          hint={events.status === "error" ? "K-SNS API unreachable" : undefined}
        />
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">Recent Events</h2>
        {events.status === "loading" && (
          <p className="text-xs text-gray-500">Loading…</p>
        )}
        {events.status === "error" && (
          <EmptyState
            icon={Activity}
            title="No connection to the K-SNS API"
            description={events.error}
          />
        )}
        {events.status === "success" && events.data.length === 0 && (
          <EmptyState
            icon={Activity}
            title="No recent events"
            description="Events from KES/KEA sensors will appear here once the K-SNS pipeline is live."
          />
        )}
        {events.status === "success" && events.data.length > 0 && (
          <ul className="divide-y divide-navy-700/40 text-sm text-gray-300">
            {events.data.map((e) => (
              <li key={e.event_id} className="py-2">
                {e.summary}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-600">
        This is the K-SNS Alpha 1 baseline. The overview does not fabricate
        placeholder metrics — every number reflects a live K-SNS API response
        or is shown as unavailable.
      </p>
    </div>
  );
}
