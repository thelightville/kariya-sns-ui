"use client";

import { useState } from "react";
import { Check, X, Send, Loader2 } from "lucide-react";

/**
 * ApprovalAction — the single structural gate for every K-SNS action button.
 *
 * Per ADR-0016 (D-02): K-SNS is a coordination/decision-recommendation hub,
 * NOT an enforcement system. Any UI copy or interaction implying K-SNS (or
 * KAI) directly executes/enforces a network or endpoint action is prohibited
 * until AI Safety Tier 2 is validated.
 *
 * Every page that lets an operator act on a recommendation, decision, or
 * policy MUST use this component rather than a bespoke button. That way the
 * "Approve / Reject / Request Action" boundary is enforced by having exactly
 * one implementation, not by every page remembering a copy convention.
 *
 * `intent` controls the only three verbs this component will ever render:
 *   - "approve" -> "Approve"        (green)
 *   - "reject"  -> "Reject"         (red)
 *   - "request" -> "Request Action" (amber) — asks KES/KEA to carry out the
 *                                     enforcement step under approved policy;
 *                                     K-SNS itself never performs it.
 *
 * There is intentionally no "execute" / "enforce" / "block now" intent.
 */
export type ApprovalIntent = "approve" | "reject" | "request";

const INTENT_CONFIG: Record<
  ApprovalIntent,
  { label: string; icon: typeof Check; className: string }
> = {
  approve: {
    label: "Approve",
    icon: Check,
    className:
      "bg-green-500/10 text-green-400 hover:bg-green-500/20 shadow-[inset_0_0_0_1px_rgba(34,197,94,0.3)]",
  },
  reject: {
    label: "Reject",
    icon: X,
    className:
      "bg-red-500/10 text-red-400 hover:bg-red-500/20 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.3)]",
  },
  request: {
    label: "Request Action",
    icon: Send,
    className:
      "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.3)]",
  },
};

interface ApprovalActionProps {
  intent: ApprovalIntent;
  onAction: () => Promise<void> | void;
  disabled?: boolean;
  /** Optional override — must still describe a recommendation/coordination
   * step, never a direct enforcement action. Defaults to the intent label. */
  label?: string;
}

export default function ApprovalAction({
  intent,
  onAction,
  disabled,
  label,
}: ApprovalActionProps) {
  const [pending, setPending] = useState(false);
  const config = INTENT_CONFIG[intent];
  const Icon = pending ? Loader2 : config.icon;

  async function handleClick() {
    if (pending || disabled) return;
    setPending(true);
    try {
      await onAction();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || pending}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${config.className}`}
    >
      <Icon className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
      {label ?? config.label}
    </button>
  );
}
