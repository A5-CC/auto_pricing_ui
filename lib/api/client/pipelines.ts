import { ColumnStatistics, CreatePipelineRequest, E1DataResponse, E1Snapshot, Pipeline, UpdatePipelineRequest } from '@/lib/api/types'
import { API_BASE_URL, fetchWithError } from './shared'

/**
 * E1 Competitors API (EXCLUDES modSTORAGE client data)
 *
 * These endpoints return only competitor pricing data for benchmarking.
 * modSTORAGE client data is automatically excluded by the backend.
 */

export async function getE1Snapshots(): Promise<E1Snapshot[]> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/e1-data/snapshots`)
  return response.json()
}

export async function getE1Competitors(
  snapshot: string,
  params?: {
    modstorage_location?: string
    competitor_name?: string
    unit_dimensions?: string
    limit?: number
    offset?: number
    min_fill_rate?: number
    include_sparse_columns?: boolean
  }
): Promise<E1DataResponse> {
  const queryParams = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value))
    })
  }
  const url = `${API_BASE_URL}/competitors/e1-data/${encodeURIComponent(snapshot)}/competitors${queryParams.toString() ? `?${queryParams}` : ""}`
  const response = await fetchWithError(url)
  return response.json()
}

export async function exportE1CompetitorsCSV(
  snapshot: string,
  params?: {
    modstorage_location?: string
    competitor_name?: string
    columns?: string[]
  }
): Promise<Blob> {
  const queryParams = new URLSearchParams()
  if (params) {
    if (params.modstorage_location) queryParams.append('modstorage_location', params.modstorage_location)
    if (params.competitor_name) queryParams.append('competitor_name', params.competitor_name)
    if (params.columns) queryParams.append('columns', params.columns.join(','))
  }
  const url = `${API_BASE_URL}/competitors/e1-data/${encodeURIComponent(snapshot)}/competitors/export/csv${queryParams.toString() ? `?${queryParams}` : ''}`
  const response = await fetchWithError(url)
  return response.blob()
}

export async function getE1CompetitorsStatistics(
  snapshot: string,
  columns?: string[]
): Promise<ColumnStatistics[]> {
  const queryParams = columns && columns.length ? `?columns=${columns.join(',')}` : ''
  const url = `${API_BASE_URL}/competitors/e1-data/${encodeURIComponent(snapshot)}/competitors/statistics${queryParams}`
  const response = await fetchWithError(url)
  return response.json()
}

/**
 * E1 Client API (modSTORAGE locations ONLY)
 *
 * These endpoints return only modSTORAGE client data for internal analytics.
 * Competitor data is automatically excluded by the backend.
 */

export async function getE1Client(
  snapshot: string,
  params?: {
    modstorage_location?: string
    unit_dimensions?: string
    limit?: number
    offset?: number
    min_fill_rate?: number
    include_sparse_columns?: boolean
  }
): Promise<E1DataResponse> {
  const queryParams = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value))
    })
  }
  const url = `${API_BASE_URL}/competitors/e1-data/${encodeURIComponent(snapshot)}/client${queryParams.toString() ? `?${queryParams}` : ""}`
  const response = await fetchWithError(url)
  return response.json()
}

export async function exportE1ClientCSV(
  snapshot: string,
  params?: {
    modstorage_location?: string
    columns?: string[]
  }
): Promise<Blob> {
  const queryParams = new URLSearchParams()
  if (params) {
    if (params.modstorage_location) queryParams.append('modstorage_location', params.modstorage_location)
    if (params.columns) queryParams.append('columns', params.columns.join(','))
  }
  const url = `${API_BASE_URL}/competitors/e1-data/${encodeURIComponent(snapshot)}/client/export/csv${queryParams.toString() ? `?${queryParams}` : ''}`
  const response = await fetchWithError(url)
  return response.blob()
}

export async function getE1ClientStatistics(
  snapshot: string,
  columns?: string[]
): Promise<ColumnStatistics[]> {
  const queryParams = columns && columns.length ? `?columns=${columns.join(',')}` : ''
  const url = `${API_BASE_URL}/competitors/e1-data/${encodeURIComponent(snapshot)}/client/statistics${queryParams}`
  const response = await fetchWithError(url)
  return response.json()
}

/**
 * Pipeline Management API
 *
 * CRUD operations for saved pipeline configurations (filters + adjusters).
 */

export async function listPipelines(): Promise<Pipeline[]> {
  const response = await fetchWithError(`${API_BASE_URL}/pipelines`)
  return response.json()
}

export async function getPipeline(pipelineId: string): Promise<Pipeline> {
  const response = await fetchWithError(`${API_BASE_URL}/pipelines/${encodeURIComponent(pipelineId)}`)
  return response.json()
}

export async function createPipeline(request: CreatePipelineRequest): Promise<Pipeline> {
  const response = await fetchWithError(`${API_BASE_URL}/pipelines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })
  return response.json()
}

