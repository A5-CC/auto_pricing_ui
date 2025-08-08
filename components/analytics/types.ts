export interface KPITooltip {
  definition: string
  formula: string
}

export interface KPIDelta {
  value: string
  direction: "up" | "down" | "flat"
  label: string
}

export interface KPICurrent {
  value: string
  unit: string
  period_label: string
}

export interface KPI {
  id: string
  name: string
  current: KPICurrent
  delta: KPIDelta
  tooltip: KPITooltip
}

export interface ExecFlash {
  title: string
  date?: string
  summary: string
}

export interface ChartDataPoint {
  [key: string]: string | number
}

export interface KeyChart {
  title: string
  data: ChartDataPoint[]
}

export interface ChartSpec {
  explanation: string
  chart_js_object: {
    title: string
    type: string
    orientation?: string
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
    }>
  }
}

export interface OpportunityItem {
  content: string
  kpi_ref: string | null
}

export interface RiskItem {
  content: string
  kpi_ref: string | null
}

export interface Action {
  content: string
  kpi_ref: string | null
}

export interface Insights {
  headline: string
  opportunities: OpportunityItem[]
  risks: RiskItem[]
  actions: Action[]
}

// Backend response structure
export interface DashboardData {
  doc_id: string
  job_id: string
  filename: string
  processed_at: string
  exec_flash: ExecFlash
  kpis: KPI[]
  chart_spec: ChartSpec
  expert_insights: Insights
}

export type AppMode = 'idle' | 'uploading' | 'processing' | 'done' | 'error' | 'timeout'