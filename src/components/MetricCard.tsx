import { clsx } from 'clsx'
import type { SocMetric } from '@/lib/types'

const toneClasses: Record<SocMetric['tone'], string> = {
  signal: 'border-blue-200 bg-blue-50 text-blue-700',
  resolve: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warn: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
}

export function MetricCard({ metric }: { metric: SocMetric }) {
  return (
    <section className="rounded border border-slate-200 bg-white p-4 shadow-panel">
      <p className="text-sm text-slate-500">{metric.label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold text-ink">{metric.value}</p>
        <span className={clsx('rounded border px-2 py-1 text-xs font-medium', toneClasses[metric.tone])}>
          {metric.trend}
        </span>
      </div>
    </section>
  )
}
