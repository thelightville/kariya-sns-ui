import { AppShell } from '@/components/AppShell'
import { DataSourceBadge } from '@/components/DataSourceBadge'
import { Header } from '@/components/Header'
import { PolicyList } from '@/components/Tables'
import { getPortalData } from '@/lib/portalData'

export default async function PolicyPage() {
  const { source, policies } = await getPortalData()

  return (
    <AppShell active="/policy">
      <Header title="Policy" eyebrow="Approval posture">
        <DataSourceBadge source={source} />
      </Header>
      <PolicyList policies={policies} />
    </AppShell>
  )
}
