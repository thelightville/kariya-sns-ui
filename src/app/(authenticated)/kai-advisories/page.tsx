"use client";

import { AlertTriangle, BrainCircuit, FileSearch, ShieldCheck } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";
import { useKsnsQuery } from "@/lib/useKsnsQuery";
import type { KsnsKaiAdvisoryHandoff } from "@/types/ksns";

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warning" | "success";
}) {
  const classes =
    tone === "warning"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
      : tone === "success"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
        : "border-navy-600 bg-navy-800 text-gray-300";
  return (
    <span className={`rounded-full border px-2 py-1 text-[11px] font-medium ${classes}`}>
      {children}
    </span>
  );
}

function reviewTone(handoff: KsnsKaiAdvisoryHandoff) {
  if (handoff.runtime.availability !== "available") return "warning";
  if (handoff.review.required || handoff.review.state !== "completed") return "warning";
  return "success";
}

function AdvisoryCard({ handoff }: { handoff: KsnsKaiAdvisoryHandoff }) {
  const gated = handoff.review.required || handoff.runtime.availability !== "available";
  return (
    <article className="card space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {handoff.source_service} · {handoff.assessment_id}
          </p>
          <h2 className="mt-1 text-base font-semibold text-white">
            {handoff.advisory_summary || "KAI advisory summary unavailable"}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={reviewTone(handoff)}>
            {gated ? "Review required" : "Review completed"}
          </Badge>
          <Badge tone={handoff.runtime.availability === "available" ? "success" : "warning"}>
            Runtime {handoff.runtime.availability}
          </Badge>
          <Badge>Advisory only</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-navy-700/60 bg-navy-950/40 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Confidence</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {Math.round(handoff.confidence.score * 100)}%
          </p>
          <p className="text-xs text-gray-500">{handoff.confidence.band}</p>
        </div>
        <div className="rounded-lg border border-navy-700/60 bg-navy-950/40 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Evidence</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {handoff.evidence.reference_count}
          </p>
          <p className="text-xs text-gray-500">{handoff.evidence.status}</p>
        </div>
        <div className="rounded-lg border border-navy-700/60 bg-navy-950/40 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Incident</p>
          <p className="mt-1 truncate text-sm font-medium text-white">
            {handoff.incident_id ?? "Not correlated"}
          </p>
          <p className="text-xs text-gray-500">Decision {handoff.decision_id ?? "pending"}</p>
        </div>
        <div className="rounded-lg border border-navy-700/60 bg-navy-950/40 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Boundary</p>
          <p className="mt-1 text-sm font-medium text-white">{handoff.system_of_record}</p>
          <p className="text-xs text-gray-500">No browser-to-KAI</p>
        </div>
      </div>

      {(handoff.review.reasons.length > 0 ||
        handoff.unresolved_gates.length > 0 ||
        handoff.uncertainty_reasons.length > 0) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Review gates</p>
            <p className="mt-1 text-sm text-gray-300">
              {handoff.review.reasons.join(", ") || "None"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Uncertainty</p>
            <p className="mt-1 text-sm text-gray-300">
              {handoff.uncertainty_reasons.join(", ") || "None"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Unresolved gates
            </p>
            <p className="mt-1 text-sm text-gray-300">
              {handoff.unresolved_gates.join(", ") || "None"}
            </p>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Evidence references
        </p>
        {handoff.evidence.evidence_refs.length === 0 ? (
          <p className="mt-1 text-sm text-amber-300">
            Evidence references unavailable; analyst review remains required.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-gray-400">
            {handoff.evidence.evidence_refs.slice(0, 5).map((ref) => (
              <li
                key={ref}
                className="truncate rounded border border-navy-700/40 bg-navy-950/30 px-2 py-1"
              >
                {ref}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
        <span>KAI {handoff.provenance.kai_version}</span>
        <span>Model {handoff.provenance.model_version}</span>
        <span>Contract {handoff.provenance.contract_version}</span>
        <span>Execution {handoff.execution_status}</span>
        <span>Verification {handoff.verification_status}</span>
      </div>
    </article>
  );
}

export default function KaiAdvisoriesPage() {
  const handoffs = useKsnsQuery(() => ksnsPlatformClient.getKaiAdvisoryHandoffs({ limit: 50 }));

  if (handoffs.status === "loading") {
    return (
      <p className="text-xs text-gray-500">
        Loading KAI advisory handoffs through the K-SNS BFF...
      </p>
    );
  }

  if (handoffs.status === "error") {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="KAI advisory handoffs unavailable"
        description={handoffs.error}
      />
    );
  }

  if (handoffs.data.handoffs.length === 0) {
    return (
      <EmptyState
        icon={BrainCircuit}
        title="No accepted KAI advisories"
        description="K-SNS has not accepted any tenant-scoped KAI advisory handoffs yet. When available, advisory evidence will appear here without browser-to-KAI access."
      />
    );
  }

  const reviewRequired = handoffs.data.handoffs.filter(
    (item) => item.review.required || item.review.state !== "completed"
  ).length;
  const degraded = handoffs.data.handoffs.filter(
    (item) => item.runtime.availability !== "available"
  ).length;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="card p-4">
          <BrainCircuit className="h-4 w-4 text-gray-500" />
          <p className="mt-2 text-2xl font-bold text-white">{handoffs.data.count}</p>
          <p className="text-xs uppercase tracking-wide text-gray-500">Accepted advisories</p>
        </div>
        <div className="card p-4">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <p className="mt-2 text-2xl font-bold text-white">{reviewRequired}</p>
          <p className="text-xs uppercase tracking-wide text-gray-500">Review required</p>
        </div>
        <div className="card p-4">
          <FileSearch className="h-4 w-4 text-gray-500" />
          <p className="mt-2 text-2xl font-bold text-white">{degraded}</p>
          <p className="text-xs uppercase tracking-wide text-gray-500">Degraded/unavailable</p>
        </div>
        <div className="card p-4">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <p className="mt-2 text-sm font-semibold text-white">K-SNS owned</p>
          <p className="text-xs uppercase tracking-wide text-gray-500">System of record</p>
        </div>
      </section>

      <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">
        KAI is advisory-only. K-SNS remains the incident system of record, decision authority,
        orchestration owner, and enforcement lifecycle owner. Degraded or unavailable KAI
        results cannot appear approved, executed, enforced, or verified.
      </section>

      <section className="space-y-4">
        {handoffs.data.handoffs.map((handoff) => (
          <AdvisoryCard key={handoff.handoff_id} handoff={handoff} />
        ))}
      </section>
    </div>
  );
}
