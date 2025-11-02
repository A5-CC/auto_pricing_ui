/**
 * Shared types used across multiple domains
 */

export type AppMode = 'idle' | 'uploading' | 'processing' | 'done' | 'error' | 'timeout'

/**
 * DEPRECATED TYPES - Legacy Auto Analyst
 * These types are from the original Auto Analyst fork and should be removed
 * once legacy pages/components are cleaned up
 *
 * @deprecated Use new pricing/pipelines types instead
 */

/** @deprecated Legacy Auto Analyst type - to be removed */
export interface UploadResponse {
  job_id: string
}

/** @deprecated Legacy Auto Analyst type - to be removed */
export interface JobStatus {
  job_id: string
  doc_id?: string
  filename?: string
  status: 'processing' | 'done' | 'error'
  summary_url?: string
  error?: string
  error_message?: string
}

/** @deprecated Legacy Auto Analyst type - to be removed */
export interface DocMeta {
  id: string
  title: string
  created_at: string
  status?: 'processing' | 'done' | 'error'
  job_id?: string
}
