import type { Adjuster } from '@/lib/adjusters'
import {
  ColumnStatistics,
  FacilityPricingData,
  PricingDataResponse,
  PricingSchemas,
  PricingSnapshot,
  SchemaStats
} from '@/lib/api/types'
import { cachedFetch } from '../cache'
import { API_BASE_URL, fetchWithError } from './shared'

export interface ProcessCsvConfigurationPayload {
  name: string
  snapshot_id: string
  standard_rate_formula: string
  standard_rate_rounding: {
    enabled: boolean
    offset: number
  }
  competitive_adjusters: Adjuster[]
  levels_adjuster: {
    apply_to_web: boolean
    premium?: { multiplier: number; offset: number }
    standard?: { multiplier: number; offset: number }
    economy?: { multiplier: number; offset: number }
  }
  mapping_rules?: Array<{
    id: string
    pipelineName: string
    column: string
    operator: "contains" | "equals" | "not_contains" | "empty" | "not_empty"
    value: string
  }>
  pipeline_mappings?: Array<{
    pipelineName: string
    csvLocationColumn: string
    csvDimensionColumn: string
    csvAreaColumn: string
    csvAmenitiesColumn: string
    dimensionMode: "full" | "first_two"
    fallbackPipelineName: string
    locationMappings: Array<{
      id: string
      csvValue: string
      pipelineValue: string
    }>
  }>
  mapping_groups?: Array<{
    id: string
    name: string
    pipelineName: string
    fallbackGroupId: string
    dimensionMode: "full" | "first_two"
    columnMappings: Array<{
      id: string
      csvColumn: string
      competitorColumn: string
      pairs: Array<{
        id: string
        csvValue: string
        pipelineValue: string
        exactMatch: boolean
        csvFirstTwoDimensions: boolean
        csvContains?: boolean
        pipelineContains?: boolean
      }>
    }>
  }>
  mapping?: {
    mapping_rules?: ProcessCsvConfigurationPayload["mapping_rules"]
    pipeline_mappings?: ProcessCsvConfigurationPayload["pipeline_mappings"]
    mapping_groups?: ProcessCsvConfigurationPayload["mapping_groups"]
  }
}

export interface ProcessCsvConfiguration extends ProcessCsvConfigurationPayload {
  id?: string
  created_at?: string
  updated_at?: string
}

type ProcessCsvConfigurationResponseItem = Partial<ProcessCsvConfiguration> & {
  payload?: Partial<ProcessCsvConfigurationPayload> | string
}

type ProcessCsvMappingShadow = {
  mapping_rules: NonNullable<ProcessCsvConfigurationPayload["mapping_rules"]>
  pipeline_mappings: NonNullable<ProcessCsvConfigurationPayload["pipeline_mappings"]>
  mapping_groups: NonNullable<ProcessCsvConfigurationPayload["mapping_groups"]>
  updated_at: string
}

type MappingEnvelopeLike = {
  mapping_rules?: unknown
  mappingRules?: unknown
  pipeline_mappings?: unknown
  pipelineMappings?: unknown
  mapping_groups?: unknown
  mappingGroups?: unknown
}

const PROCESS_CSV_MAPPING_SHADOW_KEY = "__apu_process_csv_mapping_shadow_v1"

function getMappingSnapshot(payload: Partial<ProcessCsvConfigurationPayload>): ProcessCsvMappingShadow {
  const payloadRecord = payload as Record<string, unknown>
  const nested = (payload.mapping ?? payloadRecord.mappings ?? {}) as NonNullable<ProcessCsvConfigurationPayload["mapping"]> & MappingEnvelopeLike
  const mapping_rules = (
    payload.mapping_rules
    ?? payloadRecord.mappingRules
    ?? nested.mapping_rules
    ?? nested.mappingRules
    ?? []
  ) as NonNullable<ProcessCsvConfigurationPayload["mapping_rules"]>
  const pipeline_mappings = (
    payload.pipeline_mappings
    ?? payloadRecord.pipelineMappings
    ?? nested.pipeline_mappings
    ?? nested.pipelineMappings
    ?? []
  ) as NonNullable<ProcessCsvConfigurationPayload["pipeline_mappings"]>
  const mapping_groups = (
    payload.mapping_groups
    ?? payloadRecord.mappingGroups
    ?? nested.mapping_groups
    ?? nested.mappingGroups
    ?? []
  ) as NonNullable<ProcessCsvConfigurationPayload["mapping_groups"]>

  return {
    mapping_rules: Array.isArray(mapping_rules) ? mapping_rules : [],
    pipeline_mappings: Array.isArray(pipeline_mappings) ? pipeline_mappings : [],
    mapping_groups: Array.isArray(mapping_groups) ? mapping_groups : [],
    updated_at: new Date().toISOString(),
  }
}

