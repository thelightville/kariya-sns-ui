"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BrainCircuit, CheckCircle2, FileSearch, GitBranch, ShieldAlert } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";
import { useKsnsQuery } from "@/lib/useKsnsQuery";

const LIFECYCLE = ["sense", "understand", "decide", "act/enforce", "verify", "explain"];

function value(text?: string | null) {
  return text && text.length > 0 ? text : "Unavailable";
}

export default function IncidentDetailPage() {
  const params = useParams<{ incidentId: string }>();
  const incidentId = params.incidentId;
  const incident = useKsnsQuery(() => ksnsPlatformClient.getIncident(incidentId), [incidentId]);
  const timeline = useKsnsQuery(() => ksnsPlatformClient.getIncidentTimeline(incidentId), [incidentId]);
  const explanations = useKsnsQuery(() => ksnsPlatformClient.getExplanations(incidentId), [incidentId]);

  if (incident.status === "loading") {
    return <p className="text-xs text-gray-500">Loading incident...</p>;
  }

  if (incident.status === "error") {
    return <EmptyState icon={ShieldAlert} title="Incident detail unavailable" description={incident.error} />;
  }

  const i = incident.data;

  return (
    <div className="space-y-6">
      <Link href="/incidents" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-kariya-400">
        <ArrowLeft className="h-4 w-4" />
        Incidents
      </Link>

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Incident {i.incident_id}</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{i.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">{i.narrative ?? i.summary ?? "No incident narrative returned by K-SNS yet."}</p>
          </div>
          <div className="flex gap-2">
            <span className="badge badge-error">{i.severity}</span>
            <span className="badge badge-neutral">{String(i.state).replace(/_/g, " ")}</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {LIFECYCLE.map((stage) => (
          <div key={stage} className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stage}</p>
            <p className="mt-2 text-sm text-white">
              {stage === "sense" && value((i.source_components ?? []).join(", "))}
              {stage === "understand" && value(i.lifecycle_state)}
              {stage === "decide" && value(i.decision_state)}
              {stage === "act/enforce" && value(i.action_status)}
              {stage === "verify" && value(i.verification_status)}
              {stage === "explain" && (explanations.status === "success" && explanations.data.length > 0 ? "Available" : "Pending")}
            </p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2 text-gray-500">
            <GitBranch className="h-4 w-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wide">Decision, Action, Verification</h3>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-gray-500">Trust/risk changes</dt><dd className="mt-1 text-white">{(i.trust_risk_changes ?? []).join(", ") || "Unavailable"}</dd></div>
            <div><dt className="text-gray-500">Decision state</dt><dd className="mt-1 text-white">{value(i.decision_state)}</dd></div>
            <div><dt className="text-gray-500">Action record</dt><dd className="mt-1 text-white">{value(i.action_record ?? i.action_status)}</dd></div>
            <div><dt className="text-gray-500">Verification</dt><dd className="mt-1 text-white">{value(i.verification_status)}</dd></div>
            <div><dt className="text-gray-500">Residual risk</dt><dd className="mt-1 text-white">{value(i.residual_risk)}</dd></div>
            <div><dt className="text-gray-500">Confidence</dt><dd className="mt-1 text-white">{i.confidence == null ? "Unavailable" : `${Math.round(i.confidence * 100)}%`}</dd></div>
          </dl>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2 text-gray-500">
            <BrainCircuit className="h-4 w-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wide">KAI Explanation</h3>
          </div>
          {explanations.status === "loading" && <p className="text-xs text-gray-500">Loading explanations...</p>}
          {explanations.status === "error" && <EmptyState icon={BrainCircuit} title="Explanation unavailable" description={explanations.error} />}
          {explanations.status === "success" && explanations.data.length === 0 && (
            <EmptyState icon={BrainCircuit} title="No KAI explanation" description="K-SNS has not returned a KAI narrative for this incident." />
          )}
          {explanations.status === "success" && explanations.data.length > 0 && (
            <div className="space-y-3">
              {explanations.data.map((e) => (
                <div key={e.explanation_id} className="rounded-lg border border-navy-700/50 bg-navy-950/40 p-3">
                  <p className="text-sm leading-6 text-gray-300">{e.narrative}</p>
                  <p className="mt-2 text-xs text-gray-600">{e.generated_at}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center gap-2 text-gray-500">
          <FileSearch className="h-4 w-4" />
          <h3 className="text-xs font-semibold uppercase tracking-wide">Evidence & Timeline</h3>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {(i.evidence_refs ?? []).length === 0 && <span className="badge badge-neutral">Evidence refs unavailable</span>}
          {(i.evidence_refs ?? []).map((ref) => <span key={ref} className="badge badge-neutral">{ref}</span>)}
        </div>
        {timeline.status === "loading" && <p className="text-xs text-gray-500">Loading timeline...</p>}
        {timeline.status === "error" && <EmptyState icon={FileSearch} title="Timeline unavailable" description={timeline.error} />}
        {timeline.status === "success" && (timeline.data.timeline ?? []).length === 0 && (
          <EmptyState icon={CheckCircle2} title="No timeline entries" description="The incident timeline endpoint returned no entries." />
        )}
        {timeline.status === "success" && (timeline.data.timeline ?? []).length > 0 && (
          <ul className="divide-y divide-navy-700/40 text-sm text-gray-300">
            {timeline.data.timeline.map((entry: any, index: number) => (
              <li key={`${entry.id ?? index}`} className="py-3">
                <p className="font-medium text-white">{entry.title ?? entry.event_type ?? entry.type ?? "Timeline entry"}</p>
                <p className="mt-1 text-xs text-gray-500">{entry.created_at ?? entry.timestamp ?? "Timestamp unavailable"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
