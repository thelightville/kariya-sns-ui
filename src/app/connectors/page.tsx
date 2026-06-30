import { AppShell } from '@/components/AppShell'
import { Header } from '@/components/Header'
import { ConnectorList } from '@/components/Tables'
import { connectors } from '@/lib/data'

export default function ConnectorsPage() {
  return (
    <AppShell active="/connectors">
      <Header title="KIF Connectors" eyebrow="Sense stage visibility" />
      <ConnectorList connectors={connectors} />
    </AppShell>
  )
}
