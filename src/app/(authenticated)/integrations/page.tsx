"use client";

import { Plug, ServerCog, Wrench } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";
import { useKsnsQuery } from "@/lib/useKsnsQuery";
import type { KsnsConnector } from "@/types/ksns";

const STATUS_BADGE: Record<KsnsConnector["status"], string> = {
  connected: "badge-ok",
  degraded: "badge-warn",
  disconnected: "badge-error",
  pending: "badge-neutral",
  unsupported: "badge-neutral",
};

export default function IntegrationsPage() {
  const connectors = useKsnsQuery(() => ksnsPlatformClient.getConnectors());
  const tools = useKsnsQuery(() => ksnsPlatformClient.getToolGovernance());

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-gray-500">
            <Plug className="h-4 w-4" />
            <h2 className="text-sm font-semibold text-white">KIF Connector Inventory</h2>
          </div>
          <span className="badge badge-neutral">No secrets displayed</span>
        </div>

        {connectors.status === "loading" && <p className="text-xs text-gray-500">Loading connectors...</p>}
        {connectors.status === "error" && (
          <EmptyState icon={Plug} title="Connector inventory unavailable" description={connectors.error} />
        )}
        {connectors.status === "success" && connectors.data.length === 0 && (
          <EmptyState
            icon={Plug}
            title="No connectors configured"
            description="KIF connector inventory, health, ingestion, supported telemetry, supported actions, and readiness will appear here when the backend returns tenant connector records."
          />
        )}
        {connectors.status === "success" && connectors.data.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-navy-700/40">
            <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-3 border-b border-navy-700/50 bg-navy-950/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span>Connector</span>
              <span>Source</span>
              <span>Health</span>
              <span>Telemetry</span>
              <span>Readiness</span>
            </div>
            {connectors.data.map((c) => (
              <div key={c.connector_id} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-3 border-b border-navy-700/30 px-4 py-4 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{c.name}</p>
                  <p className="mt-1 text-xs text-gray-500">{c.connector_id}</p>
                </div>
                <div className="text-sm text-gray-300">
                  <p>{c.source_system ?? c.type}</p>
                  <p className="mt-1 text-xs text-gray-500">Auth {c.auth_status ?? "unknown"}</p>
                </div>
                <div className="text-sm text-gray-300">
                  <span className={`badge ${STATUS_BADGE[c.status]}`}>{c.health_status ?? c.status}</span>
                  <p className="mt-2 text-xs text-gray-500">Last seen {c.last_seen ?? c.last_sync ?? c.last_event_at ?? "unavailable"}</p>
                </div>
                <div className="text-sm text-gray-300">
                  <p>{c.events_24h} events / 24h</p>
                  <p className="mt-1 text-xs text-gray-500">Errors {c.errors ?? "unavailable"}</p>
                  <p className="mt-1 text-xs text-gray-500">Last ingestion {c.last_ingestion ?? "unavailable"}</p>
                </div>
                <div className="text-sm text-gray-300">
                  <span className={`badge ${STATUS_BADGE[c.readiness === "live" || c.readiness === "configured" ? "connected" : c.readiness ?? c.status] ?? "badge-neutral"}`}>{c.readiness ?? "pending"}</span>
                  <p className="mt-2 text-xs text-gray-500">Telemetry {(c.supported_telemetry_types ?? []).join(", ") || "pending"}</p>
                  <p className="mt-1 text-xs text-gray-500">Actions {(c.supported_actions ?? []).join(", ") || "pending"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-gray-500">
            <ServerCog className="h-4 w-4" />
            <h2 className="text-sm font-semibold text-white">MCP / Tool Governance</h2>
          </div>
          <span className="badge badge-neutral">Governance telemetry</span>
        </div>

        {tools.status === "loading" && <p className="text-xs text-gray-500">Loading tool governance...</p>}
        {tools.status === "error" && (
          <EmptyState
            icon={Wrench}
            title="MCP telemetry pending"
            description={`${tools.error} Tool-governance visibility is served only through the same-origin K-SNS BFF; no browser-to-MCP or raw backend calls are made.`}
          />
        )}
        {tools.status === "success" && tools.data.length === 0 && (
          <EmptyState
            icon={Wrench}
            title="No MCP tool records"
            description="MCP server/tool name, category, enabled state, invocation risk, policy decision, allow/deny status, misuse events, related incidents, and evidence links will display here when backend telemetry is implemented."
          />
        )}
        {tools.status === "success" && tools.data.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-navy-700/40">
            {tools.data.map((tool) => (
              <div key={tool.tool_id} className="grid grid-cols-1 gap-3 border-b border-navy-700/30 p-4 last:border-b-0 md:grid-cols-4">
                <div>
                  <p className="text-sm font-medium text-white">{tool.server_name} / {tool.tool_name}</p>
                  <p className="mt-1 text-xs text-gray-500">{tool.category}</p>
                </div>
                <div className="text-sm text-gray-300">Enabled {tool.enabled === null ? "unknown" : tool.enabled ? "yes" : "no"}</div>
                <div className="text-sm text-gray-300">Risk {tool.invocation_risk}</div>
                <div className="text-sm text-gray-300">Policy {tool.policy_decision ?? tool.allow_deny_status}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-gray-600">
        Connector readiness is shown only from returned connector records. Documented or stubbed connectors remain pending until health and ingestion data exist.
      </p>
    </div>
  );
}
