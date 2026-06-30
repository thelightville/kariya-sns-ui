import { AppShell } from '@/components/AppShell'
import { Header } from '@/components/Header'
import { IncidentTable } from '@/components/Tables'
import { incidents } from '@/lib/data'

export default function IncidentsPage() {
  return (
    <AppShell active="/incidents">
      <Header title="Incidents" eyebrow="Triage queue" />
      <IncidentTable incidents={incidents} />
    </AppShell>
  )
}
