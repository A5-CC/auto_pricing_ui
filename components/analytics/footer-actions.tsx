"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Activity,
  Clock,
  FileText,
  Server,
  History,
  ChevronUp,
  ChevronDown
} from "lucide-react"
import { getSystemHealth, getVersionInfo } from "@/lib/api/client"
import { DashboardData } from "./types"
import { DocMeta } from "@/lib/api/types"
import { AppMode } from "@/lib/api/types"

interface FooterProps {
  dashboardData?: DashboardData | null
  history?: DocMeta[]
  onHistorySelect?: (docId: string) => void
  mode?: AppMode
}

export function Footer({ dashboardData, history = [], onHistorySelect, mode }: FooterProps) {
  const [systemStatus, setSystemStatus] = useState<'checking' | 'operational' | 'offline'>('checking')
  const [showHistory, setShowHistory] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [versionInfo, setVersionInfo] = useState<{ version: string; release_date: string; api: string } | null>(null)

  // Check system health and version on mount and periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await getSystemHealth()
        setSystemStatus(health.status === 'ok' || health.status === 'operational' ? 'operational' : 'offline')
        setLastChecked(new Date())
      } catch {
        setSystemStatus('offline')
        setLastChecked(new Date())
      }
    }

    const fetchVersion = async () => {
      const version = await getVersionInfo()
      setVersionInfo(version)
    }

    checkHealth()
    fetchVersion()
    const interval = setInterval(checkHealth, 13 * 3 * 1000) // Check every 13*3 seconds

    return () => clearInterval(interval)
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusIndicator = () => {
    switch (systemStatus) {
      case 'operational':
        return (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-700 font-medium">All systems operational</span>
          </div>
        )
      case 'offline':
        return (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-xs text-red-700 font-medium">System offline</span>
          </div>
        )
      case 'checking':
        return (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-600 font-medium">Checking status...</span>
          </div>
        )
    }
  }

  // Determine if we should show the history navigation section
  // Hide it when HistorySelector is visible (idle, error, timeout modes)
  const shouldShowHistoryNav = mode === 'done' || mode === 'uploading' || mode === 'processing'

  // Determine if we should show document info section
  const shouldShowDocumentInfo = !!dashboardData

  // Calculate grid columns based on what sections we're showing
  const getGridCols = () => {
    const sections = [shouldShowDocumentInfo, shouldShowHistoryNav, true].filter(Boolean).length // true = always show system status
    return sections === 1 ? 'grid-cols-1' : sections === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-3'
  }

  return (
    <footer className="mt-12 border-t bg-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className={`grid gap-8 ${getGridCols()}`}>

          {/* Document Info - Only show when there's actual document data */}
          {shouldShowDocumentInfo && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Document Information
              </h4>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>File:</span>
                  <span className="font-medium">{dashboardData.filename}</span>
                </div>
                <div className="flex justify-between">
                  <span>Processed:</span>
                  <span className="font-medium">{formatDate(dashboardData.processed_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Job ID:</span>
                  <span className="font-mono text-xs">{dashboardData.job_id.substring(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span>Document ID:</span>
                  <span className="font-mono text-xs">{dashboardData.doc_id.substring(0, 8)}...</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation & History - Only show when HistorySelector is not visible */}
          {shouldShowHistoryNav && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <History className="h-4 w-4" />
                Report Navigation
              </h4>

              {history.length > 0 ? (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full justify-between text-xs"
                  >
                    <span>Browse {history.length} previous reports</span>
                    {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>

                  {showHistory && (
                    <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-2 bg-gray-50">
                      {history.slice(0, 5).map((doc, index) => (
                        <button
                          key={`${doc.id}-${index}`}
                          onClick={() => {
                            onHistorySelect?.(doc.id)
                            setShowHistory(false)
                          }}
                          className="w-full text-left px-2 py-1 text-xs hover:bg-white rounded border border-transparent hover:border-gray-200 transition-colors"
                        >
                          <div className="font-medium truncate">{doc.title}</div>
                          <div className="text-gray-500">{formatDate(doc.created_at)}</div>
                        </button>
                      ))}
                      {history.length > 5 && (
                        <div className="text-center py-1 text-xs text-gray-500">
                          +{history.length - 5} more reports
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No previous reports available</p>
              )}
            </div>
          )}

          {/* System Status & About */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Server className="h-4 w-4" />
              System Status
            </h4>

            <div className="space-y-3">
              {getStatusIndicator()}

              {lastChecked && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span>Last checked: {lastChecked.toLocaleTimeString()}</span>
                </div>
              )}

              <div className="pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="font-semibold">Auto Analyst</div>
                  <div>AI-powered financial analysis platform</div>
                  {versionInfo && (
                    <>
                      <div className="flex justify-between">
                        <span>Version:</span>
                        <span className="font-medium">{versionInfo.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Released:</span>
                        <span className="font-medium">
                          {new Date(versionInfo.release_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-gray-500">
            © 2024 Auto Analyst. Intelligent financial insights powered by AI.
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-xs">
              <Activity className="h-3 w-3 mr-1" />
              Real-time Analytics
            </Badge>
            {dashboardData && (
              <Badge variant="outline" className="text-xs">
                {dashboardData.kpis.length} KPIs analyzed
              </Badge>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}