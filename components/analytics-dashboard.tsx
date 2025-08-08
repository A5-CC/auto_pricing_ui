"use client"

import { TooltipProvider } from "@/components/ui/tooltip"
import { DashboardHeader } from "@/components/analytics/dashboard-header"
import { ExecutiveFlash } from "@/components/analytics/executive-flash"
import { KPIGrid } from "@/components/analytics/kpi-grid"
import { InsightsSection } from "@/components/analytics/insights-section"
import { Footer } from "@/components/analytics/footer-actions"
import { UploadForm } from "@/components/upload-form"
import { ProcessingBanner } from "@/components/processing-banner"
import { HistorySelector } from "@/components/history-selector"
import { DashboardData } from "@/components/analytics/types"
import { AppMode, DocMeta } from "@/lib/api/types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Upload } from "lucide-react"
import { GenericBarChart } from "@/components/analytics/generic-bar-chart"

interface AnalyticsDashboardProps {
  mode: AppMode
  summary: DashboardData | null
  history: DocMeta[]
  currentFileName: string
  onUpload: (files: File[]) => Promise<void>
  onHistorySelect: (docId: string) => Promise<void>
  onCancel: () => void
  onReset: () => void
}

export default function AnalyticsDashboard({
  mode,
  summary,
  history,
  currentFileName,
  onUpload,
  onHistorySelect,
  onCancel,
  onReset
}: AnalyticsDashboardProps) {
  const renderContent = () => {
    switch (mode) {
      case 'idle':
        return (
          <div className="space-y-6">
            <UploadForm
              onUpload={onUpload}
              isUploading={false}
            />
            <HistorySelector
              history={history}
              onSelect={onHistorySelect}
              isLoading={false}
            />
          </div>
        )

      case 'uploading':
      case 'processing':
        return (
          <ProcessingBanner
            fileName={currentFileName}
            onCancel={onCancel}
          />
        )

      case 'done':
        if (!summary) {
          return (
            <div className="space-y-6">
              <Card className="w-full max-w-2xl mx-auto border bg-white">
                <CardContent className="py-6">
                  <div className="flex flex-col items-center space-y-4">
                    <h3 className="text-lg font-medium text-gray-700">No Data Available</h3>
                    <div className="text-gray-600 text-center">
                      No analysis data was found. Please try uploading files again.
                    </div>
                    <Button
                      variant="outline"
                      onClick={onReset}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload New Files
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        }

        // Convert chart_spec to key_chart format
        const chartData = summary.chart_spec ? {
          title: summary.chart_spec.chart_js_object.title,
          data: summary.chart_spec.chart_js_object.datasets[0]?.data.map((value, index) => ({
            label: summary.chart_spec!.chart_js_object.labels[index] || `Item ${index + 1}`,
            value: value
          })) || []
        } : undefined

        return (
          <div className="space-y-6">
            <DashboardHeader title={summary.filename || "Analysis Results"} onReset={onReset} />
            <ExecutiveFlash data={summary.exec_flash} kpis={summary.kpis} />
            <KPIGrid kpis={summary.kpis} />
            <GenericBarChart data={chartData} />
            <InsightsSection insights={summary.expert_insights} kpis={summary.kpis} />
          </div>
        )

      case 'error':
        return (
          <div className="space-y-6">
            <Card className="w-full max-w-2xl mx-auto border bg-white">
              <CardContent className="py-6">
                <div className="flex flex-col items-center space-y-4">
                  <h3 className="text-lg font-medium text-gray-700">Processing Issue</h3>
                  <div className="text-gray-600 text-center">
                    An error occurred while processing your files. Please try again.
                  </div>
                  <Button
                    variant="outline"
                    onClick={onReset}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload New Files
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="opacity-80">
              <HistorySelector
                history={history}
                onSelect={onHistorySelect}
                isLoading={false}
              />
            </div>
          </div>
        )

      case 'timeout':
        return (
          <div className="space-y-6">
            <Card className="w-full max-w-2xl mx-auto border bg-white">
              <CardContent className="py-6">
                <div className="flex flex-col items-center space-y-4">
                  <h3 className="text-lg font-medium text-gray-700">Analysis Taking Too Long</h3>
                  <div className="text-gray-600 text-center">
                    The analysis is taking longer than expected. Please try again or upload smaller files.
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={onReset}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                    <Button
                      variant="outline"
                      onClick={onReset}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload New Files
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="opacity-80">
              <HistorySelector
                history={history}
                onSelect={onHistorySelect}
                isLoading={false}
                mode="timeout"
              />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </div>
        <Footer
          dashboardData={summary}
          history={history}
          onHistorySelect={onHistorySelect}
          mode={mode}
        />
      </div>
    </TooltipProvider>
  )
}
