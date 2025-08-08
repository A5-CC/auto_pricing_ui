"use client"

import { useState, useEffect } from "react"
import AnalyticsDashboard from "@/components/analytics-dashboard"
import { DashboardData } from "@/components/analytics/types"
import { AppMode, DocMeta } from "@/lib/api/types"
import { uploadFiles, checkJobStatus, getDocumentList, getSummaryById } from "@/lib/api/client"

// Constants for timeout handling
const POLL_INTERVAL_MS = 2000
const MAX_POLL_TIME_MINUTES = 2
const MAX_POLL_ATTEMPTS = (MAX_POLL_TIME_MINUTES * 60 * 1000) / POLL_INTERVAL_MS

export default function Page() {
  const [mode, setMode] = useState<AppMode>('idle')
  const [jobId, setJobId] = useState<string | null>(null)
  const [summary, setSummary] = useState<DashboardData | null>(null)
  const [history, setHistory] = useState<DocMeta[]>([])
  const [currentFileName, setCurrentFileName] = useState<string>('')

  // Load history on mount
  useEffect(() => {
    loadHistory()
  }, [])

  // Polling effect for job status
  useEffect(() => {
    if (mode !== 'processing' || !jobId) return

    console.log(`Starting analysis polling for ${currentFileName}`)
    let currentAttempt = 0

    const poll = async () => {
      currentAttempt++

      // Check for timeout first
      if (currentAttempt >= MAX_POLL_ATTEMPTS) {
        console.log(`Polling timeout reached after ${currentAttempt} attempts (${MAX_POLL_TIME_MINUTES} minutes)`)
        setMode('timeout')
        return
      }

      try {
        console.log(`Polling attempt ${currentAttempt}/${MAX_POLL_ATTEMPTS}`)
        const status = await checkJobStatus(jobId)
        console.log(`Status received:`, status)

        if (status.status === 'done' && status.doc_id) {
          console.log(`Analysis complete, fetching summary for doc_id: ${status.doc_id}`)
          const summaryData = await getSummaryById(status.doc_id)
          setSummary(summaryData)
          setMode('done')
          loadHistory()
        } else if (status.status === 'error') {
          const errorMessage = status.error_message || status.error || 'Unknown processing error'
          // Log as a non-blocking warning
          console.warn(`Processing failed (backend):`, errorMessage)
          setMode('error')
        }
      } catch (err) {
        console.error(`Polling error on attempt ${currentAttempt}:`, err)
        // Don't set error state here, let the timeout handle it if it persists
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS)
    poll() // Initial poll

    return () => {
      clearInterval(interval)
    }
  }, [mode, jobId, currentFileName])

  const loadHistory = async () => {
    try {
      const docs = await getDocumentList()
      setHistory(docs)
    } catch (err) {
      console.warn('Backend not available - history loading disabled:', err)
      // Don't set error state, just silently fail for now
      // This allows development without backend
    }
  }

  const handleUpload = async (files: File[]) => {
    setMode('uploading')
    const combinedName = files.map(f => f.name).join(' + ')
    setCurrentFileName(combinedName)

    try {
      const response = await uploadFiles(files)
      setJobId(response.job_id)
      setMode('processing')
    } catch (err) {
      console.error('Upload failed:', err)
      setMode('error')
    }
  }

  const handleHistorySelect = async (docId: string) => {
    setMode('uploading') // Show loading state

    try {
      const summaryData = await getSummaryById(docId)
      setSummary(summaryData)
      setMode('done')
    } catch (err) {
      console.error('Failed to load summary:', err)
      setMode('error')
    }
  }

  const handleCancel = () => {
    setMode('idle')
    setJobId(null)
    setCurrentFileName('')
  }

  const handleReset = () => {
    setMode('idle')
    setJobId(null)
    setSummary(null)
    setCurrentFileName('')
  }

  return (
    <AnalyticsDashboard
      mode={mode}
      summary={summary}
      history={history}
      currentFileName={currentFileName}
      onUpload={handleUpload}
      onHistorySelect={handleHistorySelect}
      onCancel={handleCancel}
      onReset={handleReset}
    />
  )
}
