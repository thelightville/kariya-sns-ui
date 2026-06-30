import { AppShell } from '@/components/AppShell'
import { Header } from '@/components/Header'
import { MetricCard } from '@/components/MetricCard'
import { IncidentTable } from '@/components/Tables'
import { incidents, socMetrics } from '@/lib/data'

export default function DashboardPage() {
  return (
    <AppShell active="/">
      <Header title="SOC Dashboard" eyebrow="K-SNS dedicated UI">
        <div className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-panel">
          Bootstrap preview - static typed data
        </div>
      </Header>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {socMetrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Priority incidents</h2>
          <p className="text-sm text-slate-500">Approval-gated operational view</p>
        </div>
        <IncidentTable incidents={incidents} />
      </section>
    </AppShell>
  )
}
