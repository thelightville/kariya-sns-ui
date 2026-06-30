import { AppShell } from '@/components/AppShell'
import { Header } from '@/components/Header'
import { PolicyList } from '@/components/Tables'
import { policies } from '@/lib/data'

export default function PolicyPage() {
  return (
    <AppShell active="/policy">
      <Header title="Policy" eyebrow="Approval posture" />
      <PolicyList policies={policies} />
    </AppShell>
  )
}
