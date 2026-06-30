import { AppShell } from '@/components/AppShell'
import { DataSourceBadge } from '@/components/DataSourceBadge'
import { Header } from '@/components/Header'
import { CaseList } from '@/components/Tables'
import { getPortalData } from '@/lib/portalData'

export default async function CasesPage() {
  const { source, cases } = await getPortalData()

  return (
    <AppShell active="/cases">
      <Header title="Cases" eyebrow="Investigation workspace">
        <DataSourceBadge source={source} />
      </Header>
      <CaseList cases={cases} />
    </AppShell>
  )
}