function hasAnyMapping(snapshot: ProcessCsvMappingShadow): boolean {
  return snapshot.mapping_rules.length > 0 || snapshot.pipeline_mappings.length > 0 || snapshot.mapping_groups.length > 0
}

function readMappingShadowStore(): Record<string, ProcessCsvMappingShadow> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(PROCESS_CSV_MAPPING_SHADOW_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return {}
    return parsed as Record<string, ProcessCsvMappingShadow>
  } catch {
    return {}
  }
}

function writeMappingShadowStore(store: Record<string, ProcessCsvMappingShadow>): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PROCESS_CSV_MAPPING_SHADOW_KEY, JSON.stringify(store))
  } catch {
    // ignore
  }
}

function buildMappingShadowNameKey(snapshotId: string, name: string): string {
  return `name:${snapshotId}:${name}`
}

function buildMappingShadowIdKey(id: string): string {
  return `id:${id}`
}

function persistMappingShadow(
  mapping: ProcessCsvMappingShadow,
  options: {
    snapshotId?: string
    name?: string
    id?: string
  }
): void {
  if (!hasAnyMapping(mapping)) return
  const store = readMappingShadowStore()
  const snapshotId = String(options.snapshotId ?? "").trim()
  const name = String(options.name ?? "").trim()
  const id = String(options.id ?? "").trim()

  if (snapshotId && name) {
    store[buildMappingShadowNameKey(snapshotId, name)] = mapping
  }
  if (id) {
    store[buildMappingShadowIdKey(id)] = mapping
  }

  writeMappingShadowStore(store)
}

function readPersistedMappingShadow(options: {
  snapshotId?: string
  name?: string
  id?: string
}): ProcessCsvMappingShadow | null {
  const store = readMappingShadowStore()
  const id = String(options.id ?? "").trim()
  if (id) {
    const byId = store[buildMappingShadowIdKey(id)]
    if (byId) return byId
  }

  const snapshotId = String(options.snapshotId ?? "").trim()
  const name = String(options.name ?? "").trim()
  if (snapshotId && name) {
    const byName = store[buildMappingShadowNameKey(snapshotId, name)]
    if (byName) return byName
  }

  return null
}

export async function getPricingSchemas(): Promise<PricingSchemas> {
  return cachedFetch(
    'pricing-schemas',
    async () => {
      const response = await fetchWithError(`${API_BASE_URL}/competitors/pricing-schemas`)
      return (await response.json()) as PricingSchemas
    },
    { persist: true }
  )
}

export async function getSchemaStats(): Promise<SchemaStats> {
  return cachedFetch(
    'schema-stats',
    async () => {
      const response = await fetchWithError(`${API_BASE_URL}/competitors/pricing-schemas/columns/stats`)
      return (await response.json()) as SchemaStats
    },
    { persist: true }
  )
}

export async function getPricingSnapshots(): Promise<PricingSnapshot[]> {
  return cachedFetch(
    'pricing-snapshots',
    async () => {
      const response = await fetchWithError(`${API_BASE_URL}/competitors/pricing-data/snapshots`)
      return (await response.json()) as PricingSnapshot[]
    },
    { persist: true }
  )
}

