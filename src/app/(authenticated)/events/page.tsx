"use client";

import { Zap } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useKsnsQuery } from "@/lib/useKsnsQuery";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";

const SEVERITY_BADGE: Record<string, string> = {
  critical: "badge-error",
  high: "badge-error",
  medium: "badge-warn",
  low: "badge-ok",
  info: "badge-neutral",
};

export default function EventsPage() {
  const events = useKsnsQuery(() => ksnsPlatformClient.getEvents({ limit: 50 }));

  return (
    <div className="card overflow-hidden">
      {events.status === "loading" && (
        <p className="p-6 text-xs text-gray-500">Loading events…</p>
      )}

      {events.status === "error" && (
        <EmptyState
          icon={Zap}
          title="No connection to the K-SNS API"
          description={events.error}
        />
      )}

      {events.status === "success" && events.data.length === 0 && (
        <EmptyState
          icon={Zap}
          title="No events yet"
          description="Sense/Understand-stage events ingested from KES and KEA will appear here."
        />
      )}

      {events.status === "success" && events.data.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-navy-700/60 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Severity</th>
              <th className="px-4 py-3 font-medium">Summary</th>
              <th className="px-4 py-3 font-medium">Occurred</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/40 text-gray-300">
            {events.data.map((e) => (
              <tr key={e.event_id}>
                <td className="px-4 py-3 font-mono text-xs">{e.type}</td>
                <td className="px-4 py-3 capitalize">{e.stage}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${SEVERITY_BADGE[e.severity] ?? "badge-neutral"}`}>
                    {e.severity}
                  </span>
                </td>
                <td className="px-4 py-3">{e.summary}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{e.occurred_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
