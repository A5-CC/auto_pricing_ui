import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react"
import type { KPI } from "./types"

interface KPICardProps {
  kpi: KPI
}

export function KPICard({ kpi }: KPICardProps) {
  // Clean up redundant KPI name from definition
  const cleanDefinition = (name: string, definition: string): string => {
    // Check if definition starts with the KPI name (case insensitive)
    const nameLower = name.toLowerCase()
    const definitionLower = definition.toLowerCase()

    if (definitionLower.startsWith(nameLower)) {
      // Remove the KPI name and any following whitespace
      let cleaned = definition.substring(name.length).trim()

      // Capitalize the first letter of the remaining text
      if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
      }

      return cleaned
    }

    return definition
  }

  // Handle flat/unchanged state messaging
  const getDeltaDisplay = () => {
    if (kpi.delta.direction === "flat") {
      return {
        text: kpi.delta.label,
        showValue: false,
        isFlat: true,
      }
    }
    return {
      text: kpi.delta.label,
      showValue: true,
      isFlat: false,
    }
  }

  const deltaDisplay = getDeltaDisplay()
  const cleanedDefinition = cleanDefinition(kpi.name, kpi.tooltip.definition)

  return (
    <TooltipProvider>
      <Card className="relative">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <CardTitle className="text-sm font-medium text-gray-900 mb-1">{kpi.name}</CardTitle>
              <p className="text-xs text-gray-600 leading-relaxed">{cleanedDefinition}</p>
            </div>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div>
                  <p className="text-xs font-medium">Formula:</p>
                  <p className="text-xs text-gray-500 mt-1">{kpi.tooltip.formula}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{kpi.current.value}</span>
              <span className="text-xs text-gray-500 uppercase">{kpi.current.period_label}</span>
            </div>
            <div className="flex items-center gap-1">
              {kpi.delta.direction === "up" ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : kpi.delta.direction === "down" ? (
                <TrendingDown className="h-4 w-4 text-red-600" />
              ) : (
                <Minus className="h-4 w-4 text-gray-400" />
              )}

              {deltaDisplay.showValue && (
                <span
                  className={`text-sm font-medium ${
                    kpi.delta.direction === "up"
                      ? "text-green-600"
                      : kpi.delta.direction === "down"
                        ? "text-red-600"
                        : "text-gray-500"
                  }`}
                >
                  {kpi.delta.value}
                </span>
              )}

              {deltaDisplay.isFlat ? (
                <span className="text-xs text-gray-400">
                  <span className="font-semibold">No change</span>{" "}
                  <span>{deltaDisplay.text}</span>
                </span>
              ) : (
                <span className="text-xs text-gray-500">
                  {deltaDisplay.text}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
