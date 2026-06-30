export type Tone = 'signal' | 'resolve' | 'warn' | 'danger'

export interface SocMetric {
  label: string
  value: string
  trend: string
  tone: Tone
}

export type Severity = 'critical' | 'high' | 'medium' | 'low'

export interface Incident {
  id: string
  title: string
  severity: Severity
  status: string
  source: string
  updatedAt: string
  affected: string
  explanation: string
}

export interface WorkCase {
  id: string
  name: string
  owner: string
  state: string
  linkedIncidents: number
}

export interface PolicyItem {
  id: string
  name: string
  mode: 'Approval required' | 'Observe only'
  coverage: string
  pendingApprovals: number
}

export interface Connector {
  name: string
  stage: 'Sense'
  status: 'healthy' | 'degraded'
  lastEvent: string
  tenantScope: string
}
