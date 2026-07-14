import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  FileSearch,
  Fingerprint,
  GitBranch,
  Globe2,
  LockKeyhole,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import workflow from "@/data/founderWorkflow.json";

const stateStyle: Record<string, string> = {
  implemented: "badge-ok",
  "contract-only": "badge-neutral",
  synthetic: "badge-warn",
  unavailable: "badge-neutral",
};

const lifecycle = [
  { label: "Sense", value: "Event received", icon: Radar, tone: "text-sky-400" },
  { label: "Understand", value: workflow.assessment.outcome, icon: GitBranch, tone: "text-kariya-400" },
  { label: "Trust", value: `${workflow.trust_context.before} → ${workflow.trust_context.after}`, icon: Fingerprint, tone: "text-amber-400" },
  { label: "Decide", value: workflow.recommendation.state, icon: Sparkles, tone: "text-violet-400" },
  { label: "Act", value: workflow.recommendation.dispatch, icon: LockKeyhole, tone: "text-gray-400" },
  { label: "Verify", value: workflow.verification.state, icon: CircleDashed, tone: "text-gray-400" },
];

function SyntheticBadge({ label = "Synthetic" }: { label?: string }) {
  return <span className="badge badge-warn">{label}</span>;
}

export default function FounderWorkflowPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-2xl border border-kariya-500/25 bg-gradient-to-br from-kariya-500/10 via-navy-900/80 to-navy-950 p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <SyntheticBadge label="Synthetic walkthrough" />
              <span className="badge badge-neutral">No customer data</span>
              <span className="badge badge-neutral">Recommendation only</span>
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-kariya-400">Founder workflow</p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{workflow.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">{workflow.summary}</p>
          </div>
          <div className="rounded-xl border border-navy-700/50 bg-navy-950/60 px-4 py-3 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">Scenario ID</p>
            <p className="mt-1 font-mono text-xs text-gray-300">{workflow.scenario_id}</p>
          </div>
        </div>
      </section>

      <section aria-label="K-SNS lifecycle" className="card p-5">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">End-to-end state</p><h2 className="mt-1 text-lg font-semibold text-white">Event to residual risk</h2></div>
          <p className="max-w-lg text-xs leading-5 text-gray-500">Orange labels are synthetic. Gray stages are incomplete because no response was executed.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {lifecycle.map(({ label, value, icon: Icon, tone }, index) => (
            <div key={label} className="rounded-xl border border-navy-700/50 bg-navy-950/45 p-4">
              <div className="flex items-center justify-between"><Icon className={`h-4 w-4 ${tone}`} /><span className="text-[10px] text-gray-600">0{index + 1}</span></div>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">{label}</p>
              <p className="mt-1 min-h-10 text-sm font-medium leading-5 text-white">{value}</p>
              <div className="mt-3"><SyntheticBadge /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 text-sky-400"><Radar className="h-4 w-4" /><h2 className="text-xs font-semibold uppercase tracking-wide">Safe-to-demo event</h2></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Signal", workflow.event.signal], ["Source", workflow.event.source], ["Subject", workflow.event.subject],
              ["Event type", workflow.event.type], ["Observed", workflow.event.observed_at], ["Data", workflow.event.data_classification],
            ].map(([label, value]) => <div key={label}><p className="text-xs text-gray-600">{label}</p><p className="mt-1 text-sm text-white">{value}</p><div className="mt-2"><SyntheticBadge /></div></div>)}
          </div>
        </article>
        <article className="card p-5">
          <div className="flex items-center gap-2 text-amber-400"><ShieldAlert className="h-4 w-4" /><h2 className="text-xs font-semibold uppercase tracking-wide">Incident candidate</h2></div>
          <div className="mt-4 flex items-end justify-between"><div><p className="text-2xl font-semibold text-white">{Math.round(workflow.assessment.confidence * 100)}%</p><p className="text-xs text-gray-600">Synthetic confidence</p></div><span className="badge badge-error">{workflow.assessment.severity}</span></div>
          <p className="mt-4 text-sm leading-6 text-gray-400">{workflow.assessment.reason}</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <div className="flex items-center gap-2 text-amber-400"><Fingerprint className="h-4 w-4" /><h2 className="text-xs font-semibold uppercase tracking-wide">Risk and trust context</h2></div>
          <div className="mt-5 flex items-center gap-4">
            <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-center"><p className="text-2xl font-semibold text-emerald-400">{workflow.trust_context.before}</p><p className="text-[10px] uppercase text-gray-600">Before</p></div>
            <ArrowRight className="h-5 w-5 text-gray-600" />
            <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-center"><p className="text-2xl font-semibold text-amber-400">{workflow.trust_context.after}</p><p className="text-[10px] uppercase text-gray-600">After</p></div>
            <div className="ml-auto text-right"><p className="text-xs text-gray-600">Risk posture</p><p className="mt-1 text-sm font-semibold text-amber-400">{workflow.trust_context.risk}</p></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">{workflow.trust_context.drivers.map((driver) => <span key={driver} className="badge badge-neutral">{driver}</span>)}</div>
        </article>
        <article className="card p-5">
          <div className="flex items-center gap-2 text-sky-400"><FileSearch className="h-4 w-4" /><h2 className="text-xs font-semibold uppercase tracking-wide">Evidence</h2></div>
          <ul className="mt-4 space-y-3">{workflow.evidence.map((item) => <li key={item.ref} className="flex items-start justify-between gap-4 rounded-lg border border-navy-700/40 bg-navy-950/35 p-3"><div><p className="text-sm font-medium text-white">{item.label}</p><p className="mt-1 font-mono text-[11px] text-gray-600">{item.ref}</p></div><SyntheticBadge /></li>)}</ul>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="card p-5">
          <div className="flex items-center gap-2 text-violet-400"><Sparkles className="h-4 w-4" /><h2 className="text-xs font-semibold uppercase tracking-wide">Recommendation</h2></div>
          <p className="mt-4 text-base font-medium leading-6 text-white">{workflow.recommendation.action}</p><div className="mt-3"><SyntheticBadge label="Synthetic recommendation" /></div>
          <dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-gray-600">State</dt><dd className="mt-1 text-amber-400">{workflow.recommendation.state}</dd></div><div><dt className="text-xs text-gray-600">Execution owner</dt><dd className="mt-1 text-gray-300">{workflow.recommendation.execution_owner}</dd></div><div><dt className="text-xs text-gray-600">Dispatch</dt><dd className="mt-1 text-gray-300">{workflow.recommendation.dispatch}</dd></div></dl>
        </article>
        <article className="card p-5">
          <div className="flex items-center gap-2 text-gray-400"><CircleDashed className="h-4 w-4" /><h2 className="text-xs font-semibold uppercase tracking-wide">Verification</h2></div>
          <span className="mt-4 badge badge-neutral">Unavailable · {workflow.verification.state}</span><p className="mt-4 text-xs text-gray-600">Expected result</p><p className="mt-1 text-sm leading-6 text-gray-300">{workflow.verification.expected}</p><p className="mt-4 text-xs text-gray-600">Observed result</p><p className="mt-1 text-sm leading-6 text-gray-400">{workflow.verification.observed}</p>
        </article>
        <article className="card border-amber-500/20 p-5">
          <div className="flex items-center gap-2 text-amber-400"><AlertTriangle className="h-4 w-4" /><h2 className="text-xs font-semibold uppercase tracking-wide">Residual risk</h2></div>
          <p className="mt-4 text-2xl font-semibold text-amber-400">{workflow.residual_risk.level} · unresolved</p><p className="mt-3 text-sm leading-6 text-gray-400">{workflow.residual_risk.reason}</p><p className="mt-4 rounded-lg bg-amber-500/5 p-3 text-xs leading-5 text-amber-200/80">{workflow.residual_risk.next_step}</p>
        </article>
      </section>

      <section className="card p-5">
        <div className="flex items-center gap-2 text-gray-400"><ShieldCheck className="h-4 w-4" /><h2 className="text-xs font-semibold uppercase tracking-wide">Product reality</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{workflow.capability_states.map((capability) => <div key={capability.label} className="rounded-xl border border-navy-700/40 bg-navy-950/35 p-4"><span className={`badge ${stateStyle[capability.state] ?? "badge-neutral"}`}>{capability.state}</span><p className="mt-3 text-sm font-medium text-white">{capability.label}</p><p className="mt-2 text-xs leading-5 text-gray-500">{capability.detail}</p></div>)}</div>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-navy-700/40 bg-navy-950/35 p-4 text-xs leading-5 text-gray-500"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />This view does not call a response system, claim live KAI/KIF/KES/KEA participation, mark an action successful, infer verification, expose the private K-SNS URL, or claim production readiness.</div>
      </section>

      <section className="card p-5">
        <div className="flex items-center gap-2 text-sky-400"><Globe2 className="h-4 w-4" /><h2 className="text-xs font-semibold uppercase tracking-wide">Authenticated review readiness</h2></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-navy-700/40 bg-navy-950/35 p-4">
            <span className="badge badge-neutral">{workflow.review_access.state}</span>
            <p className="mt-3 text-sm font-medium text-white">Approved K-SNS origins</p>
            <p className="mt-2 font-mono text-xs text-gray-400">{workflow.review_access.approved_hosts.join(" · ")}{workflow.review_access.path}</p>
            <p className="mt-3 text-xs leading-5 text-gray-500">{workflow.review_access.authentication}</p>
            <p className="mt-2 text-xs leading-5 text-gray-500">{workflow.review_access.backend_boundary}</p>
            <p className="mt-2 text-xs leading-5 text-amber-300/80">{workflow.review_access.deployment}</p>
            <p className="mt-2 text-xs leading-5 text-gray-600">{workflow.review_access.review_notes}</p>
          </div>
          <div className="space-y-3">
            {workflow.integration_paths.map((integration) => (
              <div key={integration.product} className="rounded-xl border border-navy-700/40 bg-navy-950/35 p-4">
                <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-white">{integration.product} integration path</p><span className="badge badge-neutral">{integration.state}</span></div>
                <p className="mt-3 text-xs leading-5 text-gray-300">{integration.path}</p>
                <p className="mt-2 text-xs leading-5 text-gray-500">{integration.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