export async function getPricingData(
  snapshot: string,
  params?: {
    client_location?: string
    competitor_name?: string
    unit_dimensions?: string
    limit?: number
    offset?: number
    min_fill_rate?: number
    include_sparse_columns?: boolean
  }
): Promise<PricingDataResponse> {
  const queryParams = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value))
    })
  }
  const queryString = queryParams.toString()
  const cacheKey = `pricing-data-${snapshot}-${queryString}`
  
  return cachedFetch(
    cacheKey,
    async () => {
      const url = `${API_BASE_URL}/competitors/pricing-data/${encodeURIComponent(snapshot)}${queryString ? `?${queryString}` : ""}`
      const response = await fetchWithError(url)
      return (await response.json()) as PricingDataResponse
    },
    { persist: true }
  )
}

export async function getFacilityPricing(
  snapshot: string,
  location: string,
  competitor?: string
): Promise<FacilityPricingData> {
  const queryParams = competitor ? `?competitor_name=${encodeURIComponent(competitor)}` : ''
  const url = `${API_BASE_URL}/competitors/pricing-data/${encodeURIComponent(snapshot)}/facility/${encodeURIComponent(location)}${queryParams}`
  const response = await fetchWithError(url)
  return (await response.json()) as FacilityPricingData
}

export async function exportPricingCSV(
  snapshot: string,
  params?: {
    client_location?: string
    competitor_name?: string
    columns?: string[]
  }
): Promise<Blob> {
  const queryParams = new URLSearchParams()
  if (params) {
    if (params.client_location) queryParams.append('client_location', params.client_location)
    if (params.competitor_name) queryParams.append('competitor_name', params.competitor_name)
    if (params.columns) queryParams.append('columns', params.columns.join(','))
  }
  const url = `${API_BASE_URL}/competitors/pricing-data/${encodeURIComponent(snapshot)}/export/csv${queryParams.toString() ? `?${queryParams}` : ''}`
  const response = await fetchWithError(url)
  return response.blob()
}

export async function getColumnStatistics(
  snapshot: string,
  columns?: string[]
): Promise<ColumnStatistics[]> {
  const queryParams = columns && columns.length ? `?columns=${columns.join(',')}` : ''
  const cacheKey = `column-stats-${snapshot}-${columns && columns.length ? columns.sort().join(',') : 'all'}`
  
  return cachedFetch(
    cacheKey,
    async () => {
      const url = `${API_BASE_URL}/competitors/pricing-data/${encodeURIComponent(snapshot)}/statistics${queryParams}`
      const response = await fetchWithError(url)
      return (await response.json()) as ColumnStatistics[]
    },
    { persist: true }
  )
}

export async function processClientCSV(
  file: File,
  snapshotId: string,
  filters: Record<string, string[]>,
  adjusters?: Adjuster[],
  combinatoric?: Record<string, boolean>,
  rounding?: { enabled: boolean; offset: number }
): Promise<Blob> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("snapshot_id", snapshotId)
  formData.append("filters", JSON.stringify(filters))
  if (adjusters) {
    formData.append("adjusters", JSON.stringify(adjusters))
  }
  if (combinatoric) {
    formData.append("combinatoric", JSON.stringify(combinatoric))
  }
  if (rounding) {
    formData.append("rounding", JSON.stringify(rounding))
  }

  const response = await fetch(`${API_BASE_URL}/client-data/process-csv`, {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    let errorMessage = "Failed to process CSV"
    try {
      const errorData = await response.json()
      errorMessage = errorData.detail || errorMessage
    } catch {
      errorMessage = await response.text() || errorMessage
    }
    throw new Error(errorMessage)
  }

  return response.blob()
}

