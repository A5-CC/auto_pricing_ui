// API Types

//FIXME: This is from auto analyst fork; remove the type and all references to it
export interface UploadResponse {
  job_id: string
}

//FIXME: This is from auto analyst fork; remove the type and all references to it
export interface JobStatus {
  job_id: string
  doc_id?: string
  filename?: string
  status: 'processing' | 'done' | 'error'
  summary_url?: string
  error?: string
  error_message?: string
}

//FIXME: This is from auto analyst fork; remove the type and all references to it
export interface DocMeta {
  id: string
  title: string
  created_at: string
  status?: 'processing' | 'done' | 'error'
  job_id?: string
}

export type AppMode = 'idle' | 'uploading' | 'processing' | 'done' | 'error' | 'timeout'

// Runs page types
export interface RunStatus {
  run_id: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  started_at?: string
  finished_at?: string
  rows_processed?: number
  duration_s?: number
  failed_urls?: string[]
}

export interface RunResponse {
  run_id: string
  queued: boolean
}

// URL Dumps explorer types
export interface URLDumpSummary {
  timestamp: string
  file_key: string
  total_urls: number
  created_at: string
  size_bytes: number
}

export interface URLDumpEntry {
  modstorage_location: string
  competitor_name: string
  competitor_address: string
  maps_url: string
  final_pricing_url: string
  confidence: number
  timestamp: string
}

export interface URLDumpDetail {
  timestamp: string
  file_key: string
  total_urls: number
  created_at: string
  urls: URLDumpEntry[]
  locations_summary: Record<string, number>
  competitors_summary: Record<string, number>
}