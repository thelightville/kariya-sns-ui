"use client";

import { ShieldCheck } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { useKsnsQuery } from "@/lib/useKsnsQuery";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";

export default function TrustPage() {
  const trust = useKsnsQuery(() => ksnsPlatformClient.getTrustScore());

  if (trust.status === "loading") {
    return <p className="text-xs text-gray-500">Loading trust posture…</p>;
  }

  if (trust.status === "error") {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No connection to the K-SNS API"
        description={trust.error}
      />
    );
  }

  const t = trust.data;

  return (
    <div className="space-y-6">
      <div className="card flex items-center justify-between p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Overall Trust Score
          </p>
          <p className="mt-1 text-4xl font-bold text-white">
            {Math.round(t.overall_score * 100)}%
          </p>
          <span
            className={`badge mt-2 ${
              t.tier === "trusted"
                ? "badge-ok"
                : t.tier === "caution"
                  ? "badge-warn"
                  : "badge-error"
            }`}
          >
            {t.tier}
          </span>
        </div>
        <ShieldCheck className="h-16 w-16 text-navy-700" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={ShieldCheck} label="Trusted Assets" value={String(t.assets_trusted)} />
        <StatCard icon={ShieldCheck} label="Caution" value={String(t.assets_caution)} />
        <StatCard icon={ShieldCheck} label="Untrusted" value={String(t.assets_untrusted)} />
      </div>

      <p className="text-xs text-gray-600">
        Trust scores are computed and served by K-SNS; this view displays
        them verbatim and never recalculates them client-side.
      </p>
    </div>
  );
}
