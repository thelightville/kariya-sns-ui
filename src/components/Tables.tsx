import { clsx } from 'clsx'
import type { Connector, Incident, PolicyItem, WorkCase } from '@/lib/types'

const severityClass: Record<Incident['severity'], string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-700',
}

export function IncidentTable({ incidents }: { incidents: Incident[] }) {
  return (
    <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-panel">
      <table className="w-full table-fixed divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-28 px-4 py-3">ID</th>
            <th className="px-4 py-3">Incident</th>
            <th className="w-28 px-4 py-3">Severity</th>
            <th className="w-32 px-4 py-3">Status</th>
            <th className="w-36 px-4 py-3">Affected</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {incidents.map((incident) => (
            <tr key={incident.id}>
              <td className="px-4 py-4 font-medium text-ink">{incident.id}</td>
              <td className="px-4 py-4">
                <p className="font-medium text-ink">{incident.title}</p>
                <p className="mt-1 text-xs text-slate-500">{incident.source}</p>
              </td>
              <td className="px-4 py-4">
                <span className={clsx('rounded px-2 py-1 text-xs font-medium', severityClass[incident.severity])}>
                  {incident.severity}
                </span>
              </td>
              <td className="px-4 py-4 text-slate-600">{incident.status}</td>
              <td className="px-4 py-4 text-slate-600">{incident.affected}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CaseList({ cases }: { cases: WorkCase[] }) {
  return (
    <div className="grid gap-3">
      {cases.map((workCase) => (
        <section key={workCase.id} className="rounded border border-slate-200 bg-white p-4 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500">{workCase.id}</p>
              <h2 className="mt-1 text-base font-semibold text-ink">{workCase.name}</h2>
            </div>
            <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{workCase.state}</span>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Owner: {workCase.owner}. Linked incidents: {workCase.linkedIncidents}.
          </p>
        </section>
      ))}
    </div>
  )
}

export function PolicyList({ policies }: { policies: PolicyItem[] }) {
  return (
    <div className="grid gap-3">
      {policies.map((policy) => (
        <section key={policy.id} className="rounded border border-slate-200 bg-white p-4 shadow-panel">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">{policy.id}</p>
              <h2 className="mt-1 text-base font-semibold text-ink">{policy.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{policy.coverage}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm font-medium text-ink">{policy.mode}</p>
              <p className="text-xs text-slate-500">{policy.pendingApprovals} pending approvals</p>
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}

export function ConnectorList({ connectors }: { connectors: Connector[] }) {
  return (
    <div className="grid gap-3">
      {connectors.map((connector) => (
        <section key={connector.name} className="rounded border border-slate-200 bg-white p-4 shadow-panel">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-ink">{connector.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{connector.stage} stage - {connector.tenantScope}</p>
            </div>
            <span
              className={clsx(
                'rounded px-2 py-1 text-xs font-medium',
                connector.status === 'healthy' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
              )}
            >
              {connector.status}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500">Last event: {connector.lastEvent}</p>
        </section>
      ))}
    </div>
  )
}
