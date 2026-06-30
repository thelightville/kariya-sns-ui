import { AppShell } from '@/components/AppShell'
import { Header } from '@/components/Header'
import { CaseList } from '@/components/Tables'
import { cases } from '@/lib/data'

export default function CasesPage() {
  return (
    <AppShell active="/cases">
      <Header title="Cases" eyebrow="Investigation workspace" />
      <CaseList cases={cases} />
    </AppShell>
  )
}
