"use client";

import { ExternalLink, LockKeyhole } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  buildKesConsoleReviewUrl,
  isKesTargetedAction,
} from "@/lib/kesConsoleHandoff.mjs";
import type { KsnsAction } from "@/types/ksns";

const subscribeToHostname = () => () => {};
const getHostnameSnapshot = () => window.location.hostname;
const getServerHostnameSnapshot = () => "";

export default function KesConsoleHandoff({ action }: { action: KsnsAction }) {
  const hostname = useSyncExternalStore(
    subscribeToHostname,
    getHostnameSnapshot,
    getServerHostnameSnapshot
  );

  if (!isKesTargetedAction(action.enforcement_surface)) {
    return null;
  }

  const href = buildKesConsoleReviewUrl({
    hostname,
    actionId: action.action_id,
    incidentId: action.incident_id,
  });

  if (!href) {
    return (
      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-gray-600">
        <LockKeyhole className="mt-0.5 h-3 w-3 shrink-0" />
        KES posture review is unavailable on this host. No dispatch is attempted.
      </p>
    );
  }

  return (
    <div className="mt-2">
      <a
        href={href}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-kariya-400 hover:text-kariya-300"
      >
        Review KES response posture in Console
        <ExternalLink className="h-3 w-3" />
      </a>
      <p className="mt-1 text-[10px] leading-4 text-gray-600">
        Lookup hints only. Console re-resolves tenant and role; this link does not dispatch.
      </p>
    </div>
  );
}
