"use client";

import { Activity, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";
import { useKsnsQuery } from "@/lib/useKsnsQuery";

export default function TrustPage() {
  const trust = useKsnsQuery(() => ksnsPlatformClient.getTrustScore());
  const incidents = useKsnsQuery(() => ksnsPlatformClient.getIncidents());
  const actions = useKsnsQuery(() => ksnsPlatformClient.getActions());
  const events = useKsnsQuery(() => ksnsPlatformClient.getEvents({ limit: 15 }));

  if (trust.status === "loading") {
    return <p className="text-xs text-gray-500">Loading trust and risk posture...</p>;
  }

  if (trust.status === "error") {
    return <EmptyState icon={ShieldCheck} title="Trust posture unavailable" description={trust.error} />;
  }

  const t = trust.data;
  const riskScore = Math.max(0, Math.round((1 - t.overall_score) * 100));

  return (
    <div className="space-y-6">
      <section className="card flex flex-wrap items-center justify-between gap-6 p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Current Trust Score</p>
          <p className="mt-1 text-4xl font-bold text-white">{Math.round(t.overall_score * 100)}%</p>
          <span className={`badge mt-2 ${t.tier === "trusted" ? "badge-ok" : t.tier === "caution" ? "badge-warn" : "badge-error"}`}>{t.tier}</span>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Derived Risk</p>
          <p className="mt-1 text-4xl font-bold text-white">{riskScore}%</p>
          <p className="mt-2 text-xs text-gray-500">Displayed from K-SNS trust score; not recalculated as authority</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={ShieldCheck} label="Trusted Assets" value={String(t.assets_trusted)} />
        <StatCard icon={TrendingUp} label="Caution" value={String(t.assets_caution)} />
        <StatCard icon={TrendingDown} label="Untrusted" value={String(t.assets_untrusted)} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">Assets, Users, Devices</h2>
          <div className="space-y-3">
            {[
              ["Current score", `${Math.round(t.overall_score * 100)}%`],
              ["Score movement", "Pending backend history endpoint"],
              ["Reason codes", events.status === "success" ? "Available in normalized event payload when supplied" : "Unavailable"],
              ["Contributing events", events.status === "success" ? String(events.data.length) : events.error ?? "Unavailable"],
              ["Related incidents", incidents.status === "success" ? String(incidents.data.length) : incidents.error ?? "Unavailable"],
              ["Action impact", actions.status === "success" ? `${actions.data.length} action records` : actions.error ?? "Unavailable"],
              ["Verification impact", actions.status === "success" ? "Pending action verification fields" : "Unavailable"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 rounded-lg border border-navy-700/40 bg-navy-950/30 px-3 py-2 text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="text-right text-gray-200">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2 text-gray-500">
            <Activity className="h-4 w-4" />
            <h2 className="text-sm font-semibold text-white">Trust/Risk Timeline</h2>
          </div>
          {events.status === "loading" && <p className="text-xs text-gray-500">Loading recent signal timeline...</p>}
          {events.status === "error" && <EmptyState icon={Activity} title="Timeline unavailable" description={events.error} />}
          {events.status === "success" && events.data.length === 0 && (
            <EmptyState icon={Activity} title="No trust/risk events" description="Trust movement entries will appear once K-SNS emits historical trust events." />
          )}
          {events.status === "success" && events.data.length > 0 && (
            <ul className="divide-y divide-navy-700/40 text-sm text-gray-300">
              {events.data.slice(0, 8).map((event) => (
                <li key={event.event_id} className="py-2">
                  <p className="font-medium text-white">{event.summary}</p>
                  <p className="mt-1 text-xs text-gray-500">{event.source_component} · {event.severity} · {event.occurred_at}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="text-xs text-gray-600">
        K-SNS remains authoritative for trust scoring. This UI displays scores, related evidence, and pending backend dependencies without deriving a new policy decision client-side.
      </p>
    </div>
  );
}
