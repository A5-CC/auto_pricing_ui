import { KPICard } from "./kpi-card"
import type { KPI } from "./types"

interface KPIGridProps {
  kpis: KPI[]
}

export function KPIGrid({ kpis }: KPIGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {kpis.map((kpi) => (
        <KPICard key={kpi.id} kpi={kpi} />
      ))}
    </div>
  )
}