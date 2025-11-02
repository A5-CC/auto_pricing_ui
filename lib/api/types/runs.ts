/**
 * Run status types for pipeline orchestration
 * Used by runs page and pipeline status tracking
 */

export interface RunStatus {
  run_id: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  started_at?: string
  finished_at?: string
  rows_processed?: number
  duration_s?: number
  failed_count?: number
}

export interface RunResponse {
  run_id: string
  queued: boolean
}
