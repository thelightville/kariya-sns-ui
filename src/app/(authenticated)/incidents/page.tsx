"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { FolderKanban, Search } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { ksnsPlatformClient } from "@/lib/ksnsPlatformClient";
import { useKsnsQuery } from "@/lib/useKsnsQuery";
import type { IncidentState, Severity } from "@/types/ksns";

const STATE_BADGE: Record<string, string> = {
  new: "badge-warn",
  investigating: "badge-neutral",
  awaiting_approval: "badge-warn",
  resolved: "badge-ok",
  closed: "badge-neutral",
};

const SEVERITY_BADGE: Record<Severity, string> = {
  info: "badge-neutral",
  low: "badge-neutral",
  medium: "badge-warn",
  high: "badge-error",
  critical: "badge-error",
};

function affected(i: {
  affected_asset?: string | null;
  affected_user?: string | null;
  affected_device?: string | null;
}) {
  return i.affected_asset ?? i.affected_user ?? i.affected_device ?? "Unavailable";
}

function confidence(value?: number | null) {
  if (value === undefined || value === null) return "Unavailable";
  return `${Math.round(value * 100)}%`;
}

export default function IncidentsPage() {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const incidents = useKsnsQuery(
    () => ksnsPlatformClient.getIncidents(query ? { query } : undefined),
    [query]
  );

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draftQuery.trim());
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submitSearch} className="card flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-[16rem] flex-1">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Search incidents
          </span>
          <input
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            maxLength={200}
            placeholder="Title or narrative"
            className="w-full rounded-lg border border-navy-700 bg-navy-950 px-3 py-2 text-sm text-white outline-none focus:border-kariya-500"
          />
        </label>
        <button type="submit" className="btn-primary inline-flex items-center gap-2">
          <Search className="h-4 w-4" />
          Search
        </button>
        {query && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setDraftQuery("");
              setQuery("");
            }}
          >
            Clear
          </button>
        )}
      </form>

      {incidents.status === "loading" && (
        <p className="text-xs text-gray-500">Loading incidents...</p>
      )}

      {incidents.status === "error" && (
        <EmptyState
          icon={FolderKanban}
          title="Incident records unavailable"
          description={incidents.error}
        />
      )}

      {incidents.status === "success" && incidents.data.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          title={query ? "No incidents match this search" : "No incidents yet"}
          description={
            query
              ? "Try a different title or narrative. No fallback or synthetic records are shown."
              : "Incidents produced by the Understand stage will appear here with lifecycle, assignment, evidence, and verification status."
          }
        />
      )}

      {incidents.status === "success" && incidents.data.length > 0 && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[1.4fr_0.7fr_0.9fr_0.9fr_1fr_1fr_1fr] gap-3 border-b border-navy-700/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span>Incident</span>
            <span>Severity</span>
            <span>Status</span>
            <span>Assignee</span>
            <span>Affected</span>
            <span>Action</span>
            <span>Verification</span>
          </div>
          {incidents.data.map((i) => (
            <Link
              key={i.incident_id}
              href={`/incidents/${i.incident_id}`}
              className="grid grid-cols-[1.4fr_0.7fr_0.9fr_0.9fr_1fr_1fr_1fr] gap-3 border-b border-navy-700/30 px-4 py-4 transition-colors last:border-b-0 hover:bg-navy-800/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{i.title}</p>
                <p className="mt-1 text-xs text-gray-500">{i.incident_id}</p>
                <p className="mt-1 text-xs text-gray-600">
                  Updated {i.updated_at ?? i.opened_at}
                </p>
              </div>
              <div>
                <span className={`badge ${SEVERITY_BADGE[i.severity]}`}>{i.severity}</span>
                <p className="mt-2 text-xs text-gray-500">
                  Confidence {confidence(i.confidence)}
                </p>
              </div>
              <div>
                <span
                  className={`badge ${
                    STATE_BADGE[i.state as IncidentState] ?? "badge-neutral"
                  }`}
                >
                  {String(i.state).replace(/_/g, " ")}
                </span>
                <p className="mt-2 text-xs text-gray-500">
                  {i.lifecycle_state ?? "Lifecycle pending"}
                </p>
              </div>
              <div className="min-w-0 text-sm text-gray-300">
                <p className="truncate">{i.assigned_to ?? "Unassigned"}</p>
              </div>
              <div className="min-w-0 text-sm text-gray-300">
                <p className="truncate">{affected(i)}</p>
                <p className="mt-1 truncate text-xs text-gray-500">
                  {(i.source_components ?? []).join(", ") || "Sources unavailable"}
                </p>
              </div>
              <div className="text-sm text-gray-300">
                <p>{i.action_status ?? "Pending"}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {i.decision_state ?? "Decision state unavailable"}
                </p>
              </div>
              <div className="text-sm text-gray-300">
                <p>{i.verification_status ?? "Pending"}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Residual {i.residual_risk ?? "unavailable"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
