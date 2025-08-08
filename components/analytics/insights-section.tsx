import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, AlertTriangle, Lightbulb, Target, Clock } from "lucide-react"
import type { Insights, KPI } from "./types"
import { ComponentType } from "react"

interface InsightsSectionProps {
  insights?: Insights
  kpis?: KPI[]
}

// Helper function to get KPI name by ID
function getKPIName(kpiId: string | null, kpis?: KPI[]): string {
  if (!kpiId || !kpis) {
    return kpiId?.replaceAll("_", " ") || ""
  }

  const kpi = kpis.find(k => k.id === kpiId)
  return kpi ? kpi.name : kpiId.replaceAll("_", " ")
}

// Hero-style Key Insight Component
function KeyInsightCard({ headline }: { headline: string }) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200">
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-amber-500/5" />
      <div className="relative p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
              <Lightbulb className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-orange-900 mb-2">Key Insight</h3>
            <p className="text-gray-800 font-medium leading-relaxed text-base">{headline}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Shared component for Opportunities and Risks
function OpportunityRiskCard({
  type,
  items,
  icon: Icon,
  colorScheme,
  kpis,
}: {
  type: string
  items: Array<{ content: string; kpi_ref: string | null }>
  icon: ComponentType<{ className?: string }>
  kpis?: KPI[]
  colorScheme: {
    border: string
    title: string
    bg: string
    text: string
    iconBg: string
  }
}) {
  return (
    <Card className={`${colorScheme.border} h-full`}>
      <CardHeader className="pb-4">
        <CardTitle className={`flex items-center gap-2 ${colorScheme.title}`}>
          <Icon className="h-5 w-5" />
          {type}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex gap-3">
                <div
                  className={`flex-shrink-0 w-6 h-6 ${colorScheme.bg} rounded-full flex items-center justify-center mt-0.5`}
                >
                  <span className={`text-xs font-medium ${colorScheme.text}`}>{index + 1}</span>
                </div>
                <p className="text-base text-gray-700 leading-relaxed">{item.content}</p>
              </div>
              {item.kpi_ref && (
                <div className="ml-9">
                  <Badge variant="outline" className="text-sm">
                    Impacts: {getKPIName(item.kpi_ref, kpis)}
                  </Badge>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Action-oriented component for Immediate Actions
function ImmediateActionsCard({ actions, kpis }: { actions: Array<{ content: string; kpi_ref: string | null }>; kpis?: KPI[] }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
          <Target className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-blue-900">Immediate Actions</h3>
          <p className="text-sm text-blue-700">Priority tasks requiring attention</p>
        </div>
      </div>

      <div className="grid gap-3">
        {actions.map((action, index) => (
          <div key={index} className="bg-white rounded-lg border border-blue-100 p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mt-0.5">
                <span className="text-sm font-semibold text-blue-700">{index + 1}</span>
              </div>
              <div className="flex-1">
                <p className="text-base text-gray-800 leading-relaxed mb-2">{action.content}</p>
                <div className="flex items-center justify-between">
                  {action.kpi_ref && (
                    <Badge variant="secondary" className="text-xs">
                      <Target className="h-3 w-3 mr-1" />
                      {getKPIName(action.kpi_ref, kpis)}
                    </Badge>
                  )}
                  <div className="flex items-center gap-2 text-xs text-blue-600">
                    {index === 0 && (
                      <>
                        <Clock className="h-3 w-3" />
                        <span>High Priority</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function InsightsSection({ insights, kpis = [] }: InsightsSectionProps) {
  if (!insights) {
    return null
  }

  return (
    <div className="space-y-8">
      {/* Key Insight - Hero Treatment */}
      <KeyInsightCard headline={insights.headline} />

      {/* Opportunities and Risks - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <OpportunityRiskCard
          type="Opportunities"
          items={insights.opportunities}
          icon={TrendingUp}
          kpis={kpis}
          colorScheme={{
            border: "border-l-4 border-l-green-500",
            title: "text-green-700",
            bg: "bg-green-100",
            text: "text-green-700",
            iconBg: "bg-green-100",
          }}
        />

        <OpportunityRiskCard
          type="Risks"
          items={insights.risks}
          icon={AlertTriangle}
          kpis={kpis}
          colorScheme={{
            border: "border-l-4 border-l-red-500",
            title: "text-red-700",
            bg: "bg-red-100",
            text: "text-red-700",
            iconBg: "bg-red-100",
          }}
        />
      </div>

      {/* Immediate Actions - Full Width, Different Design */}
      <ImmediateActionsCard actions={insights.actions} kpis={kpis} />
    </div>
  )
}