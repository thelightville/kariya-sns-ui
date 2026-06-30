import type { Connector, Incident, PolicyItem, SocMetric, WorkCase } from './types'

export const socMetrics: SocMetric[] = [
  { label: 'Open incidents', value: '18', trend: '4 high priority', tone: 'danger' },
  { label: 'Cases in review', value: '11', trend: '6 awaiting owner', tone: 'warn' },
  { label: 'Connector health', value: '96%', trend: '2 degraded feeds', tone: 'resolve' },
  { label: 'Policy approvals', value: '7', trend: 'human approval required', tone: 'signal' },
]

export const incidents: Incident[] = [
  {
    id: 'INC-1042',
    title: 'Identity anomaly across finance workstations',
    severity: 'high',
    status: 'triage',
    source: 'K-SNS correlation',
    updatedAt: '2026-06-30T18:42:00Z',
    affected: '8 entities',
    explanation: 'KAI explanation received from K-SNS is pending operator review.',
  },
  {
    id: 'INC-1039',
    title: 'Suspicious outbound traffic from server segment',
    severity: 'critical',
    status: 'review',
    source: 'KES network events',
    updatedAt: '2026-06-30T17:12:00Z',
    affected: '3 entities',
    explanation: 'Recommended containment remains approval-gated.',
  },
  {
    id: 'INC-1037',
    title: 'Connector event burst from endpoint platform',
    severity: 'medium',
    status: 'monitoring',
    source: 'KIF connector',
    updatedAt: '2026-06-30T16:25:00Z',
    affected: '1 tenant',
    explanation: 'No autonomous action was executed by this UI.',
  },
]

export const cases: WorkCase[] = [
  { id: 'CASE-220', name: 'Finance workstation investigation', owner: 'SOC Tier 2', state: 'Evidence review', linkedIncidents: 4 },
  { id: 'CASE-219', name: 'Connector fidelity review', owner: 'Platform Ops', state: 'Awaiting notes', linkedIncidents: 2 },
  { id: 'CASE-218', name: 'Policy exception audit', owner: 'Security Lead', state: 'Approval queue', linkedIncidents: 1 },
]

export const policies: PolicyItem[] = [
  { id: 'POL-31', name: 'High-risk endpoint isolation', mode: 'Approval required', coverage: 'Enterprise tenants', pendingApprovals: 3 },
  { id: 'POL-27', name: 'Connector event severity mapping', mode: 'Observe only', coverage: 'KIF feeds', pendingApprovals: 0 },
  { id: 'POL-22', name: 'Privileged identity review', mode: 'Approval required', coverage: 'Admin users', pendingApprovals: 4 },
]

export const connectors: Connector[] = [
  { name: 'Microsoft Defender', stage: 'Sense', status: 'healthy', lastEvent: '2 min ago', tenantScope: 'Enterprise' },
  { name: 'Palo Alto Cortex XDR', stage: 'Sense', status: 'healthy', lastEvent: '4 min ago', tenantScope: 'Enterprise' },
  { name: 'FortiGate', stage: 'Sense', status: 'degraded', lastEvent: '23 min ago', tenantScope: 'Pilot' },
]
