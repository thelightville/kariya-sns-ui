"use client";

import { MessageSquareText } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useKsnsQuery } from "@/lib/useKsnsQuery";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";

export default function ExplanationsPage() {
  const explanations = useKsnsQuery(() => ksnsPlatformClient.getExplanations());

  if (explanations.status === "loading") {
    return <p className="text-xs text-gray-500">Loading explanations…</p>;
  }

  if (explanations.status === "error") {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="No connection to the K-SNS API"
        description={explanations.error}
      />
    );
  }

  if (explanations.data.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="No explanations yet"
        description="KAI narrative explanations for incidents, trust changes, and decisions will appear here, displayed verbatim as returned by K-SNS."
      />
    );
  }

  return (
    <div className="space-y-3">
      {explanations.data.map((e) => (
        <div key={e.explanation_id} className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {e.subject_type.replace(/_/g, " ")} · {e.subject_id}
          </p>
          <p className="mt-2 text-sm text-gray-300">{e.narrative}</p>
          <p className="mt-2 text-xs text-gray-600">{e.generated_at}</p>
        </div>
      ))}
    </div>
  );
}
