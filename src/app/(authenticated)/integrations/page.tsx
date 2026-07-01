"use client";

import { Plug } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useKsnsQuery } from "@/lib/useKsnsQuery";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";
import type { KsnsConnector } from "@/types/ksns";

const STATUS_BADGE: Record<KsnsConnector["status"], string> = {
  connected: "badge-ok",
  degraded: "badge-warn",
  disconnected: "badge-error",
};

export default function IntegrationsPage() {
  const connectors = useKsnsQuery(() => ksnsPlatformClient.getConnectors());

  if (connectors.status === "loading") {
    return <p className="text-xs text-gray-500">Loading connectors…</p>;
  }

  if (connectors.status === "error") {
    return (
      <EmptyState
        icon={Plug}
        title="No connection to the K-SNS API"
        description={connectors.error}
      />
    );
  }

  if (connectors.data.length === 0) {
    return (
      <EmptyState
        icon={Plug}
        title="No connectors configured"
        description="KIF (Kariya Integration Framework) connector status and event throughput will appear here. This view is read-only."
      />
    );
  }

  return (
    <div className="card divide-y divide-navy-700/40">
      {connectors.data.map((c) => (
        <div key={c.connector_id} className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium text-white">{c.name}</p>
            <p className="text-xs text-gray-500">{c.type}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{c.events_24h} events / 24h</span>
            <span className={`badge ${STATUS_BADGE[c.status]}`}>{c.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
