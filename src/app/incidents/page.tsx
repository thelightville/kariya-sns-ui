import { AppShell } from '@/components/AppShell'
import { DataSourceBadge } from '@/components/DataSourceBadge'
import { Header } from '@/components/Header'
import { IncidentTable } from '@/components/Tables'
import { getPortalData } from '@/lib/portalData'

export default async function IncidentsPage() {
  const { source, incidents } = await getPortalData()

  return (
    <AppShell active="/incidents">
      <Header title="Incidents" eyebrow="Triage queue">
        <DataSourceBadge source={source} />
      </Header>
      <IncidentTable incidents={incidents} />
    </AppShell>
  )
}
