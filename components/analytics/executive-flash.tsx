import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Target, Calendar, Activity } from "lucide-react"
import ReactMarkdown from "react-markdown"
import type { ExecFlash, KPI } from "./types"

interface ExecutiveFlashProps {
  data: ExecFlash
  kpis?: KPI[]
}

// Format date to a more readable format
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString
    }

    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date)
  } catch (error) {
    console.error("Error formatting date:", error)
    return dateString
  }
}

export function ExecutiveFlash({ data, kpis = [] }: ExecutiveFlashProps) {
  // Transform markdown content to ensure double line breaks
  const enhancedMarkdown = data?.summary?.replace(/\n/g, '\n\n')

  return (
    <Card className="overflow-hidden pt-0 pb-6">
      <CardHeader className="bg-slate-50 dark:bg-slate-900 px-6 py-6 flex items-center justify-between">
        <div className="flex items-center justify-between w-full">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            {data?.title || "No title"}
          </CardTitle>
          <div className="flex items-center gap-2">
            {kpis.length > 0 && (
              <Badge variant="outline" className="text-xs">
                <Activity className="h-3 w-3 mr-1" />
                {kpis.length} KPIs analyzed
              </Badge>
            )}
            {data?.date && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground bg-white dark:bg-slate-800 px-2 py-1 rounded-md border">
                <Calendar className="h-3 w-3" />
                <time dateTime={data.date}>{formatDate(data.date)}</time>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {enhancedMarkdown ? (
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed [&>p]:mb-4 [&>p:last-child]:mb-0">
            <ReactMarkdown>{enhancedMarkdown}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">No summary available</p>
        )}
      </CardContent>
    </Card>
  )
}
