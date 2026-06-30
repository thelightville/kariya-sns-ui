import { cases, connectors, incidents, policies, socMetrics } from './data'
import type { Connector, Incident, PolicyItem, SocMetric, WorkCase } from './types'

export type DataSourceMode = 'preview' | 'facade-ready'

export interface DataSourceStatus {
  mode: DataSourceMode
  label: string
}

export interface DashboardData {
  source: DataSourceStatus
  metrics: SocMetric[]
  incidents: Incident[]
}

export interface PortalData {
  source: DataSourceStatus
  incidents: Incident[]
  cases: WorkCase[]
  policies: PolicyItem[]
  connectors: Connector[]
}

const previewSource: DataSourceStatus = {
  mode: 'preview',
  label: 'Preview data',
}

export async function getDashboardData(): Promise<DashboardData> {
  return {
    source: previewSource,
    metrics: socMetrics,
    incidents,
  }
}

export async function getPortalData(): Promise<PortalData> {
  return {
    source: previewSource,
    incidents,
    cases,
    policies,
    connectors,
  }
}
