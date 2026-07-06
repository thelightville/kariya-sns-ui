"use client";

import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  FileSearch,
  Plug,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";
import { useKsnsQuery } from "@/lib/useKsnsQuery";

const LIFECYCLE = ["Sense", "Understand", "Decide", "Act/Enforce", "Verify", "Explain"];

function unavailable(status: string, error?: string | null) {
  return status === "error" ? error ?? "Unavailable" : "Pending backend data";
}

export default function OverviewPage() {
  const incidents = useKsnsQuery(() => ksnsPlatformClient.getIncidents());
  const trust = useKsnsQuery(() => ksnsPlatformClient.getTrustScore());
  const events = useKsnsQuery(() => ksnsPlatformClient.getEvents({ limit: 10 }));
  const actions = useKsnsQuery(() => ksnsPlatformClient.getActions());
  const connectors = useKsnsQuery(() => ksnsPlatformClient.getConnectors());
  const explanations = useKsnsQuery(() => ksnsPlatformClient.getExplanations());

  const incidentItems = incidents.status === "success" ? incidents.data : [];
  const actionItems = actions.status === "success" ? actions.data : [];
  const connectorItems = connectors.status === "success" ? connectors.data : [];

  const activeIncidents = incidentItems.filter(
    (i) => i.state !== "resolved" && i.state !== "closed"
  ).length;
  const highRiskIncidents = incidentItems.filter(
    (i) => i.severity === "high" || i.severity === "critical"
  ).length;
  const pendingVerification = actionItems.filter((a) =>
    String(a.verification_result ?? a.status).includes("verification")
  ).length;
  const degradedSources = connectorItems.filter(
    (c) => c.status === "degraded" || c.status === "disconnected" || c.status === "pending"
  ).length;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={AlertTriangle}
          label="Total Incidents"
          value={incidents.status === "success" ? String(incidentItems.length) : "-"}
          hint={incidents.status === "success" ? `${activeIncidents} active` : unavailable(incidents.status, incidents.error)}
        />
        <StatCard
          icon={TrendingUp}
          label="High Risk"
          value={incidents.status === "success" ? String(highRiskIncidents) : "-"}
          hint="High or critical severity only"
        />
        <StatCard
          icon={Activity}
          label="Autonomous Actions"
          value={actions.status === "success" ? String(actionItems.length) : "-"}
          hint={actions.status === "success" ? `${pendingVerification} pending verification` : unavailable(actions.status, actions.error)}
        />
        <StatCard
          icon={ShieldCheck}
          label="Trust Posture"
          value={trust.status === "success" ? `${Math.round(trust.data.overall_score * 100)}%` : "-"}
          hint={trust.status === "success" ? `Tier: ${trust.data.tier}` : unavailable(trust.status, trust.error)}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">Security Nervous System Lifecycle</h2>
            <span className="badge badge-neutral">Live data only</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {LIFECYCLE.map((stage) => (
              <div key={stage} className="rounded-lg border border-navy-700/50 bg-navy-950/40 p-3">
                <p className="text-xs font-semibold text-white">{stage}</p>
                <p className="mt-2 text-[11px] leading-4 text-gray-500">
                  {stage === "Sense" && (events.status === "success" ? `${events.data.length} recent events` : "Events unavailable")}
                  {stage === "Understand" && (incidents.status === "success" ? `${incidentItems.length} correlated incidents` : "Correlation unavailable")}
                  {stage === "Decide" && (actions.status === "success" ? `${actionItems.length} action records` : "Decision/action data unavailable")}
                  {stage === "Act/Enforce" && "KES, KEA, connector, cloud, identity, or manual surface"}
                  {stage === "Verify" && (actions.status === "success" ? `${pendingVerification} pending` : "Verification endpoint pending")}
                  {stage === "Explain" && (explanations.status === "success" ? `${explanations.data.length} KAI narratives` : "KAI explanations unavailable")}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2 text-gray-500">
            <Plug className="h-4 w-4" />
            <h2 className="text-xs font-medium uppercase tracking-wide">Connector Health</h2>
          </div>
          {connectors.status === "error" && (
            <EmptyState icon={Plug} title="Connector inventory unavailable" description={connectors.error} />
          )}
          {connectors.status === "loading" && <p className="text-xs text-gray-500">Loading connectors...</p>}
          {connectors.status === "success" && connectorItems.length === 0 && (
            <EmptyState icon={Plug} title="No connector inventory" description="KIF connector inventory is not reporting yet." />
          )}
          {connectors.status === "success" && connectorItems.length > 0 && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Inventory</span>
                <span className="font-semibold text-white">{connectorItems.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Degraded or disconnected</span>
                <span className="font-semibold text-white">{degradedSources}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Telemetry sources</span>
                <span className="font-semibold text-white">
                  {new Set(connectorItems.map((c) => c.source_system ?? c.type)).size}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2 text-gray-500">
            <FileSearch className="h-4 w-4" />
            <h2 className="text-xs font-medium uppercase tracking-wide">Recent Evidence</h2>
          </div>
          {events.status === "error" && <EmptyState icon={FileSearch} title="Evidence unavailable" description={events.error} />}
          {events.status === "loading" && <p className="text-xs text-gray-500">Loading evidence...</p>}
          {events.status === "success" && events.data.length === 0 && (
            <EmptyState icon={FileSearch} title="No recent evidence" description="Normalized events will appear here after KES, KEA, KIF, or MCP telemetry is ingested." />
          )}
          {events.status === "success" && events.data.length > 0 && (
            <ul className="divide-y divide-navy-700/40 text-sm text-gray-300">
              {events.data.slice(0, 6).map((e) => (
                <li key={e.event_id} className="flex items-center justify-between gap-4 py-2">
                  <span className="truncate">{e.summary}</span>
                  <span className="badge badge-neutral shrink-0">{e.source_component}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2 text-gray-500">
            <BrainCircuit className="h-4 w-4" />
            <h2 className="text-xs font-medium uppercase tracking-wide">Explanation Coverage</h2>
          </div>
          {explanations.status === "error" && (
            <EmptyState icon={BrainCircuit} title="KAI explanations unavailable" description={explanations.error} />
          )}
          {explanations.status === "loading" && <p className="text-xs text-gray-500">Loading explanations...</p>}
          {explanations.status === "success" && explanations.data.length === 0 && (
            <EmptyState icon={BrainCircuit} title="No KAI explanations" description="The UI will not invent narrative reasoning when KAI has not returned an explanation." />
          )}
          {explanations.status === "success" && explanations.data.length > 0 && (
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              <span>{explanations.data.length} explanation records available</span>
            </div>
          )}
        </div>
      </section>

      <p className="text-xs text-gray-600">
        Metrics marked unavailable reflect missing configuration, missing tenant scope, or backend endpoints that are not implemented yet. This dashboard does not use mock SOC data.
      </p>
    </div>
  );
}
