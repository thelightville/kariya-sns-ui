import { AppShell } from '@/components/AppShell'
import { DataSourceBadge } from '@/components/DataSourceBadge'
import { Header } from '@/components/Header'
import { ConnectorList } from '@/components/Tables'
import { getPortalData } from '@/lib/portalData'

export default async function ConnectorsPage() {
  const { source, connectors } = await getPortalData()

  return (
    <AppShell active="/connectors">
      <Header title="KIF Connectors" eyebrow="Sense stage visibility">
        <DataSourceBadge source={source} />
      </Header>
      <ConnectorList connectors={connectors} />
    </AppShell>
  )
}