export async function saveProcessCsvConfiguration(
  payload: ProcessCsvConfigurationPayload
): Promise<{ success: boolean; id?: string; name?: string }> {
  const mappingRules = Array.isArray(payload.mapping_rules) ? payload.mapping_rules : []
  const pipelineMappings = Array.isArray(payload.pipeline_mappings) ? payload.pipeline_mappings : []
  const mappingGroups = Array.isArray(payload.mapping_groups) ? payload.mapping_groups : []

  const normalizedMapping = {
    mapping_rules: mappingRules,
    mappingRules,
    pipeline_mappings: pipelineMappings,
    pipelineMappings,
    mapping_groups: mappingGroups,
    mappingGroups,
  }

  const payloadWithMappings = {
    ...payload,
    mapping_rules: mappingRules,
    mappingRules,
    pipeline_mappings: pipelineMappings,
    pipelineMappings,
    mapping_groups: mappingGroups,
    mappingGroups,
    mapping: normalizedMapping,
    mappings: normalizedMapping,
  }

  const wrappedPayload = {
    ...payloadWithMappings,
    payload: payloadWithMappings,
  }

  const payloadOnlyEnvelope = {
    name: payload.name,
    snapshot_id: payload.snapshot_id,
    payload: payloadWithMappings,
  }

  const mappingSnapshot = getMappingSnapshot(wrappedPayload.payload as Partial<ProcessCsvConfigurationPayload>)
  persistMappingShadow(mappingSnapshot, {
    snapshotId: payload.snapshot_id,
    name: payload.name,
  })

  const attempts: Array<Record<string, unknown>> = [
    // Preferred: force backend to store the exact payload object under `payload`
    payloadOnlyEnvelope,
    // Compatibility: support backends that read top-level fields
    wrappedPayload,
    // Last fallback: still include explicit mapping envelope at top-level
    payloadWithMappings,
  ]

  let lastError: unknown = null
  for (const body of attempts) {
    try {
      const response = await fetchWithError(`${API_BASE_URL}/client-data/process-csv-configurations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = await response.json() as { success: boolean; id?: string; name?: string }
      persistMappingShadow(mappingSnapshot, {
        snapshotId: payload.snapshot_id,
        name: result?.name ?? payload.name,
        id: result?.id,
      })
      return result
    } catch (error) {
      lastError = error
    }
  }

  throw (lastError instanceof Error
    ? lastError
    : new Error("Failed to save Process CSV configuration"))
}

export async function listProcessCsvConfigurations(
  snapshotId?: string
): Promise<{ configurations: ProcessCsvConfiguration[] }> {
  const query = snapshotId ? `?snapshot_id=${encodeURIComponent(snapshotId)}` : ""
  const response = await fetchWithError(`${API_BASE_URL}/client-data/process-csv-configurations${query}`)
  const raw = await response.json() as unknown

  const normalize = (item: ProcessCsvConfigurationResponseItem): ProcessCsvConfiguration => {
    const rawPayload = item?.payload
    const payload: Partial<ProcessCsvConfigurationPayload> = (() => {
      if (rawPayload && typeof rawPayload === "object") {
        return rawPayload as Partial<ProcessCsvConfigurationPayload>
      }
      if (typeof rawPayload === "string") {
        try {
          const parsed = JSON.parse(rawPayload) as unknown
          return parsed && typeof parsed === "object"
            ? (parsed as Partial<ProcessCsvConfigurationPayload>)
            : {}
        } catch {
          return {}
        }
      }
      return {}
    })()

    const topLevel = item as Partial<ProcessCsvConfiguration> & Record<string, unknown>
    const payloadRecord = payload as Record<string, unknown>
    const payloadMapping = (
      payload.mapping
      ?? payloadRecord.mappings
      ?? {}
    ) as NonNullable<ProcessCsvConfigurationPayload["mapping"]> & MappingEnvelopeLike
    const topLevelMapping = (
      (topLevel as ProcessCsvConfigurationPayload).mapping
      ?? topLevel.mappings
      ?? {}
    ) as NonNullable<ProcessCsvConfigurationPayload["mapping"]> & MappingEnvelopeLike
    const mappingRules = (payload.mapping_rules
      ?? payloadRecord.mappingRules
      ?? payloadMapping.mapping_rules
      ?? payloadMapping.mappingRules
      ?? topLevel.mapping_rules
      ?? topLevel.mappingRules
      ?? topLevelMapping.mapping_rules
      ?? topLevelMapping.mappingRules
      ?? []) as ProcessCsvConfigurationPayload["mapping_rules"]
    const pipelineMappings = (payload.pipeline_mappings
      ?? payloadRecord.pipelineMappings
      ?? payloadMapping.pipeline_mappings
      ?? payloadMapping.pipelineMappings
      ?? topLevel.pipeline_mappings
      ?? topLevel.pipelineMappings
      ?? topLevelMapping.pipeline_mappings
      ?? topLevelMapping.pipelineMappings
      ?? []) as ProcessCsvConfigurationPayload["pipeline_mappings"]
    const mappingGroups = (payload.mapping_groups
      ?? payloadRecord.mappingGroups
      ?? payloadMapping.mapping_groups
      ?? payloadMapping.mappingGroups
      ?? topLevel.mapping_groups
      ?? topLevel.mappingGroups
      ?? topLevelMapping.mapping_groups
      ?? topLevelMapping.mappingGroups
      ?? []) as ProcessCsvConfigurationPayload["mapping_groups"]

    const normalizedMappingRules = Array.isArray(mappingRules) ? mappingRules : []
    const normalizedPipelineMappings = Array.isArray(pipelineMappings) ? pipelineMappings : []
    const normalizedMappingGroups = Array.isArray(mappingGroups) ? mappingGroups : []

    const mappingFallback = readPersistedMappingShadow({
      id: String(item?.id ?? ""),
      snapshotId: String((payload as ProcessCsvConfigurationPayload).snapshot_id ?? item?.snapshot_id ?? ""),
      name: String((payload as ProcessCsvConfigurationPayload).name ?? item?.name ?? ""),
    })

    const effectiveMappingRules = normalizedMappingRules.length > 0
      ? normalizedMappingRules
      : (mappingFallback?.mapping_rules ?? [])
    const effectivePipelineMappings = normalizedPipelineMappings.length > 0
      ? normalizedPipelineMappings
      : (mappingFallback?.pipeline_mappings ?? [])
    const effectiveMappingGroups = normalizedMappingGroups.length > 0
      ? normalizedMappingGroups
      : (mappingFallback?.mapping_groups ?? [])

    return {
      ...(payload as ProcessCsvConfigurationPayload),
      ...(item as Partial<ProcessCsvConfiguration>),
      id: item?.id,
      created_at: item?.created_at,
      updated_at: item?.updated_at,
      name: String((payload as ProcessCsvConfigurationPayload).name ?? item?.name ?? ""),
      snapshot_id: String((payload as ProcessCsvConfigurationPayload).snapshot_id ?? item?.snapshot_id ?? ""),
      standard_rate_formula: String((payload as ProcessCsvConfigurationPayload).standard_rate_formula ?? item?.standard_rate_formula ?? ""),
      standard_rate_rounding: ((payload as ProcessCsvConfigurationPayload).standard_rate_rounding ?? item?.standard_rate_rounding ?? { enabled: false, offset: 0 }) as ProcessCsvConfigurationPayload["standard_rate_rounding"],
      competitive_adjusters: (((payload as ProcessCsvConfigurationPayload).competitive_adjusters ?? item?.competitive_adjusters ?? []) as Adjuster[]),
      levels_adjuster: (((payload as ProcessCsvConfigurationPayload).levels_adjuster ?? item?.levels_adjuster ?? { apply_to_web: true }) as ProcessCsvConfigurationPayload["levels_adjuster"]),
      mapping_rules: effectiveMappingRules,
      pipeline_mappings: effectivePipelineMappings,
      mapping_groups: effectiveMappingGroups,
      mapping: {
        mapping_rules: effectiveMappingRules,
        pipeline_mappings: effectivePipelineMappings,
        mapping_groups: effectiveMappingGroups,
      },
    }
  }

  if (Array.isArray(raw)) {
    return {
      configurations: raw.map((item) => normalize(item as ProcessCsvConfigurationResponseItem))
    }
  }

  const container = raw as { configurations?: ProcessCsvConfigurationResponseItem[] }
  if (Array.isArray(container?.configurations)) {
    return {
      configurations: container.configurations.map((item) => normalize(item))
    }
  }

  return { configurations: [] }
}

export async function deleteProcessCsvConfiguration(
  configId: string
): Promise<{ success: boolean; id?: string }> {
  const response = await fetchWithError(
    `${API_BASE_URL}/client-data/process-csv-configurations/${encodeURIComponent(configId)}`,
    { method: "DELETE" }
  )
  return response.json()
}
