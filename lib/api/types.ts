// API Types
export interface UploadResponse {
  job_id: string
}

export interface JobStatus {
  job_id: string
  doc_id?: string
  filename?: string
  status: 'processing' | 'done' | 'error'
  summary_url?: string
  error?: string
  error_message?: string
}

export interface DocMeta {
  id: string
  title: string
  created_at: string
  status?: 'processing' | 'done' | 'error'
  job_id?: string
}

export type AppMode = 'idle' | 'uploading' | 'processing' | 'done' | 'error' | 'timeout'