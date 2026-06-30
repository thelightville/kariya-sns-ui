import { Activity, FileText, Gauge, GitBranch, LayoutDashboard, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { clsx } from 'clsx'

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/incidents', label: 'Incidents', icon: Activity },
  { href: '/cases', label: 'Cases', icon: FileText },
  { href: '/policy', label: 'Policy', icon: ShieldCheck },
  { href: '/connectors', label: 'Connectors', icon: GitBranch },
]

export function AppShell({ children, active }: { children: React.ReactNode; active: string }) {
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-ink text-white">
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">K-SNS</p>
            <p className="text-xs text-slate-500">Operator Console</p>
          </div>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {nav.map((item) => {
            const Icon = item.icon
            const current = active === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'focus-ring flex items-center gap-3 rounded px-3 py-2 text-sm font-medium',
                  current ? 'bg-ink text-white' : 'text-slate-700 hover:bg-slate-100',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
