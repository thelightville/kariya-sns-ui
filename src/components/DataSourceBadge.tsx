import type { DataSourceStatus } from '@/lib/portalData'

interface DataSourceBadgeProps {
  source: DataSourceStatus
}

export function DataSourceBadge({ source }: DataSourceBadgeProps) {
  return (
    <div className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-panel">
      {source.label}
    </div>
  )
}