export async function updatePipeline(pipelineId: string, request: UpdatePipelineRequest): Promise<Pipeline> {
  const response = await fetchWithError(`${API_BASE_URL}/pipelines/${encodeURIComponent(pipelineId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })
  return response.json()
}

export async function deletePipeline(pipelineId: string): Promise<void> {
  await fetchWithError(`${API_BASE_URL}/pipelines/${encodeURIComponent(pipelineId)}`, {
    method: 'DELETE'
  })
}

/**
 * Save chatbot filter recommendation
 * Stores the conversation and configuration suggested by the chatbot assistant
 */
export async function saveChatbotFilterRecommendation(data: {
  conversation: Array<{ role: string; content: string; timestamp: string }>;
  filters: Record<string, string[]>;
  adjusters: Array<{ type: string; name: string; config: unknown }>;
  timestamp: string;
}): Promise<{ success: boolean; id: string }> {
  const response = await fetchWithError(`${API_BASE_URL}/chatbot/filter-recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return response.json()
}

/**
 * Chatbot Chat API
 * Send messages to the pipeline chatbot assistant and receive LLM-generated responses
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ChatContext {
  filters: Record<string, string[]>;
  adjusters: Array<{ type: string; [key: string]: unknown }>;
  availableColumns: string[];
}

export interface ChatResponse {
  message: string;
  suggestions: string[];
  timestamp: string;
}

export async function sendChatMessage(
  message: string,
  conversationHistory: ChatMessage[],
  context: ChatContext
): Promise<ChatResponse> {
  const response = await fetchWithError(`${API_BASE_URL}/chatbot/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp
      })),
      context
    })
  })
  return response.json()
}

// =============================================================================
// Agentic Pipeline Builder API
// =============================================================================

/**
 * Conversation phases for the pipeline builder
 */
export type ConversationPhase = 
  | 'welcome'
  | 'scope_dimensions'
  | 'scope_values'
  | 'adjuster_type'
  | 'adjuster_config'
  | 'review'
  | 'complete';

/**
 * Dimension configuration in a pipeline (internal tracking)
 */
export interface DimensionConfig {
  name: string;
  mode: 'subset' | 'combinatorial';
  values: string[];
  enabled: boolean;
}

/**
 * Pipeline Filters - matches backend PipelineFilters
 */
export interface PipelineFiltersConfig {
  competitors: string[];
  locations: string[];
  dimensions: string[];
  unit_categories: string[];
}

/**
 * Adjuster configuration in a pipeline - matches backend AdjusterConfig
 */
export interface AdjusterConfig {
  type: 'competitive' | 'function' | 'temporal';
  // Competitive adjuster fields
  price_columns?: string[];
  aggregation?: 'min' | 'max' | 'avg';
  multiplier?: number;
  // Function adjuster fields
  variable?: string;
  function_string?: string;
  domain_min?: number;
  domain_max?: number;
  // Temporal adjuster fields
  granularity?: 'weekly' | 'monthly';
  multipliers?: number[];
}

/**
 * Complete pipeline state from the agent
 */
export interface PipelineState {
  id: string;
  name: string;
  version: number;
  created_at: string;
  updated_at: string;
  filters: PipelineFiltersConfig;
  dimensions: DimensionConfig[];
  adjusters: AdjusterConfig[];
  is_valid: boolean;
  validation_errors: string[];
}

/**
 * Action to be executed on the frontend
 */
export interface PipelineAction {
  type: 'set_filter' | 'add_adjuster' | 'update_adjuster' | 'remove_adjuster' | 
        'save_pipeline' | 'reset_pipeline' | 'show_preview' | 'navigate';
  payload: Record<string, unknown>;
}

/**
 * Response from the agent chat endpoint
 */
export interface AgentChatResponse {
  session_id: string;
  message: string;
  phase: ConversationPhase;
  suggestions: string[];
  actions: PipelineAction[];
  pipeline_state: PipelineState;
  timestamp: string;
}

/**
 * Send a message to the agentic pipeline builder
 */
export async function sendAgentMessage(
  message: string,
  sessionId?: string,
  context?: {
    availableColumns?: string[];
    currentFilters?: Record<string, string[]>;
    currentAdjusters?: Array<{ type: string; [key: string]: unknown }>;
  }
): Promise<AgentChatResponse> {
  const response = await fetchWithError(`${API_BASE_URL}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      message,
      context: context || {}
    })
  })
  return response.json()
}

/**
 * Save a pipeline configuration from a session
 */
export async function saveAgentPipeline(
  sessionId: string,
  name: string
): Promise<{ success: boolean; pipeline_id: string; message: string }> {
  const response = await fetchWithError(`${API_BASE_URL}/agent/save-pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      name
    })
  })
  return response.json()
}

