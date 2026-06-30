import { AppShell } from '@/components/AppShell'
import { DataSourceBadge } from '@/components/DataSourceBadge'
import { Header } from '@/components/Header'
import { MetricCard } from '@/components/MetricCard'
import { IncidentTable } from '@/components/Tables'
import { getDashboardData } from '@/lib/portalData'

export default async function DashboardPage() {
  const { source, metrics, incidents } = await getDashboardData()

  return (
    <AppShell active="/">
      <Header title="SOC Dashboard" eyebrow="K-SNS dedicated UI">
        <DataSourceBadge source={source} />
      </Header>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
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
