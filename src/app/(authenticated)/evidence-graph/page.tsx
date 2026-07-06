"use client";

import { BrainCircuit, FileSearch, GitBranch, ShieldCheck } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";
import { useKsnsQuery } from "@/lib/useKsnsQuery";

function display(value?: string | null) {
  return value && value.length > 0 ? value : "Pending";
}

export default function EvidenceGraphPage() {
  const evidence = useKsnsQuery(() => ksnsPlatformClient.getEvidenceRecords());

  if (evidence.status === "loading") {
    return <p className="text-xs text-gray-500">Loading evidence and explanations...</p>;
  }

  if (evidence.status === "error") {
    return <EmptyState icon={FileSearch} title="Evidence view unavailable" description={evidence.error} />;
  }

  if (evidence.data.length === 0) {
    return (
      <EmptyState
        icon={FileSearch}
        title="No evidence records"
        description="Normalized events, correlation results, trust/risk movement, decisions, actions, dispatch, verification, and KAI explanations will appear here when K-SNS returns them."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="card p-4">
          <FileSearch className="h-4 w-4 text-gray-500" />
          <p className="mt-2 text-2xl font-bold text-white">{evidence.data.length}</p>
          <p className="text-xs uppercase tracking-wide text-gray-500">Evidence Records</p>
        </div>
        <div className="card p-4">
          <GitBranch className="h-4 w-4 text-gray-500" />
          <p className="mt-2 text-2xl font-bold text-white">{evidence.data.filter((e) => e.correlation_result).length}</p>
          <p className="text-xs uppercase tracking-wide text-gray-500">Correlations</p>
        </div>
        <div className="card p-4">
          <ShieldCheck className="h-4 w-4 text-gray-500" />
          <p className="mt-2 text-2xl font-bold text-white">{evidence.data.filter((e) => e.verification_result).length}</p>
          <p className="text-xs uppercase tracking-wide text-gray-500">Verified</p>
        </div>
        <div className="card p-4">
          <BrainCircuit className="h-4 w-4 text-gray-500" />
          <p className="mt-2 text-2xl font-bold text-white">{evidence.data.filter((e) => e.kai_explanation).length}</p>
          <p className="text-xs uppercase tracking-wide text-gray-500">KAI Explanations</p>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-3 border-b border-navy-700/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Evidence</span>
          <span>Correlation</span>
          <span>Decision/Action</span>
          <span>Verification</span>
          <span>Explanation</span>
        </div>
        {evidence.data.map((record) => (
          <div key={record.evidence_id} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-3 border-b border-navy-700/30 px-4 py-4 last:border-b-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{record.summary}</p>
              <p className="mt-1 text-xs text-gray-500">{record.record_type}</p>
              <p className="mt-1 text-xs text-gray-600">{record.source_system ?? "Source unavailable"} · {record.timestamp ?? "Timestamp unavailable"}</p>
            </div>
            <div className="text-sm text-gray-300">
              <p>{display(record.normalized_event)}</p>
              <p className="mt-1 text-xs text-gray-500">{display(record.correlation_result)}</p>
              <p className="mt-1 text-xs text-gray-500">Risk {display(record.trust_risk_movement)}</p>
            </div>
            <div className="text-sm text-gray-300">
              <p>Decision {display(record.decision_record)}</p>
              <p className="mt-1 text-xs text-gray-500">Action {display(record.action_record)}</p>
              <p className="mt-1 text-xs text-gray-500">Dispatch {display(record.dispatch_result)}</p>
            </div>
            <div className="text-sm text-gray-300">
              <p>{display(record.verification_result)}</p>
              <p className="mt-1 text-xs text-gray-500">Residual {display(record.residual_risk)}</p>
            </div>
            <div className="text-sm text-gray-300">
              {record.kai_explanation ? (
                <p className="line-clamp-4 leading-5">{record.kai_explanation}</p>
              ) : (
                <span className="badge badge-neutral">KAI pending</span>
              )}
            </div>
          </div>
        ))}
      </section>

      <p className="text-xs text-gray-600">
        This page is a lifecycle evidence view, not a fabricated graph. Fields remain pending until K-SNS exposes the corresponding correlation, action, verification, or KAI explanation record.
      </p>
    </div>
  );
}