/**
 * Get current session state
 */
export async function getAgentSession(sessionId: string): Promise<{
  session_id: string;
  phase: ConversationPhase;
  pipeline: PipelineState;
  message_count: number;
}> {
  const response = await fetchWithError(`${API_BASE_URL}/agent/session/${encodeURIComponent(sessionId)}`)
  return response.json()
}

/**
 * Update pipeline state from frontend actions
 */
export async function updateAgentPipeline(
  sessionId: string,
  updates: {
    filters?: Partial<PipelineFiltersConfig>;
    adjusters?: Array<{
      action: 'add' | 'remove' | 'update';
      index?: number;
      type?: 'competitive' | 'function' | 'temporal';
      price_columns?: string[];
      aggregation?: 'min' | 'max' | 'avg';
      multiplier?: number;
      variable?: string;
      function_string?: string;
      domain_min?: number;
      domain_max?: number;
      granularity?: 'weekly' | 'monthly';
      multipliers?: number[];
    }>;
    name?: string;
  }
): Promise<AgentChatResponse> {
  const url = new URL(`${API_BASE_URL}/agent/update-pipeline`)
  url.searchParams.append('session_id', sessionId)
  
  const response = await fetchWithError(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
  return response.json()
}

/**
 * List all saved pipelines from the agent
 */
export async function listAgentPipelines(): Promise<Pipeline[]> {
  const response = await fetchWithError(`${API_BASE_URL}/agent/pipelines`)
  return response.json()
}

/**
 * Get a specific pipeline by ID from the agent
 */
export async function getAgentPipeline(pipelineId: string): Promise<Pipeline> {
  const response = await fetchWithError(`${API_BASE_URL}/agent/pipelines/${encodeURIComponent(pipelineId)}`)
  return response.json()
}

/**
 * Load an existing pipeline into a session for editing
 */
export async function loadPipelineIntoSession(
  pipelineId: string,
  sessionId?: string
): Promise<AgentChatResponse> {
  const url = new URL(`${API_BASE_URL}/agent/load-pipeline`)
  url.searchParams.append('pipeline_id', pipelineId)
  if (sessionId) {
    url.searchParams.append('session_id', sessionId)
  }
  
  const response = await fetchWithError(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  return response.json()
}

/**
 * E1 Data Summary for interactive chatbot
 */
export interface E1DataSummary {
  total_rows: number
  client_rows: number
  competitor_rows: number
  competitors: string[]
  locations: string[]
  dimensions: string[]
  unit_categories: string[]
  price_columns: string[]
  numeric_columns: string[]
  column_stats: Record<string, { min: number; max: number; mean: number; count: number }>
}

/**
 * Get E1 data summary for chatbot context
 * Returns unique values for filters and available columns
 */
export async function getE1DataSummary(): Promise<E1DataSummary> {
  const response = await fetchWithError(`${API_BASE_URL}/agent/e1-data-summary`)
  return response.json()
}
