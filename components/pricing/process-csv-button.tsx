"use client"

// ParsedCsv type for CSV parsing utilities
type ParsedCsv = {
  headers: string[];
  rows: string[][];
}

type AmenityAdjusterEntry = {
  multiplier: string
  offset: string
}

type AmenityAdjusterState = {
  applyToWeb: boolean
  premium: AmenityAdjusterEntry
  standard: AmenityAdjusterEntry
  economy: AmenityAdjusterEntry
}

type ResolvedAmenityAdjusterEntry = {
  multiplier: number
  offset: number
}

type ResolvedAmenityAdjuster = {
  applyToWeb: boolean
  premium?: ResolvedAmenityAdjusterEntry
  standard?: ResolvedAmenityAdjusterEntry
  economy?: ResolvedAmenityAdjusterEntry
}

import { AddFunctionAdjusterDialog } from "@/components/pipelines/adjusters/add-function-adjuster-dialog";
import { AdjusterCardShell } from "@/components/pipelines/adjusters/adjuster-card-shell";
import { CompetitiveAdjusterCard } from "@/components/pipelines/adjusters/competitive-adjuster-card";
import { FunctionAdjusterCard } from "@/components/pipelines/adjusters/function-adjuster-card";
import { TemporalAdjusterCard } from "@/components/pipelines/adjusters/temporal-adjuster-card";
import { useAdjusterDialog } from "@/components/pipelines/adjusters/use-adjuster-dialog";
import type { CalculatedPriceRow } from "@/components/pipelines/calculated-price";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Adjuster, CompetitivePriceAdjuster, FunctionBasedAdjuster, TemporalAdjuster } from '@/lib/adjusters';
import { evaluateSafeFunction } from "@/lib/adjusters";
import { deleteProcessCsvConfiguration, listProcessCsvConfigurations, saveProcessCsvConfiguration, type ProcessCsvConfiguration } from "@/lib/api/client/pricing";
import type { E1DataRow } from "@/lib/api/types";
import { ArrowDown, ArrowUp, ArrowUpDown, FileSpreadsheet, Info, Layers3, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

interface ProcessCsvButtonProps {
  snapshotId: string
  // Legacy + Universal filters
  filters: {
    competitors: string[]
    locations: string[]
    unit_dimensions: string[]
    unitCategories: string[]
    // Catch-all for other universal filters (e.g. facility_location_city)
    [key: string]: string[] 
  }
  adjusters?: Adjuster[]
  combinatoric?: Record<string, boolean>
  rounding?: {
    enabled: boolean
    offset: number
    standard?: {
      enabled: boolean
      offset: number
    }
  }
  calculatedRows?: CalculatedPriceRow[]
  calculatedRowsBundle?: Array<{
    pipelineName: string
    rows: CalculatedPriceRow[]
  }>
  pricingContext?: {
    competitorData: E1DataRow[]
    clientAvailableUnits: number
    currentDate: Date
    filters: Record<string, { mode: 'subset'; values: string[] }>
    combinatoricFlags: Record<string, boolean>
    availableVariables: string[]
  }
  /** When true, renders as an inline panel instead of a dialog button */
  inline?: boolean
}

type ResolvedCalculatedRows = {
  rows: CalculatedPriceRow[]
  error: string | null
}

type MappingOperator = "contains" | "equals" | "not_contains" | "empty" | "not_empty"

type PipelineMappingRule = {
  id: string
  pipelineName: string
  column: string
  operator: MappingOperator
  value: string
}

type LocationStringMapping = {
  id: string
  csvValue: string
  pipelineValue: string
}

type PipelineMappingConfig = {
  pipelineName: string
  csvLocationColumn: string
  csvDimensionColumn: string
  csvAreaColumn: string
  csvAmenitiesColumn: string
  dimensionMode: "full" | "first_two"
  locationMappings: LocationStringMapping[]
  fallbackPipelineName: string
}

type MappingGroupCompetitorColumn = string

type MappingGroupPair = {
  id: string
  csvValue: string
  pipelineValue: string
  exactMatch: boolean
  csvFirstTwoDimensions: boolean
}

type MappingGroupColumnMapping = {
  id: string
  csvColumn: string
  competitorColumn: MappingGroupCompetitorColumn
  pairs: MappingGroupPair[]
}

type MappingGroup = {
  id: string
  name: string
  pipelineName: string
  fallbackGroupId: string
  dimensionMode: "full" | "first_two"
  columnMappings: MappingGroupColumnMapping[]
}

function createDefaultAmenityAdjusterState(): AmenityAdjusterState {
  return {
    applyToWeb: true,
    premium: { multiplier: "1", offset: "0" },
    standard: { multiplier: "1", offset: "0" },
    economy: { multiplier: "1", offset: "0" },
  }
}

// ...existing code...

type CsvRateChange = {
  id: string
  rowIndex: number
  columnIndex: number
  columnName: string
  originalValue: string
  processedValue: string
}

type ReviewRow = {
  id: string
  rowIndex: number
  traceCalculatedRowIndex: number | null
  traceTargetId: string | null
  traceDetails: {
    pipelineName: string
    price: string
    comboMapEntries: Array<{ key: string; value: string }>
  } | null
  facilityName: string
  unitSize: string
  totalUnits: string
  occupied: string
  available: string
  vacancy: string
  occupancy: string
  hasElevatorAccessAmenity: boolean
  hasDriveUpAmenity: boolean
  hasFirstFloorAmenity: boolean
  hasClimateControlledAmenity: boolean
  amenityLevel: "Premium" | "Standard" | "Economy" | ""
  currentWebRate: string
  proposedWebRate: string
  currentStandardRate: string
  proposedStandardRate: string
  webRateChange: CsvRateChange | null
  standardRateChange: CsvRateChange | null
}

type ReviewData = {
  fileName: string
  headers: string[]
  originalRows: string[][]
  processedRows: string[][]
  changes: CsvRateChange[]
  reviewRows: ReviewRow[]
}

type SortDirection = "asc" | "desc"
type ReviewSortColumn =
  | "rowIndex"
  | "facilityName"
  | "unitSize"
  | "totalUnits"
  | "occupied"
  | "available"
  | "vacancy"
  | "occupancy"
  | "hasElevatorAccessAmenity"
  | "hasDriveUpAmenity"
  | "hasFirstFloorAmenity"
  | "hasClimateControlledAmenity"
  | "amenityLevel"
  | "currentWebRate"
  | "proposedWebRate"
  | "webDecision"
  | "currentStandardRate"
  | "proposedStandardRate"
  | "standardDecision"

type ProcessedCsvResult = ParsedCsv & {
  traceByCsvRowIndex: Record<number, number>
  traceDetailsByCsvRowIndex: Record<number, {
    pipelineName: string
    price: string
    comboMapEntries: Array<{ key: string; value: string }>
  }>
}


const DEFAULT_STANDARD_RATE_FUNCTION = "x < 100 ? 1.8x : x < 200 ? 1.6x + 20 : 1.4x + 60"

const REVIEWABLE_RATE_COLUMNS = new Set(["newwebrate", "newstandardrate", "newrentrate"])
const CURRENT_WEB_RATE_COLUMNS = new Set(["currentwebrate", "currentrentrate"])
const CURRENT_STANDARD_RATE_COLUMNS = new Set(["currentstandardrate"])
const FACILITY_NAME_COLUMNS = new Set(["facilityname"])
const UNIT_SIZE_COLUMNS = new Set(["size", "unitsize", "unitdimensions"])
const AREA_COLUMNS = new Set(["area", "unitarea", "sqft", "squarefeet"])
const UNIT_AMENITIES_COLUMNS = new Set(["unitamenities", "amenities", "unit_amenities"])
const LOCATION_COLUMNS = new Set(["facilityname"])
const NEW_WEB_RATE_COLUMNS = new Set(["newwebrate", "newrentrate"])
const NEW_STANDARD_RATE_COLUMNS = new Set(["newstandardrate"])
const CURRENT_RENT_RATE_COLUMNS = new Set(["currentrentrate"])
const NEW_RENT_RATE_COLUMNS = new Set(["newrentrate"])
const MATCHED_UNIT_AREA_COLUMNS = new Set(["matchedunitarea", "unitareamatch"])
const TOTAL_UNITS_COLUMNS = new Set(["totalunits"])
const OCCUPIED_COLUMNS = new Set(["occupied"])
const AVAILABLE_COLUMNS = new Set(["available"])
const VACANCY_COLUMNS = new Set(["vacancy"])
const OCCUPANCY_COLUMNS = new Set(["occupancy"])
const RATE_VARIABLE_EXCLUSIONS = new Set([
  "currentwebrate",
  "newwebrate",
  "currentstandardrate",
  "newstandardrate",
])

function normalizeColumnKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function isReviewableRateColumn(columnName: string): boolean {
  return REVIEWABLE_RATE_COLUMNS.has(normalizeColumnKey(columnName))
}

// =========================
// Mapping helpers (CSV <-> pipeline keys)
// =========================
function findColumnIndex(headers: string[], candidates: Set<string>): number {
  return headers.findIndex((header) => candidates.has(normalizeColumnKey(header)))
}

function getCellValue(row: string[] | undefined, index: number): string {
  if (!row || index < 0) return ""
  return row[index] ?? ""
}

function normalizeMatchValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function extractLeadingDimensionPair(value: unknown): string {
  const raw = String(value ?? "").toLowerCase().replace(/×/g, "x")
  const match = raw.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/)
  if (!match) return ""
  return `${match[1]}x${match[2]}`
}

function normalizeDimensionValue(value: unknown): string {
  const leadingPair = extractLeadingDimensionPair(value)
  if (leadingPair) return leadingPair
  return normalizeMatchValue(value).replace(/\s+/g, "")
}

function normalizeUnitAreaValue(value: unknown): string {
  const asNumber = Number(String(value ?? "").replace(/[^0-9.\-]/g, ""))
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return Number.isInteger(asNumber) ? String(Math.trunc(asNumber)) : String(asNumber)
  }
  return ""
}

function computeAreaFromDimensionLikeValue(value: unknown): string {
  const raw = String(value ?? "").toLowerCase().replace(/×/g, "x")
  const match = raw.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/)
  if (!match) return ""
  const a = Number(match[1])
  const b = Number(match[2])
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return ""
  const area = a * b
  return Number.isInteger(area) ? String(Math.trunc(area)) : String(area)
}

function getDimensionLookupToken(value: unknown): string {
  const dimension = normalizeDimensionValue(value)
  return dimension ? `dim:${dimension}` : ""
}

function getAreaLookupToken(value: unknown): string {
  const explicitArea = normalizeUnitAreaValue(value)
  if (explicitArea) return `area:${explicitArea}`

  const derivedArea = computeAreaFromDimensionLikeValue(value)
  return derivedArea ? `area:${derivedArea}` : ""
}

function parseAreaTokenValue(areaToken: string): number | null {
  if (!areaToken) return null
  const stripped = areaToken.replace(/^area:/, "")
  const n = Number(stripped)
  return Number.isFinite(n) ? n : null
}

function isTruthyFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value
  const normalized = normalizeMatchValue(value)
  return ["true", "yes", "y", "1"].includes(normalized)
}

function hasClimateControlledAmenity(value: unknown): boolean {
  const normalized = normalizeMatchValue(value)
  if (!normalized) return false
  return (
    normalized.includes("climate-controlled") ||
    normalized.includes("climate controlled") ||
    normalized.includes("climatecontrolled")
  )
}

function hasElevatorAccessAmenity(value: unknown): boolean {
  const normalized = normalizeMatchValue(value)
  if (!normalized) return false
  return (
    normalized.includes("elevator access") ||
    normalized.includes("elevator-access") ||
    normalized.includes("elevatoraccess")
  )
}

function hasFirstFloorAmenity(value: unknown): boolean {
  const normalized = normalizeMatchValue(value)
  if (!normalized) return false
  return (
    normalized.includes("1st floor") ||
    normalized.includes("first floor") ||
    normalized.includes("1st-floor") ||
    normalized.includes("first-floor") ||
    normalized.includes("1stfloor") ||
    normalized.includes("firstfloor")
  )
}

function normalizeDriveUpAccessValue(value: unknown): "true" | "false" | "" {
  if (typeof value === "boolean") return value ? "true" : "false"

  const normalized = normalizeMatchValue(value)
  if (!normalized) return ""

  if (normalized.includes("drive up") || normalized.includes("drive-up") || normalized.includes("driveup")) {
    return "true"
  }

  if (["true", "yes", "y", "1"].includes(normalized)) return "true"
  if (["false", "no", "n", "0"].includes(normalized)) return "false"

  return "false"
}

function buildAmenityToken(parts: string[]): string {
  const uniq = Array.from(new Set(parts.filter(Boolean))).sort()
  return uniq.join("|")
}

function buildCalculatedAmenityRequirementToken(comboMap: Record<string, unknown>): string {
  const requiredParts: string[] = []
  const firstFloorSource =
    comboMap.storage_level_description ??
    comboMap.storage_level ??
    comboMap.unit_amenities ??
    comboMap.amenities

  if (normalizeDriveUpAccessValue(comboMap.has_drive_up_access) === "true") requiredParts.push("drive-up")
  if (isTruthyFlag(comboMap.is_climate_controlled)) requiredParts.push("climate-controlled")
  if (isTruthyFlag(comboMap.has_elevator_access)) requiredParts.push("elevator-access")
  if (hasFirstFloorAmenity(firstFloorSource)) requiredParts.push("1st-floor")
  return buildAmenityToken(requiredParts)
}

function buildCsvAmenityTokenSubsets(value: unknown): string[] {
  const presentParts: string[] = []
  if (normalizeDriveUpAccessValue(value) === "true") presentParts.push("drive-up")
  if (hasClimateControlledAmenity(value)) presentParts.push("climate-controlled")
  if (hasElevatorAccessAmenity(value)) presentParts.push("elevator-access")
  if (hasFirstFloorAmenity(value)) presentParts.push("1st-floor")

  const uniq = Array.from(new Set(presentParts)).sort()
  const subsets: string[] = [""]
  const total = 1 << uniq.length
  for (let mask = 1; mask < total; mask++) {
    const subset: string[] = []
    for (let i = 0; i < uniq.length; i++) {
      if (mask & (1 << i)) subset.push(uniq[i])
    }
    subsets.push(buildAmenityToken(subset))
  }

  subsets.sort((a, b) => {
    const aLen = a ? a.split("|").length : 0
    const bLen = b ? b.split("|").length : 0
    return bLen - aLen
  })
  return Array.from(new Set(subsets))
}

function findLookupByAmenitySubsets(
  map: Map<string, Array<{ price: number; calculatedRowIndex: number; pipelineName?: string }>>,
  place: string,
  dimensionOrAreaToken: string,
  amenitySubsets: string[],
  selectedPipelineName?: string
): { price: number; calculatedRowIndex: number } | undefined {
  for (const subset of amenitySubsets) {
    const key = buildPriceLookupKey(place, dimensionOrAreaToken, subset || undefined)
    const matches = map.get(key)
    if (!matches || matches.length === 0) continue
    if (selectedPipelineName) {
      const scoped = matches.find((candidate) => candidate.pipelineName === selectedPipelineName)
      if (scoped) return scoped
    }
    return matches[0]
  }
  return undefined
}

function buildPriceLookupKey(location: string, dimension: string, driveUpAccess?: string): string {
  const driveUpPart = driveUpAccess ? `__${driveUpAccess}` : ""
  return `${location}__${dimension}${driveUpPart}`
}

function applyConfiguredRounding(value: number, rounding?: { enabled: boolean; offset: number }): number {
  if (!rounding?.enabled || !Number.isFinite(value)) return value
  const offsetRaw = Number.isFinite(rounding.offset) ? rounding.offset : 0
  const offset = Math.min(1, Math.max(0, offsetRaw))
  const rounded = Math.round(value - offset) + offset
  return Object.is(rounded, -0) ? 0 : rounded
}

function parseCurrencyLikeNumber(value: unknown): number {
  const cleaned = String(value ?? "").replace(/[$,%\s,]/g, "")
  return Number(cleaned)
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return ""
  return `$${value.toFixed(2)}`
}

function resolveAmenityTier(value: unknown): "premium" | "standard" | "economy" | null {
  const normalized = normalizeMatchValue(value)
  if (!normalized) return null
  if (normalized.includes("premium")) return "premium"
  if (normalized.includes("standard")) return "standard"
  if (normalized.includes("economy")) return "economy"
  return null
}

function applyAmenityAdjustment(
  value: number,
  adjuster?: { multiplier?: number; add?: number; subtract?: number; offset?: number }
): number {
  if (!adjuster || !Number.isFinite(value)) return value;
  const m = Number.isFinite(adjuster.multiplier) ? adjuster.multiplier! : 1;
  const add = Number.isFinite(adjuster.add) ? adjuster.add! : 0;
  const sub = Number.isFinite(adjuster.subtract) ? adjuster.subtract! : 0;
  const offset = Number.isFinite(adjuster.offset) ? adjuster.offset! : 0;
  return value * m + add - sub + offset;
}

function LevelsAdjusterPreviewCard({ amenityAdjuster, onRemove, stepNumber, totalSteps }: { amenityAdjuster: AmenityAdjusterState; onRemove?: () => void; stepNumber?: number; totalSteps?: number }) {
  const tiers = [
    { key: "premium", label: "Premium", value: amenityAdjuster.premium },
    { key: "standard", label: "Standard", value: amenityAdjuster.standard },
    { key: "economy", label: "Economy", value: amenityAdjuster.economy },
  ] as const

  const formatOffset = (value: string) => {
    const n = Number(value)
    if (!Number.isFinite(n)) return "$0"
    return n >= 0 ? `+ $${n}` : `- $${Math.abs(n)}`
  }

  return (
    <AdjusterCardShell
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      accentColor="#0f766e"
      className="border-teal-100/80 bg-white"
      onRemove={onRemove}
      badge={
        <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-100/80 px-3 py-1 text-xs font-semibold text-teal-800">
          <Layers3 className="h-4 w-4" />
          Levels
        </div>
      }
    >
      <div className="rounded-2xl border border-teal-100/70 bg-teal-50/60 px-3 py-2 -ml-2">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {tiers.map((tier) => (
            <div key={tier.key} className="rounded-xl bg-white/90 px-2 py-2 shadow-sm">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{tier.label}</div>
              <div className="mt-1 font-mono text-sm text-foreground">× {tier.value.multiplier || "1"}</div>
              <div className="mt-0.5 font-mono text-xs text-muted-foreground">{formatOffset(tier.value.offset)}</div>
            </div>
          ))}
        </div>
      </div>
    </AdjusterCardShell>
  )
}

function hasConfiguredLevelsAdjuster(amenityAdjuster: AmenityAdjusterState): boolean {
  const parse = (value: string, fallback: number) => {
    const n = Number((value ?? "").trim())
    return Number.isFinite(n) ? n : fallback
  }

  const premiumMultiplier = parse(amenityAdjuster.premium.multiplier, 1)
  const standardMultiplier = parse(amenityAdjuster.standard.multiplier, 1)
  const economyMultiplier = parse(amenityAdjuster.economy.multiplier, 1)

  const premiumOffset = parse(amenityAdjuster.premium.offset, 0)
  const standardOffset = parse(amenityAdjuster.standard.offset, 0)
  const economyOffset = parse(amenityAdjuster.economy.offset, 0)

  return (
    premiumMultiplier !== 1 ||
    standardMultiplier !== 1 ||
    economyMultiplier !== 1 ||
    premiumOffset !== 0 ||
    standardOffset !== 0 ||
    economyOffset !== 0
  )
}

function resolveStandardRateValue(webRate: number, functionBody?: string): number {
  if (!Number.isFinite(webRate) || webRate <= 0) return webRate
  const trimmed = functionBody?.trim() || DEFAULT_STANDARD_RATE_FUNCTION
  const evaluated = evaluateSafeFunction(trimmed, webRate)
  if (evaluated.success && typeof evaluated.value === "number" && Number.isFinite(evaluated.value)) {
    return evaluated.value
  }
  return webRate
}

function rowToRecord(headers: string[], row: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < headers.length; i++) {
    out[headers[i]] = row[i] ?? ""
  }
  return out
}

function getCsvValueByColumn(record: Record<string, string>, column: string): string {
  const direct = record[column]
  if (typeof direct === "string") return direct

  const normalizedTarget = normalizeColumnKey(column)
  if (!normalizedTarget) return ""

  for (const [key, value] of Object.entries(record)) {
    if (normalizeColumnKey(key) === normalizedTarget) return value ?? ""
  }
  return ""
}

function findColumnIndexByHeaderName(headers: string[], preferredHeader: string): number {
  const normalizedTarget = normalizeColumnKey(preferredHeader)
  if (!normalizedTarget) return -1
  return headers.findIndex((header) => normalizeColumnKey(header) === normalizedTarget)
}

function getDimensionLookupTokenByMode(value: unknown, mode: "full" | "first_two"): string {
  if (mode === "first_two") {
    const pair = extractLeadingDimensionPair(value)
    if (pair) return `dim:${pair}`
  }

  const normalized = normalizeMatchValue(value).replace(/\s+/g, "")
  return normalized ? `dim:${normalized}` : ""
}

function translateCsvLocationValue(raw: string, mappings: LocationStringMapping[]): string {
  const normalizedRaw = normalizeMatchValue(raw)
  for (const mapping of mappings) {
    if (normalizeMatchValue(mapping.csvValue) === normalizedRaw && mapping.pipelineValue.trim()) {
      return mapping.pipelineValue
    }
  }
  return raw
}

function doesMappingRuleMatch(record: Record<string, string>, rule: PipelineMappingRule): boolean {
  const leftRaw = String(getCsvValueByColumn(record, rule.column) ?? "")
  const left = leftRaw.trim().toLowerCase()
  const right = String(rule.value ?? "").trim().toLowerCase()

  switch (rule.operator) {
    case "contains":
      return right.length > 0 && left.includes(right)
    case "equals":
      return left === right
    case "not_contains":
      return right.length > 0 && !left.includes(right)
    case "empty":
      return left.length === 0
    case "not_empty":
      return left.length > 0
    default:
      return false
  }
}

function findGroupColumnMapping(
  group: MappingGroup,
  competitorColumn: string
): MappingGroupColumnMapping | undefined {
  const normalizedTarget = normalizeColumnKey(competitorColumn)
  return group.columnMappings.find((mapping) => normalizeColumnKey(mapping.competitorColumn) === normalizedTarget)
}

function getComboMapValueByColumn(comboMap: Record<string, unknown>, column: string): string {
  const target = normalizeColumnKey(column)
  if (!target) return ""
  for (const [key, value] of Object.entries(comboMap)) {
    if (normalizeColumnKey(key) === target) {
      if (Array.isArray(value)) return value.map((item) => String(item ?? "")).join(", ")
      return String(value ?? "")
    }
  }
  return ""
}

function doesGroupMappingPairMatch(
  csvRaw: string,
  pipelineRaw: string,
  pair: MappingGroupPair,
  pipelineColumnName?: string
): boolean {
  if (pair.csvFirstTwoDimensions) {
    const normalizedPipelineColumn = normalizeColumnKey(String(pipelineColumnName ?? ""))

    if (normalizedPipelineColumn === "unitarea") {
      const csvAreaRaw = computeAreaFromDimensionLikeValue(csvRaw)
      const pipelineAreaRaw = normalizeUnitAreaValue(pipelineRaw) || computeAreaFromDimensionLikeValue(pipelineRaw)
      const csvArea = Number(csvAreaRaw)
      const pipelineArea = Number(pipelineAreaRaw)
      return Number.isFinite(csvArea) && Number.isFinite(pipelineArea) && Math.abs(csvArea - pipelineArea) < 0.000001
    }

    if (normalizedPipelineColumn === "unitdimensions") {
      const csvDim = extractLeadingDimensionPair(csvRaw)
      const pipelineDim = normalizeDimensionValue(pipelineRaw)
      return Boolean(csvDim) && Boolean(pipelineDim) && csvDim === pipelineDim
    }

    return false
  }

  if (pair.exactMatch) {
    return normalizeMatchValue(csvRaw) === normalizeMatchValue(pipelineRaw)
  }

  return normalizeMatchValue(csvRaw) === normalizeMatchValue(pair.csvValue)
    && normalizeMatchValue(pipelineRaw) === normalizeMatchValue(pair.pipelineValue)
}

function applyPopupAdjustersToWebRate(
  baseWebRate: number,
  csvRow: Record<string, string>,
  popupAdjusters: Adjuster[]
): number {
  let nextRate = baseWebRate

  for (const adjuster of popupAdjusters) {
    if (adjuster.type === 'competitive') {
      const mode = (adjuster as { mode?: "multiplier" | "add" | "subtract" }).mode ?? "multiplier"
      const rawValue = Number(
        (adjuster as { value?: number; multiplier?: number }).value ??
        (adjuster as { multiplier?: number }).multiplier ??
        (mode === "multiplier" ? 1 : 0)
      )
      const value = Number.isFinite(rawValue) ? rawValue : (mode === "multiplier" ? 1 : 0)

      if (mode === "add") {
        nextRate += value
      } else if (mode === "subtract") {
        nextRate -= value
      } else if (value > 0) {
        nextRate *= value
      }
      continue
    }

    if (adjuster.type === 'function') {
      const fn = adjuster as { variable?: string; function_string?: string }
      const variable = String(fn.variable ?? "")
      const functionString = String(fn.function_string ?? "")
      if (!variable || !functionString) continue

      let x = parseCurrencyLikeNumber(csvRow[variable])
      if (!Number.isFinite(x)) {
        const normalizedVariable = normalizeColumnKey(variable)
        if (normalizedVariable) {
          for (const [header, rawValue] of Object.entries(csvRow)) {
            if (normalizeColumnKey(header) === normalizedVariable) {
              x = parseCurrencyLikeNumber(rawValue)
              break
            }
          }
        }
      }
      if (!Number.isFinite(x)) continue
      const evaluated = evaluateSafeFunction(functionString, x)
      if (evaluated.success && typeof evaluated.value === 'number' && Number.isFinite(evaluated.value)) {
        nextRate *= evaluated.value
      }
    }
  }

  return Number.isFinite(nextRate) ? nextRate : baseWebRate
}

function normalizeCityValue(value: unknown): string {
  const normalized = normalizeMatchValue(value)
  if (!normalized) return ""

  // Facility labels like "modSTORAGE - Laramie" → "laramie"
  const hyphenParts = normalized.split("-").map((p) => p.trim()).filter(Boolean)
  if (hyphenParts.length > 1) {
    return hyphenParts[hyphenParts.length - 1].replace(/^modstorage\s*/g, "").trim()
  }

  // Address-like strings: "street, city, state" → city; "city, state" → city
  const commaParts = normalized.split(",").map((p) => p.trim()).filter(Boolean)
  if (commaParts.length >= 3) return commaParts[commaParts.length - 2]
  if (commaParts.length === 2) return commaParts[0]

  return normalized.replace(/^modstorage\s*/g, "").trim()
}

function normalizeLocationKey(value: unknown): string {
  const raw = String(value ?? "")
  if (!raw.trim()) return ""

  const firstLine = raw.split(/\r?\n/)[0] ?? ""
  const normalized = normalizeMatchValue(firstLine)
  if (!normalized) return ""

  // Facility label format: "modSTORAGE - Airport Way" -> "airport way"
  const hyphenParts = normalized.split("-").map((part) => part.trim()).filter(Boolean)
  if (hyphenParts.length > 1) {
    return hyphenParts[hyphenParts.length - 1]
  }

  // Address format: "1118 Airport Way, Monterey, CA 93940" -> "airport way"
  const streetPart = normalized.split(",")[0]?.trim() ?? ""
  if (streetPart) {
    return streetPart.replace(/^\d+\s+/, "").trim()
  }

  return normalized
}

function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        currentCell += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentCell += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ',') {
      currentRow.push(currentCell)
      currentCell = ""
      continue
    }

    if (char === '\n') {
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ""
      continue
    }

    if (char === '\r') {
      continue
    }

    currentCell += char
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell)
    rows.push(currentRow)
  }

  return rows
}

function detectNumericCsvColumns(parsed: ParsedCsv): string[] {
  if (!parsed.headers.length || !parsed.rows.length) return []

  const numericHeaders: string[] = []
  for (let col = 0; col < parsed.headers.length; col++) {
    const header = parsed.headers[col]
    let seen = 0
    let numeric = 0

    for (const row of parsed.rows) {
      const raw = String(row[col] ?? "").trim()
      if (!raw) continue
      seen += 1

      const cleaned = raw.replace(/[$,%\s,]/g, "")
      const n = Number(cleaned)
      if (Number.isFinite(n)) numeric += 1

      if (seen >= 50) break
    }

    if (seen > 0 && numeric / seen >= 0.7) {
      numericHeaders.push(header)
    }
  }

  return numericHeaders
}

function toParsedCsv(text: string): ParsedCsv {
  const matrix = parseCsvText(text)
  if (matrix.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = matrix[0]
  const rows = matrix.slice(1).map((row) => {
    if (row.length >= headers.length) return row.slice(0, headers.length)
    return [...row, ...new Array(headers.length - row.length).fill("")]
  })

  return { headers, rows }
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function toCsvText(headers: string[], rows: string[][]): string {
  const body = [headers, ...rows]
  return body
    .map((row) => row.map((cell) => escapeCsvCell(cell ?? "")).join(","))
    .join("\r\n")
}

function downloadCsv(content: Blob | string, filename: string) {
  const blob = typeof content === "string" ? new Blob([content], { type: "text/csv;charset=utf-8" }) : content
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

function buildChanges(original: ParsedCsv, processed: ParsedCsv): CsvRateChange[] {
  const headers = processed.headers.length ? processed.headers : original.headers
  const rowCount = Math.max(original.rows.length, processed.rows.length)
  const colCount = Math.max(original.headers.length, processed.headers.length)

  const changes: CsvRateChange[] = []
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const originalRow = original.rows[rowIndex] ?? []
    const processedRow = processed.rows[rowIndex] ?? []

    for (let columnIndex = 0; columnIndex < colCount; columnIndex++) {
      const originalValue = originalRow[columnIndex] ?? ""
      const processedValue = processedRow[columnIndex] ?? ""
      if (originalValue === processedValue) continue

      const columnName = headers[columnIndex] ?? `Column ${columnIndex + 1}`
      if (!isReviewableRateColumn(columnName)) continue
      const id = `${rowIndex}-${columnIndex}`
      changes.push({
        id,
        rowIndex,
        columnIndex,
        columnName,
        originalValue,
        processedValue,
      })
    }
  }

  return changes
}

function buildReviewRows(
  original: ParsedCsv,
  processed: ParsedCsv,
  changes: CsvRateChange[],
  traceByCsvRowIndex?: Record<number, number>,
  traceDetailsByCsvRowIndex?: Record<number, {
    pipelineName: string
    price: string
    comboMapEntries: Array<{ key: string; value: string }>
  }>
): ReviewRow[] {
  const headers = processed.headers.length ? processed.headers : original.headers
  const facilityNameIndex = findColumnIndex(headers, FACILITY_NAME_COLUMNS)
  const unitSizeIndex = findColumnIndex(headers, UNIT_SIZE_COLUMNS)
  const currentWebRateIndex = findColumnIndex(headers, CURRENT_WEB_RATE_COLUMNS)
  const currentRentRateIndex = findColumnIndex(headers, CURRENT_RENT_RATE_COLUMNS)
  const currentStandardRateIndex = findColumnIndex(headers, CURRENT_STANDARD_RATE_COLUMNS)
  const totalUnitsIndex = findColumnIndex(headers, TOTAL_UNITS_COLUMNS)
  const occupiedIndex = findColumnIndex(headers, OCCUPIED_COLUMNS)
  const availableIndex = findColumnIndex(headers, AVAILABLE_COLUMNS)
  const vacancyIndex = findColumnIndex(headers, VACANCY_COLUMNS)
  const occupancyIndex = findColumnIndex(headers, OCCUPANCY_COLUMNS)
  const amenitiesIndex = findColumnIndex(headers, UNIT_AMENITIES_COLUMNS)
  const newWebRateIndex = findColumnIndex(headers, NEW_WEB_RATE_COLUMNS)
  const newStandardRateIndex = findColumnIndex(headers, NEW_STANDARD_RATE_COLUMNS)

  const byRow = new Map<number, ReviewRow>()

  for (const change of changes) {
    const originalRow = original.rows[change.rowIndex] ?? []
    const processedRow = processed.rows[change.rowIndex] ?? []
    const existing = byRow.get(change.rowIndex)
    const amenitiesValue = getCellValue(originalRow, amenitiesIndex) || getCellValue(processedRow, amenitiesIndex)

    const baseRow: ReviewRow = existing ?? {
      id: `row-${change.rowIndex}`,
      rowIndex: change.rowIndex,
      traceCalculatedRowIndex: Number.isFinite(traceByCsvRowIndex?.[change.rowIndex])
        ? Number(traceByCsvRowIndex?.[change.rowIndex])
        : null,
      traceTargetId: Number.isFinite(traceByCsvRowIndex?.[change.rowIndex])
        ? `calculated-price-row-${Number(traceByCsvRowIndex?.[change.rowIndex])}`
        : null,
      traceDetails: traceDetailsByCsvRowIndex?.[change.rowIndex] ?? null,
      facilityName: getCellValue(originalRow, facilityNameIndex) || getCellValue(processedRow, facilityNameIndex),
      unitSize: getCellValue(originalRow, unitSizeIndex) || getCellValue(processedRow, unitSizeIndex),
      totalUnits: getCellValue(originalRow, totalUnitsIndex) || getCellValue(processedRow, totalUnitsIndex),
      occupied: getCellValue(originalRow, occupiedIndex) || getCellValue(processedRow, occupiedIndex),
      available: getCellValue(originalRow, availableIndex) || getCellValue(processedRow, availableIndex),
      vacancy: getCellValue(originalRow, vacancyIndex) || getCellValue(processedRow, vacancyIndex),
      occupancy: getCellValue(originalRow, occupancyIndex) || getCellValue(processedRow, occupancyIndex),
      hasElevatorAccessAmenity: hasElevatorAccessAmenity(amenitiesValue),
      hasDriveUpAmenity: normalizeDriveUpAccessValue(amenitiesValue) === "true",
      hasFirstFloorAmenity: hasFirstFloorAmenity(amenitiesValue),
      hasClimateControlledAmenity: hasClimateControlledAmenity(amenitiesValue),
      amenityLevel: (() => {
        const tier = resolveAmenityTier(amenitiesValue)
        if (tier === "premium") return "Premium"
        if (tier === "standard") return "Standard"
        if (tier === "economy") return "Economy"
        return ""
      })(),
      currentWebRate: getCellValue(originalRow, currentWebRateIndex) || getCellValue(originalRow, currentRentRateIndex),
      proposedWebRate: getCellValue(processedRow, newWebRateIndex),
      currentStandardRate: getCellValue(originalRow, currentStandardRateIndex),
      proposedStandardRate: getCellValue(processedRow, newStandardRateIndex),
      webRateChange: null,
      standardRateChange: null,
    }

    const normalizedColumn = normalizeColumnKey(change.columnName)
    if (normalizedColumn === "newwebrate" || normalizedColumn === "newrentrate") {
      baseRow.webRateChange = change
      baseRow.proposedWebRate = change.processedValue
    }

    if (normalizedColumn === "newstandardrate") {
      baseRow.standardRateChange = change
      baseRow.proposedStandardRate = change.processedValue
    }

    byRow.set(change.rowIndex, baseRow)
  }

  return Array.from(byRow.values()).sort((a, b) => a.rowIndex - b.rowIndex)
}

// =========================
// Core mapping engine (calculated rows -> uploaded CSV)
// =========================
function applyCalculatedPricesToCsv(
  original: ParsedCsv,
  calculatedRows: CalculatedPriceRow[],
  rounding?: {
    enabled: boolean
    offset: number
    standard?: {
      enabled: boolean
      offset: number
    }
  },
  popupAdjusters: Adjuster[] = [],
  amenityAdjuster?: ResolvedAmenityAdjuster,
  standardRateFunction?: string,
  mappingRules: PipelineMappingRule[] = [],
  pipelineMappingConfigs: PipelineMappingConfig[] = [],
  mappingGroups: MappingGroup[] = []
): ProcessedCsvResult {
  const webRounding = rounding?.enabled === true
    ? {
        enabled: true,
        offset: Number.isFinite(rounding.offset) ? rounding.offset : 0,
      }
    : {
        enabled: false,
        offset: 0,
      }

  const standardRounding = rounding?.standard?.enabled === true
    ? {
        enabled: true,
        offset: Number.isFinite(rounding.standard.offset) ? rounding.standard.offset : 0,
      }
    : {
        enabled: false,
        offset: 0,
      }

  const headers = [...original.headers]
  const rows = original.rows.map((row) => [...row])

  const getPipelineConfig = (pipelineName: string): PipelineMappingConfig | undefined =>
    pipelineMappingConfigs.find((cfg) => cfg.pipelineName === pipelineName)
  const getGroupById = (id: string): MappingGroup | undefined => mappingGroups.find((group) => group.id === id)

  const usingGroups = mappingGroups.length > 0

  const mappedPipelineNames = Array.from(new Set(mappingRules.map((rule) => rule.pipelineName).filter(Boolean)))
  const hasUnitAreaRowsPre = calculatedRows.some((row) => Boolean(getAreaLookupToken(row.comboMap.unit_area)))

  for (const pipelineName of mappedPipelineNames) {
    const cfg = getPipelineConfig(pipelineName)
    if (!cfg) {
      throw new Error(`Mapping configuration is missing for pipeline \"${pipelineName}\".`)
    }
    if (!cfg.csvLocationColumn.trim()) {
      throw new Error(`Mapping for pipeline \"${pipelineName}\" must define a Location column.`)
    }
    if (hasUnitAreaRowsPre) {
      if (!cfg.csvAreaColumn.trim()) {
        throw new Error(`Mapping for pipeline \"${pipelineName}\" must define an Area column.`)
      }
    } else if (!cfg.csvDimensionColumn.trim()) {
      throw new Error(`Mapping for pipeline \"${pipelineName}\" must define a Dimension column.`)
    }
  }

  if (usingGroups) {
    const hasSamePipelineFallbackAncestor = (group: MappingGroup): boolean => {
      const visited = new Set<string>()
      let cursor: MappingGroup | undefined = group
      while (cursor?.fallbackGroupId) {
        if (visited.has(cursor.fallbackGroupId)) break
        visited.add(cursor.fallbackGroupId)
        const parent = getGroupById(cursor.fallbackGroupId)
        if (!parent) break
        if (normalizeColumnKey(parent.pipelineName) === normalizeColumnKey(group.pipelineName)) {
          return true
        }
        cursor = parent
      }
      return false
    }

    for (const group of mappingGroups) {
      if (!group.pipelineName.trim()) {
        throw new Error(`Mapping group "${group.name || "Unnamed group"}" must define a pipeline.`)
      }
      const locationMapping = findGroupColumnMapping(group, "client_location")
      if (!locationMapping?.csvColumn.trim()) {
        throw new Error(`Mapping group "${group.name || "Unnamed group"}" must map a CSV column to client_location.`)
      }
      if (hasUnitAreaRowsPre) {
        const areaMapping = findGroupColumnMapping(group, "unit_area")
        if (!areaMapping?.csvColumn.trim()) {
          throw new Error(`Mapping group "${group.name || "Unnamed group"}" must map a CSV column to unit_area.`)
        }
      } else {
        const dimensionMapping = findGroupColumnMapping(group, "unit_dimensions")
        if (!dimensionMapping?.csvColumn.trim()) {
          throw new Error(`Mapping group "${group.name || "Unnamed group"}" must map a CSV column to unit_dimensions.`)
        }
      }
      if (group.fallbackGroupId && !getGroupById(group.fallbackGroupId)) {
        throw new Error(`Mapping group "${group.name || "Unnamed group"}" has an invalid fallback group.`)
      }
    }

    const groupsByPipeline = new Map<string, MappingGroup[]>()
    for (const group of mappingGroups) {
      const key = normalizeColumnKey(group.pipelineName)
      if (!key) continue
      const next = groupsByPipeline.get(key) ?? []
      next.push(group)
      groupsByPipeline.set(key, next)
    }

    for (const groups of groupsByPipeline.values()) {
      if (groups.length <= 1) continue
      const rootsWithoutSamePipelineFallback = groups.filter((group) => !hasSamePipelineFallbackAncestor(group))
      if (rootsWithoutSamePipelineFallback.length > 1) {
        const names = rootsWithoutSamePipelineFallback.map((group) => group.name || "Unnamed group").join(", ")
        throw new Error(`Only one root mapping group is allowed per pipeline. For shared pipeline groups, make additional groups fall back to the same pipeline chain. Conflicting groups: ${names}`)
      }
    }
  }

  const defaultLocationIndex = findColumnIndex(headers, LOCATION_COLUMNS)
  const defaultUnitSizeIndex = findColumnIndex(headers, UNIT_SIZE_COLUMNS)
  const defaultAreaIndex = findColumnIndex(headers, AREA_COLUMNS)
  const defaultUnitAmenitiesIndex = findColumnIndex(headers, UNIT_AMENITIES_COLUMNS)
  let newWebRateIndex = findColumnIndex(headers, NEW_WEB_RATE_COLUMNS)
  let newStandardRateIndex = findColumnIndex(headers, NEW_STANDARD_RATE_COLUMNS)
  const newRentRateIndex = findColumnIndex(headers, NEW_RENT_RATE_COLUMNS)
  let matchedUnitAreaIndex = findColumnIndex(headers, MATCHED_UNIT_AREA_COLUMNS)

  if (!usingGroups && defaultLocationIndex < 0) {
    throw new Error("CSV must include a facility/location column to map frontend pricing.")
  }

  if (!usingGroups && hasUnitAreaRowsPre && defaultAreaIndex < 0) {
    throw new Error("CSV must include an Area column to match unit_area pipelines.")
  }

  if (!usingGroups && !hasUnitAreaRowsPre && defaultUnitSizeIndex < 0) {
    throw new Error("CSV must include a Size column to match unit_dimensions pipelines.")
  }
  if (newWebRateIndex < 0 && newRentRateIndex >= 0) {
    newWebRateIndex = newRentRateIndex
  }

  if (newWebRateIndex < 0) {
    throw new Error("CSV must include New Web Rate or New Rent Rate column.")
  }

  if (newStandardRateIndex < 0) {
    headers.push("New Standard Rate")
    newStandardRateIndex = headers.length - 1
    for (const row of rows) row.push("")
  }

  const hasAmenityAdjustments = Boolean(
    amenityAdjuster &&
    amenityAdjuster.applyToWeb &&
    (amenityAdjuster.premium || amenityAdjuster.standard || amenityAdjuster.economy)
  )
  if (hasAmenityAdjustments && defaultUnitAmenitiesIndex < 0) {
    throw new Error("CSV must include a Unit Amenities column to apply amenity adjustments.")
  }

  if (matchedUnitAreaIndex < 0) {
    headers.push("Matched Unit Area")
    matchedUnitAreaIndex = headers.length - 1
    for (const row of rows) row.push("")
  }

  const priceLookup = new Map<string, Array<{ price: number; calculatedRowIndex: number; pipelineName?: string }>>()
  const cityPriceLookup = new Map<string, Array<{ price: number; calculatedRowIndex: number; pipelineName?: string }>>()
  const areaLookup = new Map<string, Array<{ area: number; price: number; calculatedRowIndex: number; pipelineName?: string; amenityRequirementToken: string }>>()
  const traceByCsvRowIndex: Record<number, number> = {}
  const traceDetailsByCsvRowIndex: Record<number, {
    pipelineName: string
    price: string
    comboMapEntries: Array<{ key: string; value: string }>
  }> = {}
  let hasUnitAreaRows = false

  const areaBucketKey = (place: string) => place
  const appendLookup = (
    map: Map<string, Array<{ price: number; calculatedRowIndex: number; pipelineName?: string }>>,
    key: string,
    value: { price: number; calculatedRowIndex: number; pipelineName?: string }
  ) => {
    const next = map.get(key) ?? []
    next.push(value)
    map.set(key, next)
  }

  const addAreaCandidate = (bucket: string, area: number, price: number, calculatedRowIndex: number, amenityRequirementToken: string, pipelineName?: string) => {
    const next = areaLookup.get(bucket) ?? []
    next.push({ area, price, calculatedRowIndex, amenityRequirementToken, pipelineName })
    areaLookup.set(bucket, next)
  }

  for (let calculatedRowIndex = 0; calculatedRowIndex < calculatedRows.length; calculatedRowIndex++) {
    const calculatedRow = calculatedRows[calculatedRowIndex]
    if (typeof calculatedRow.price !== "number" || Number.isNaN(calculatedRow.price)) continue
    const rawLocation =
      calculatedRow.comboMap.client_location ??
      calculatedRow.comboMap.facility_location_city ??
      calculatedRow.comboMap.location ??
      calculatedRow.comboMap.city

    const locationKey = normalizeLocationKey(rawLocation)
    const location = locationKey || normalizeMatchValue(rawLocation)
    const city = normalizeCityValue(rawLocation)
    const cityKey = normalizeLocationKey(city)
    const dimensionToken = getDimensionLookupToken(calculatedRow.comboMap.unit_dimensions)
    const areaToken = getAreaLookupToken(calculatedRow.comboMap.unit_area)
    if (areaToken) hasUnitAreaRows = true
    const amenityRequirementToken = buildCalculatedAmenityRequirementToken(calculatedRow.comboMap as Record<string, unknown>)
    if (!location || (!dimensionToken && !areaToken)) continue
    const webPrice = applyConfiguredRounding(calculatedRow.price, webRounding)
    const price = webPrice
    const pipelineName = String((calculatedRow as Record<string, unknown>).__pipelineName ?? "")
    const pricedRow = { price, calculatedRowIndex, pipelineName }
    if (dimensionToken) {
      appendLookup(priceLookup, buildPriceLookupKey(location, dimensionToken, amenityRequirementToken || undefined), pricedRow)
      if (locationKey) appendLookup(priceLookup, buildPriceLookupKey(locationKey, dimensionToken, amenityRequirementToken || undefined), pricedRow)
      if (city) appendLookup(cityPriceLookup, buildPriceLookupKey(city, dimensionToken, amenityRequirementToken || undefined), pricedRow)
      if (cityKey) appendLookup(cityPriceLookup, buildPriceLookupKey(cityKey, dimensionToken, amenityRequirementToken || undefined), pricedRow)
    }
    if (areaToken) {
      appendLookup(priceLookup, buildPriceLookupKey(location, areaToken, amenityRequirementToken || undefined), pricedRow)
      if (locationKey) appendLookup(priceLookup, buildPriceLookupKey(locationKey, areaToken, amenityRequirementToken || undefined), pricedRow)
      if (city) appendLookup(cityPriceLookup, buildPriceLookupKey(city, areaToken, amenityRequirementToken || undefined), pricedRow)
      if (cityKey) appendLookup(cityPriceLookup, buildPriceLookupKey(cityKey, areaToken, amenityRequirementToken || undefined), pricedRow)

      const parsedArea = parseAreaTokenValue(areaToken)
      if (parsedArea !== null) {
        addAreaCandidate(areaBucketKey(location), parsedArea, price, calculatedRowIndex, amenityRequirementToken, pipelineName)
        if (locationKey) {
          addAreaCandidate(areaBucketKey(locationKey), parsedArea, price, calculatedRowIndex, amenityRequirementToken, pipelineName)
        }
        if (city) {
          addAreaCandidate(areaBucketKey(city), parsedArea, price, calculatedRowIndex, amenityRequirementToken, pipelineName)
        }
        if (cityKey) {
          addAreaCandidate(areaBucketKey(cityKey), parsedArea, price, calculatedRowIndex, amenityRequirementToken, pipelineName)
        }
      }
    }
  }

  if (priceLookup.size === 0) {
    throw new Error("No frontend price rows available. Make sure location and unit_dimensions or unit_area are combinatoric in the pipeline table.")
  }

  for (let csvRowIndex = 0; csvRowIndex < rows.length; csvRowIndex++) {
    const row = rows[csvRowIndex]
    const csvRow = rowToRecord(headers, row)
    type CandidateMapping = {
      pipelineName: string
      locationIndex: number
      unitSizeIndex: number
      areaIndex: number
      unitAmenitiesIndex: number
      dimensionMode: "full" | "first_two"
      locationMappings: LocationStringMapping[]
      groupColumnMappings?: MappingGroupColumnMapping[]
    }

    const candidates: CandidateMapping[] = []

    if (usingGroups) {
      for (const primaryGroup of mappingGroups) {
        const visitedGroupIds = new Set<string>()
        let activeGroup: MappingGroup | undefined = primaryGroup
        while (activeGroup && !visitedGroupIds.has(activeGroup.id)) {
          visitedGroupIds.add(activeGroup.id)
          const locationMapping = findGroupColumnMapping(activeGroup, "client_location")
          const dimensionMapping = findGroupColumnMapping(activeGroup, "unit_dimensions")
          const areaMapping = findGroupColumnMapping(activeGroup, "unit_area")
          const amenityMapping = findGroupColumnMapping(activeGroup, "unit_amenities")
          candidates.push({
            pipelineName: activeGroup.pipelineName,
            locationIndex: locationMapping?.csvColumn ? findColumnIndexByHeaderName(headers, locationMapping.csvColumn) : -1,
            unitSizeIndex: dimensionMapping?.csvColumn ? findColumnIndexByHeaderName(headers, dimensionMapping.csvColumn) : -1,
            areaIndex: areaMapping?.csvColumn ? findColumnIndexByHeaderName(headers, areaMapping.csvColumn) : -1,
            unitAmenitiesIndex: amenityMapping?.csvColumn ? findColumnIndexByHeaderName(headers, amenityMapping.csvColumn) : -1,
            dimensionMode: "first_two",
            locationMappings: [],
            groupColumnMappings: activeGroup.columnMappings,
          })
          activeGroup = activeGroup.fallbackGroupId ? getGroupById(activeGroup.fallbackGroupId) : undefined
        }
      }
    } else {
      const selectedPipelineName = (() => {
        for (const rule of mappingRules) {
          if (doesMappingRuleMatch(csvRow, rule)) return rule.pipelineName
        }
        return undefined
      })()
      if (!selectedPipelineName) continue
      const activeConfig = getPipelineConfig(selectedPipelineName)
      if (!activeConfig) continue
      candidates.push({
        pipelineName: selectedPipelineName,
        locationIndex: activeConfig.csvLocationColumn
          ? findColumnIndexByHeaderName(headers, activeConfig.csvLocationColumn)
          : defaultLocationIndex,
        unitSizeIndex: activeConfig.csvDimensionColumn
          ? findColumnIndexByHeaderName(headers, activeConfig.csvDimensionColumn)
          : defaultUnitSizeIndex,
        areaIndex: activeConfig.csvAreaColumn
          ? findColumnIndexByHeaderName(headers, activeConfig.csvAreaColumn)
          : defaultAreaIndex,
        unitAmenitiesIndex: activeConfig.csvAmenitiesColumn
          ? findColumnIndexByHeaderName(headers, activeConfig.csvAmenitiesColumn)
          : defaultUnitAmenitiesIndex,
        dimensionMode: activeConfig.dimensionMode,
        locationMappings: activeConfig.locationMappings ?? [],
      })
    }

    let mappedMatch: { price: number; calculatedRowIndex: number } | undefined
    let matchedAreaValue = ""
    let unitAmenitiesIndex = -1

    for (const candidate of candidates) {
      if (candidate.locationIndex < 0) continue
      if (!candidate.pipelineName.trim()) continue

      let candidateMatchedAreaValue = ""
      const baseLocation = getCellValue(row, candidate.locationIndex)
      const rawLocationValue = baseLocation
      const translatedLocationValue = translateCsvLocationValue(rawLocationValue, candidate.locationMappings)
      const location = normalizeLocationKey(translatedLocationValue)
      const locationKey = location
      const city = normalizeCityValue(translatedLocationValue)
      const cityKey = normalizeLocationKey(city)
      const dimensionToken = candidate.unitSizeIndex >= 0
        ? getDimensionLookupTokenByMode(getCellValue(row, candidate.unitSizeIndex), candidate.dimensionMode)
        : ""
      const areaToken = candidate.areaIndex >= 0 ? getAreaLookupToken(getCellValue(row, candidate.areaIndex)) : ""
      const amenitySubsets = candidate.unitAmenitiesIndex >= 0
        ? buildCsvAmenityTokenSubsets(getCellValue(row, candidate.unitAmenitiesIndex))
        : [""]
      const allowDimensionMatching = !hasUnitAreaRows

      let candidateMatch =
        (areaToken ? findLookupByAmenitySubsets(priceLookup, location, areaToken, amenitySubsets, candidate.pipelineName) : undefined) ??
        (areaToken && locationKey ? findLookupByAmenitySubsets(priceLookup, locationKey, areaToken, amenitySubsets, candidate.pipelineName) : undefined) ??
        (areaToken && city ? findLookupByAmenitySubsets(cityPriceLookup, city, areaToken, amenitySubsets, candidate.pipelineName) : undefined) ??
        (areaToken && cityKey ? findLookupByAmenitySubsets(cityPriceLookup, cityKey, areaToken, amenitySubsets, candidate.pipelineName) : undefined) ??
        (allowDimensionMatching && dimensionToken ? findLookupByAmenitySubsets(priceLookup, location, dimensionToken, amenitySubsets, candidate.pipelineName) : undefined) ??
        (allowDimensionMatching && dimensionToken && locationKey ? findLookupByAmenitySubsets(priceLookup, locationKey, dimensionToken, amenitySubsets, candidate.pipelineName) : undefined) ??
        (allowDimensionMatching && dimensionToken && city ? findLookupByAmenitySubsets(cityPriceLookup, city, dimensionToken, amenitySubsets, candidate.pipelineName) : undefined)
        ?? (allowDimensionMatching && dimensionToken && cityKey ? findLookupByAmenitySubsets(cityPriceLookup, cityKey, dimensionToken, amenitySubsets, candidate.pipelineName) : undefined)

      if (candidateMatch !== undefined && areaToken) {
        candidateMatchedAreaValue = areaToken.replace(/^area:/, "")
      }

      if (candidateMatch === undefined && areaToken) {
        const targetArea = parseAreaTokenValue(areaToken)
        if (targetArea !== null) {
          const candidateBuckets = [
            areaBucketKey(location),
            areaBucketKey(city),
          ]

          let best: { area: number; price: number; delta: number; calculatedRowIndex: number; pipelineName?: string } | null = null
          for (const bucket of candidateBuckets) {
            if (!bucket.startsWith("__")) {
              const areaCandidates = (areaLookup.get(bucket) ?? []) as Array<{ area: number; price: number; delta?: number; calculatedRowIndex: number; amenityRequirementToken?: string; pipelineName?: string }>
              for (const c of areaCandidates) {
                if (candidate.pipelineName && c.pipelineName !== candidate.pipelineName) continue
                if (!amenitySubsets.includes(c.amenityRequirementToken ?? "")) continue
                const delta = Math.abs(c.area - targetArea)
                if (delta > 3) continue
                if (!best || delta < best.delta) {
                  best = { area: c.area, price: c.price, delta, calculatedRowIndex: c.calculatedRowIndex, pipelineName: c.pipelineName }
                }
              }
              if (best && best.delta === 0) break
            }
          }

          if (best) {
            candidateMatch = { price: best.price, calculatedRowIndex: best.calculatedRowIndex }
            candidateMatchedAreaValue = Number.isInteger(best.area) ? String(Math.trunc(best.area)) : String(best.area)
          }
        }
      }

      if (candidateMatch !== undefined) {
        if (candidate.groupColumnMappings && candidate.groupColumnMappings.length > 0) {
          const tracedCandidateRow = calculatedRows[candidateMatch.calculatedRowIndex]
          const comboMap = (tracedCandidateRow?.comboMap ?? {}) as Record<string, unknown>

          const mappingPairsPass = candidate.groupColumnMappings.every((mapping) => {
            if (!Array.isArray(mapping.pairs) || mapping.pairs.length === 0) return true
            const csvRaw = String(getCsvValueByColumn(csvRow, mapping.csvColumn) ?? "")
            const pipelineRaw = getComboMapValueByColumn(comboMap, mapping.competitorColumn)
            return mapping.pairs.some((pair) => doesGroupMappingPairMatch(csvRaw, pipelineRaw, pair, mapping.competitorColumn))
          })

          if (!mappingPairsPass) {
            continue
          }
        }

        mappedMatch = candidateMatch
        matchedAreaValue = candidateMatchedAreaValue
        unitAmenitiesIndex = candidate.unitAmenitiesIndex
        break
      }
    }

    if (mappedMatch === undefined) continue

    const baseWebRate = mappedMatch.price
    const adjustedWebRate = applyPopupAdjustersToWebRate(baseWebRate, csvRow, popupAdjusters)
    let effectiveWebRate = Number.isFinite(adjustedWebRate) ? adjustedWebRate : baseWebRate

    const amenityTier = unitAmenitiesIndex >= 0
      ? resolveAmenityTier(getCellValue(row, unitAmenitiesIndex))
      : null
    const amenityConfig = amenityTier
      ? amenityAdjuster?.[amenityTier]
      : undefined

    if (amenityTier && amenityConfig && amenityAdjuster?.applyToWeb) {
      effectiveWebRate = applyAmenityAdjustment(effectiveWebRate, amenityConfig)
    }

    const roundedEffectiveWebRate = applyConfiguredRounding(effectiveWebRate, webRounding)
    const finalWebRate = formatCurrency(roundedEffectiveWebRate)
    const standardRateFallback = getCellValue(row, findColumnIndex(headers, CURRENT_STANDARD_RATE_COLUMNS))
    const standardRateValue = resolveStandardRateValue(roundedEffectiveWebRate, standardRateFunction)
    const roundedStandardRate = applyConfiguredRounding(standardRateValue, standardRounding)
    const standardRate = Number.isFinite(roundedStandardRate)
      ? formatCurrency(roundedStandardRate)
      : standardRateFallback
    row[newWebRateIndex] = finalWebRate
    row[newStandardRateIndex] = standardRate
    row[matchedUnitAreaIndex] = matchedAreaValue
    traceByCsvRowIndex[csvRowIndex] = mappedMatch.calculatedRowIndex
    const tracedRow = calculatedRows[mappedMatch.calculatedRowIndex]
    if (tracedRow) {
      const tracedPipelineName = String((tracedRow as Record<string, unknown>).__pipelineName ?? "").trim() || "Unknown pipeline"
      const comboMapEntries = Object.entries((tracedRow.comboMap ?? {}) as Record<string, unknown>)
        .map(([key, value]) => ({
          key,
          value: Array.isArray(value)
            ? value.map((item) => String(item)).join(", ")
            : String(value ?? ""),
        }))
      traceDetailsByCsvRowIndex[csvRowIndex] = {
        pipelineName: tracedPipelineName,
        price: formatCurrency(Number(tracedRow.price)),
        comboMapEntries,
      }
    }
  }

  return { headers, rows, traceByCsvRowIndex, traceDetailsByCsvRowIndex }
}

export function ProcessCsvButton({ snapshotId, filters, calculatedRows = [], calculatedRowsBundle, rounding, pricingContext, inline = false }: ProcessCsvButtonProps) {
  const [open, setOpen] = useState(false)
  const csvUploadInputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [reviewSortBy, setReviewSortBy] = useState<ReviewSortColumn>("rowIndex")
  const [reviewSortDir, setReviewSortDir] = useState<SortDirection>("asc")
  const [approvedChanges, setApprovedChanges] = useState<Record<string, boolean>>({})
  const [traceDialogRow, setTraceDialogRow] = useState<ReviewRow | null>(null)
  const [popupAdjusters, setPopupAdjusters] = useState<Adjuster[]>([])
  const [showLevels, setShowLevels] = useState(false)
  const [isSavingProcessConfig, setIsSavingProcessConfig] = useState(false)
  const [isLoadingProcessConfig, setIsLoadingProcessConfig] = useState(false)
  const [deletingProcessConfigId, setDeletingProcessConfigId] = useState<string | null>(null)
  const [overwritingProcessConfigId, setOverwritingProcessConfigId] = useState<string | null>(null)
  const [loadConfigOpen, setLoadConfigOpen] = useState(false)
  const [availableProcessConfigs, setAvailableProcessConfigs] = useState<ProcessCsvConfiguration[]>([])
  const [standardRateOpen, setStandardRateOpen] = useState(false)
  const [standardRateFunction, setStandardRateFunction] = useState(DEFAULT_STANDARD_RATE_FUNCTION)
  const [standardRateRoundingEnabled, setStandardRateRoundingEnabled] = useState(
    Boolean(rounding?.standard?.enabled ?? false)
  )
  const [standardRateRoundingOffset, setStandardRateRoundingOffset] = useState(
    Number(rounding?.standard?.offset ?? 0)
  )
  const [standardRateRoundingOffsetInput, setStandardRateRoundingOffsetInput] = useState(
    String(Number(rounding?.standard?.offset ?? 0))
  )
  const [standardRateZoomX, setStandardRateZoomX] = useState(1)
  const [standardRateZoomY, setStandardRateZoomY] = useState(1)
  const [standardRatePanX, setStandardRatePanX] = useState(0)
  const [standardRatePanY, setStandardRatePanY] = useState(0)
  const standardRateDragRef = useRef<{ x: number; y: number } | null>(null)
  const [amenityAdjuster, setAmenityAdjuster] = useState<AmenityAdjusterState>(createDefaultAmenityAdjusterState)
  const [originalParsed, setOriginalParsed] = useState<ParsedCsv | null>(null)
  const [csvNumericVariables, setCsvNumericVariables] = useState<string[]>([])
  const lastAutoRebuildKeyRef = useRef<string>("")
  const [showMapping, setShowMapping] = useState(false)
  const [mappingRules, setMappingRules] = useState<PipelineMappingRule[]>([])
  const [pipelineMappingConfigs, setPipelineMappingConfigs] = useState<PipelineMappingConfig[]>([])
  const [mappingGroups, setMappingGroups] = useState<MappingGroup[]>([])
  const [selectedMappingGroupId, setSelectedMappingGroupId] = useState("")

  const functionDialog = useAdjusterDialog()
  const showLevelsAdjusterPreview = useMemo(() => hasConfiguredLevelsAdjuster(amenityAdjuster), [amenityAdjuster])
  const totalProcessAdjusterSteps = popupAdjusters.length + (showLevelsAdjusterPreview ? 1 : 0)
  const mappingPipelineNames = useMemo(
    () => Array.from(new Set((calculatedRowsBundle ?? []).map((entry) => entry.pipelineName).filter(Boolean))),
    [calculatedRowsBundle]
  )

  const createDefaultPipelineMappingConfig = useCallback((pipelineName: string): PipelineMappingConfig => ({
    pipelineName,
    csvLocationColumn: "",
    csvDimensionColumn: "",
    csvAreaColumn: "",
    csvAmenitiesColumn: "",
    dimensionMode: "first_two",
    locationMappings: [],
    fallbackPipelineName: "",
  }), [])

  useEffect(() => {
    if (mappingPipelineNames.length === 0) {
      setPipelineMappingConfigs([])
      return
    }

    setPipelineMappingConfigs((prev) => {
      const byName = new Map(prev.map((cfg) => [cfg.pipelineName, cfg]))
      return mappingPipelineNames.map((name) => byName.get(name) ?? createDefaultPipelineMappingConfig(name))
    })
  }, [createDefaultPipelineMappingConfig, mappingPipelineNames])

  const selectedMappingGroup = useMemo(
    () => mappingGroups.find((group) => group.id === selectedMappingGroupId) ?? null,
    [mappingGroups, selectedMappingGroupId]
  )

  const createDefaultMappingGroup = useCallback((index: number): MappingGroup => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return {
      id,
      name: `Group ${index + 1}`,
      pipelineName: mappingPipelineNames[0] ?? "",
      fallbackGroupId: "",
      dimensionMode: "first_two",
      columnMappings: [],
    }
  }, [mappingPipelineNames])

  useEffect(() => {
    if (mappingPipelineNames.length === 0) return
    const defaultPipeline = mappingPipelineNames[0]
    setMappingGroups((prev) => prev.map((group) => (
      group.pipelineName.trim()
        ? group
        : { ...group, pipelineName: defaultPipeline }
    )))
  }, [mappingPipelineNames])

  useEffect(() => {
    if (mappingGroups.length === 0) {
      setSelectedMappingGroupId("")
      return
    }
    setSelectedMappingGroupId((prev) => (prev && mappingGroups.some((group) => group.id === prev) ? prev : mappingGroups[0].id))
  }, [mappingGroups])


  const addMappingGroup = useCallback(() => {
    setMappingGroups((prev) => {
      const nextGroup = createDefaultMappingGroup(prev.length)
      return [...prev, nextGroup]
    })
  }, [createDefaultMappingGroup])

  const removeMappingGroup = useCallback((groupId: string) => {
    setMappingGroups((prev) => prev
      .filter((group) => group.id !== groupId)
      .map((group) => (group.fallbackGroupId === groupId ? { ...group, fallbackGroupId: "" } : group))
    )
  }, [])

  const updateMappingGroup = useCallback((groupId: string, patch: Partial<MappingGroup>) => {
    setMappingGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, ...patch } : group)))
  }, [])

  const addGroupColumnMapping = useCallback((groupId: string) => {
    setMappingGroups((prev) => prev.map((group) => {
      if (group.id !== groupId) return group
      return {
        ...group,
        columnMappings: [
          ...group.columnMappings,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            csvColumn: "",
            competitorColumn: "",
            pairs: [],
          },
        ],
      }
    }))
  }, [])

  const updateGroupColumnMapping = useCallback((groupId: string, mappingId: string, patch: Partial<MappingGroupColumnMapping>) => {
    setMappingGroups((prev) => prev.map((group) => {
      if (group.id !== groupId) return group
      return {
        ...group,
        columnMappings: group.columnMappings.map((mapping) => (mapping.id === mappingId ? { ...mapping, ...patch } : mapping)),
      }
    }))
  }, [])

  const removeGroupColumnMapping = useCallback((groupId: string, mappingId: string) => {
    setMappingGroups((prev) => prev.map((group) => {
      if (group.id !== groupId) return group
      return {
        ...group,
        columnMappings: group.columnMappings.filter((mapping) => mapping.id !== mappingId),
      }
    }))
  }, [])

  const addGroupColumnMappingPair = useCallback((groupId: string, mappingId: string) => {
    setMappingGroups((prev) => prev.map((group) => {
      if (group.id !== groupId) return group
      return {
        ...group,
        columnMappings: group.columnMappings.map((mapping) => {
          if (mapping.id !== mappingId) return mapping
          return {
            ...mapping,
            pairs: [
              ...mapping.pairs,
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                csvValue: "",
                pipelineValue: "",
                exactMatch: false,
                csvFirstTwoDimensions: false,
              },
            ],
          }
        }),
      }
    }))
  }, [])

  const updateGroupColumnMappingPair = useCallback((groupId: string, mappingId: string, pairId: string, patch: Partial<MappingGroupPair>) => {
    setMappingGroups((prev) => prev.map((group) => {
      if (group.id !== groupId) return group
      return {
        ...group,
        columnMappings: group.columnMappings.map((mapping) => {
          if (mapping.id !== mappingId) return mapping
          return {
            ...mapping,
            pairs: mapping.pairs.map((pair) => (pair.id === pairId ? { ...pair, ...patch } : pair)),
          }
        }),
      }
    }))
  }, [])

  const removeGroupColumnMappingPair = useCallback((groupId: string, mappingId: string, pairId: string) => {
    setMappingGroups((prev) => prev.map((group) => {
      if (group.id !== groupId) return group
      return {
        ...group,
        columnMappings: group.columnMappings.map((mapping) => {
          if (mapping.id !== mappingId) return mapping
          return {
            ...mapping,
            pairs: mapping.pairs.filter((pair) => pair.id !== pairId),
          }
        }),
      }
    }))
  }, [])

  const resolvedCalculatedRows = useMemo<ResolvedCalculatedRows>(() => {
    const bundle = calculatedRowsBundle
    if (!bundle || bundle.length === 0) {
      return { rows: calculatedRows, error: null }
    }

    const merged: CalculatedPriceRow[] = []

    for (const entry of bundle) {
      const pipelineName = entry.pipelineName || "Unnamed pipeline"
      for (const row of entry.rows ?? []) {
        if (typeof row?.price !== "number" || Number.isNaN(row.price)) continue

        const location = normalizeMatchValue(row.comboMap.client_location)
        const dimensionToken = getDimensionLookupToken(row.comboMap.unit_dimensions)
        const areaToken = getAreaLookupToken(row.comboMap.unit_area)

        const keyToken = areaToken || dimensionToken
        if (!location || !keyToken) continue
        merged.push({ ...row, __pipelineName: pipelineName } as CalculatedPriceRow)
      }
    }

    return { rows: merged, error: null }
  }, [calculatedRows, calculatedRowsBundle])

  const resolvedAmenityAdjuster = useMemo<ResolvedAmenityAdjuster>(() => {
    const parseEntry = (entry: AmenityAdjusterEntry) => {
      const m = Number(entry.multiplier.trim());
      const o = Number(entry.offset.trim());
      if (!Number.isFinite(m) && !Number.isFinite(o)) return undefined;
      return {
        multiplier: Number.isFinite(m) ? m : 1,
        offset: Number.isFinite(o) ? o : 0,
      };
    };
    return {
      applyToWeb: amenityAdjuster.applyToWeb,
      premium: parseEntry(amenityAdjuster.premium),
      standard: parseEntry(amenityAdjuster.standard),
      economy: parseEntry(amenityAdjuster.economy),
    };
  }, [amenityAdjuster]);

  useEffect(() => {
    const nextEnabled = Boolean(rounding?.standard?.enabled ?? false)
    const rawOffset = Number(rounding?.standard?.offset ?? 0)
    const nextOffset = Number.isFinite(rawOffset) ? rawOffset : 0
    setStandardRateRoundingEnabled(nextEnabled)
    setStandardRateRoundingOffset(nextOffset)
  }, [rounding?.enabled, rounding?.offset, rounding?.standard?.enabled, rounding?.standard?.offset])

  useEffect(() => {
    setStandardRateRoundingOffsetInput(String(standardRateRoundingOffset))
  }, [standardRateRoundingOffset])

  const handleStandardRateRoundingOffsetChange = (value: string) => {
    setStandardRateRoundingOffsetInput(value)
    const sanitized = value.replace(/[^0-9.]/g, "")
    if (sanitized === "" || sanitized === ".") return
    const next = Number(sanitized)
    if (Number.isNaN(next)) return
    const clamped = Math.min(1, Math.max(0, next))
    setStandardRateRoundingOffset(clamped)
  }

  const effectiveRounding = useMemo(() => {
    const baseEnabled = Boolean(rounding?.enabled)
    const baseOffsetRaw = Number(rounding?.offset ?? 0)
    const baseOffset = Number.isFinite(baseOffsetRaw) ? baseOffsetRaw : 0
    return {
      enabled: baseEnabled,
      offset: baseOffset,
      standard: {
        enabled: standardRateRoundingEnabled,
        offset: standardRateRoundingOffset,
      },
    }
  }, [rounding?.enabled, rounding?.offset, standardRateRoundingEnabled, standardRateRoundingOffset])

  const standardRateChart = useMemo(() => {
    const baseMinX = 20
    const baseMaxX = 300
    const svgWidth = 520
    const svgHeight = 340
    const margin = { top: 24, right: 24, bottom: 52, left: 64 }

    const centerX = (baseMinX + baseMaxX) / 2 + standardRatePanX
    const spanX = (baseMaxX - baseMinX) / Math.max(0.5, standardRateZoomX)
    const minX = centerX - spanX / 2
    const maxX = centerX + spanX / 2

    const xs = Array.from({ length: 80 }, (_, i) => minX + ((maxX - minX) * i) / 79)
    const ysRaw = xs.map((x) => resolveStandardRateValue(x, standardRateFunction)).filter((v) => Number.isFinite(v)) as number[]
    const rawMinY = ysRaw.length ? Math.min(...ysRaw) : 0
    const rawMaxY = ysRaw.length ? Math.max(...ysRaw) : 1
    const paddedMinY = rawMinY - (rawMaxY - rawMinY) * 0.1
    const paddedMaxY = rawMaxY + (rawMaxY - rawMinY) * 0.1
    const centerY = (paddedMinY + paddedMaxY) / 2 + standardRatePanY
    const spanY = (paddedMaxY - paddedMinY || 1) / Math.max(0.5, standardRateZoomY)
    const minY = centerY - spanY / 2
    const maxY = centerY + spanY / 2

    const plotWidth = svgWidth - margin.left - margin.right
    const plotHeight = svgHeight - margin.top - margin.bottom

    const scaleX = (x: number) => margin.left + ((x - minX) / (maxX - minX || 1)) * plotWidth
    const scaleY = (y: number) => margin.top + plotHeight - ((y - minY) / (maxY - minY || 1)) * plotHeight

    const path = xs
      .map((x, i) => {
        const y = resolveStandardRateValue(x, standardRateFunction)
        const px = scaleX(x)
        const py = scaleY(y)
        return `${i === 0 ? "M" : "L"} ${px.toFixed(2)} ${py.toFixed(2)}`
      })
      .join(" ")

    const pickStep = (range: number) => {
      const rough = range / 6
      const pow = Math.pow(10, Math.floor(Math.log10(rough)))
      const steps = [1, 2, 5, 10]
      const scaled = steps.map((s) => s * pow)
      return scaled.find((s) => s >= rough) ?? scaled[scaled.length - 1]
    }

    const xStep = pickStep(maxX - minX)
    const yStep = pickStep(maxY - minY)

    const buildTicks = (min: number, max: number, step: number) => {
      const start = Math.ceil(min / step) * step
      const ticks: number[] = []
      for (let v = start; v <= max + step * 0.5; v += step) {
        ticks.push(Number(v.toFixed(2)))
      }
      return ticks
    }

    const xTicks = buildTicks(minX, maxX, xStep)
    const yTicks = buildTicks(minY, maxY, yStep)

    const formatTick = (value: number) => `$${Math.round(value).toLocaleString()}`

    const breakpoints = [100, 200]
      .filter((x) => x >= minX && x <= maxX)
      .map((x) => ({ value: x, x: scaleX(x) }))

    return {
      svgWidth,
      svgHeight,
      margin,
      plotWidth,
      plotHeight,
      minX,
      maxX,
      minY,
      maxY,
      spanX,
      spanY,
      path,
      xTicks: xTicks.map((value) => ({ value, x: scaleX(value), label: formatTick(value) })),
      yTicks: yTicks.map((value) => ({ value, y: scaleY(value), label: formatTick(value) })),
      breakpoints,
    }
  }, [standardRateFunction, standardRateZoomX, standardRateZoomY, standardRatePanX, standardRatePanY])


  // Validate allowed filters
  // Strictly Allowed:
  // - unit_dimensions: "Unit Dimensions"
  // - client_location: "Facility Location"
  // - competitor_name: "Competitor Name"
  // - has_drive_up_access: optional match via CSV Unit Amenities
  // All other filters must be empty.

  const allowedKeys = new Set(["unit_dimensions", "client_location", "competitor_name", "has_drive_up_access"]);
  allowedKeys.add("unit_area");
  
  // NOTE: 'competitors', 'locations', 'unitCategories' are standard legacy keys.
  // 'locations' is legacy client_location.
  // 'client_location' is expected to be passed if used.
  
  const hasInvalidFilters = Object.entries(filters).some(([key, values]) => {
      // If values is empty, it's fine (filter not active)
      if (!Array.isArray(values) || values.length === 0) return false;
      
      // If active, it must be in allowedKeys
      // Exceptions: 
      // - "locations" maps to legacy logic, but usually we prefer facility_location_city now.
      // - "competitors" usually filtered out for CSV logic unless explicit requirement.
      // User said: "Utilicen filtros (columnas) que no estén en el csv del cliente" -> only City and Dimensions match CSV schema.
      return !allowedKeys.has(key);
  });

  const resetDialogState = () => {
    setOpen(false)
    setFile(null)
    setIsProcessing(false)
    setReviewData(null)
    setApprovedChanges({})
    setTraceDialogRow(null)
    setPopupAdjusters([])
    setAmenityAdjuster(createDefaultAmenityAdjusterState())
    setMappingRules([])
    setMappingGroups([])
    setPipelineMappingConfigs(mappingPipelineNames.map((name) => createDefaultPipelineMappingConfig(name)))
    setOriginalParsed(null)
    setCsvNumericVariables([])
    lastAutoRebuildKeyRef.current = ""
  }

  const buildDefaultApprovals = (changes: CsvRateChange[]) => {
    const approvals: Record<string, boolean> = {}
    for (const change of changes) approvals[change.id] = true
    return approvals
  }

  const openTraceDialog = (row: ReviewRow) => {
    if (!row.traceDetails) return
    setTraceDialogRow(row)
  }

  const rebuildReviewFromOriginal = useCallback((original: ParsedCsv, nextAdjusters: Adjuster[]) => {
    if (resolvedCalculatedRows.error) {
      throw new Error(resolvedCalculatedRows.error)
    }
    const processed = applyCalculatedPricesToCsv(
      original,
      resolvedCalculatedRows.rows,
      effectiveRounding,
      nextAdjusters,
      resolvedAmenityAdjuster,
      standardRateFunction,
      mappingRules,
      pipelineMappingConfigs,
      mappingGroups,
    )
    const headers = processed.headers.length ? processed.headers : original.headers
    const changes = buildChanges(original, processed)
    const reviewRows = buildReviewRows(original, processed, changes, processed.traceByCsvRowIndex, processed.traceDetailsByCsvRowIndex)
    const nextReviewData: ReviewData = {
      fileName: file?.name ?? "client.csv",
      headers,
      originalRows: original.rows,
      processedRows: processed.rows,
      changes,
      reviewRows,
    }
    setReviewData(nextReviewData)
    setApprovedChanges(buildDefaultApprovals(changes))
    setTraceDialogRow(null)
  }, [
    file?.name,
    resolvedCalculatedRows.error,
    resolvedCalculatedRows.rows,
    effectiveRounding,
    resolvedAmenityAdjuster,
    standardRateFunction,
    mappingRules,
    pipelineMappingConfigs,
    mappingGroups,
  ])

  const handleAddPopupAdjuster = (adjuster: Adjuster) => {
    setPopupAdjusters((prev: Adjuster[]) => {
      const next = [...prev, adjuster]
      if (originalParsed) {
        try {
          rebuildReviewFromOriginal(originalParsed, next)
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to apply popup adjuster")
        }
      }
      return next
    })
  }

  const handleRemovePopupAdjuster = (index: number) => {
    setPopupAdjusters((prev: Adjuster[]) => {
      const next = prev.filter((_: Adjuster, i: number) => i !== index)
      if (originalParsed) {
        try {
          rebuildReviewFromOriginal(originalParsed, next)
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to apply popup adjuster")
        }
      }
      return next
    })
  }

  const handleRemoveLevelsAdjuster = () => {
    setAmenityAdjuster(createDefaultAmenityAdjusterState())
  }

  const handleClearProcessCsvConfig = () => {
    setPopupAdjusters([])
    setAmenityAdjuster(createDefaultAmenityAdjusterState())
    setMappingRules([])
    setMappingGroups([])
    setPipelineMappingConfigs(mappingPipelineNames.map((name) => createDefaultPipelineMappingConfig(name)))
    setStandardRateFunction(DEFAULT_STANDARD_RATE_FUNCTION)
    setStandardRateRoundingEnabled(false)
    setStandardRateRoundingOffset(0)
    setStandardRateRoundingOffsetInput("0")
    lastAutoRebuildKeyRef.current = ""
    toast.success("Process CSV configuration reset.")
  }

  const autoRebuildKey = useMemo(() => {
    const mappingKey = mappingRules
      .map((r) => `${r.pipelineName}|${r.column}|${r.operator}|${r.value}`)
      .join("||")
    const pipelineMappingKey = pipelineMappingConfigs
      .map((cfg) => [
        cfg.pipelineName,
        cfg.csvLocationColumn,
        cfg.csvDimensionColumn,
        cfg.csvAreaColumn,
        cfg.csvAmenitiesColumn,
        cfg.dimensionMode,
        cfg.fallbackPipelineName,
        cfg.locationMappings.map((m) => `${m.csvValue}=>${m.pipelineValue}`).join("@@"),
      ].join("|"))
      .join("||")
    const mappingGroupKey = mappingGroups
      .map((group) => [
        group.id,
        group.name,
        group.pipelineName,
        group.fallbackGroupId,
        group.dimensionMode,
        group.columnMappings
          .map((mapping) => `${mapping.csvColumn}|${mapping.competitorColumn}|${mapping.pairs.map((pair) => `${pair.csvValue}=>${pair.pipelineValue}|${pair.exactMatch ? "1" : "0"}|${pair.csvFirstTwoDimensions ? "1" : "0"}`).join("##")}`)
          .join("@@"),
      ].join("|"))
      .join("||")
    const amenityKey = [
      amenityAdjuster.applyToWeb ? "1" : "0",
      amenityAdjuster.premium.multiplier,
      amenityAdjuster.premium.offset,
      amenityAdjuster.standard.multiplier,
      amenityAdjuster.standard.offset,
      amenityAdjuster.economy.multiplier,
      amenityAdjuster.economy.offset,
    ].join("|")

    return [
      originalParsed ? "1" : "0",
      popupAdjusters.length,
      amenityKey,
      standardRateFunction,
      standardRateRoundingEnabled ? "1" : "0",
      standardRateRoundingOffset,
      resolvedCalculatedRows.error ?? "",
      resolvedCalculatedRows.rows.length,
      mappingKey,
      pipelineMappingKey,
      mappingGroupKey,
    ].join("::")
  }, [
    amenityAdjuster,
    mappingRules,
    pipelineMappingConfigs,
    mappingGroups,
    originalParsed,
    popupAdjusters.length,
    resolvedCalculatedRows.error,
    resolvedCalculatedRows.rows.length,
    standardRateFunction,
    standardRateRoundingEnabled,
    standardRateRoundingOffset,
  ])

  useEffect(() => {
    if (!originalParsed) return
    if (lastAutoRebuildKeyRef.current === autoRebuildKey) return
    lastAutoRebuildKeyRef.current = autoRebuildKey
    try {
      rebuildReviewFromOriginal(originalParsed, popupAdjusters)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to apply adjustments")
    }
  }, [autoRebuildKey, originalParsed, popupAdjusters, rebuildReviewFromOriginal])

  const handleStandardRateDragStart = (x: number, y: number) => {
    standardRateDragRef.current = { x, y }
  }

  const handleStandardRateDragMove = (x: number, y: number) => {
    const last = standardRateDragRef.current
    if (!last) return
    const dx = x - last.x
    const dy = y - last.y
    standardRateDragRef.current = { x, y }

    if (!standardRateChart.plotWidth || !standardRateChart.plotHeight) return
    const deltaX = -(dx / standardRateChart.plotWidth) * standardRateChart.spanX
    const deltaY = (dy / standardRateChart.plotHeight) * standardRateChart.spanY
    setStandardRatePanX((prev) => prev + deltaX)
    setStandardRatePanY((prev) => prev + deltaY)
  }

  const handleStandardRateDragEnd = () => {
    standardRateDragRef.current = null
  }

  const applyLoadedProcessCsvConfig = (config: ProcessCsvConfiguration) => {
    const formula = String(config.standard_rate_formula ?? "").trim()
    const roundingEnabled = Boolean(config.standard_rate_rounding?.enabled)
    const rawOffset = Number(config.standard_rate_rounding?.offset ?? 0)
    const roundingOffset = Number.isFinite(rawOffset)
      ? Math.min(1, Math.max(0, rawOffset))
      : 0

    setStandardRateFunction(formula || DEFAULT_STANDARD_RATE_FUNCTION)
    setStandardRateRoundingEnabled(roundingEnabled)
    setStandardRateRoundingOffset(roundingOffset)
    setStandardRateRoundingOffsetInput(String(roundingOffset))

    const nextAdjusters = Array.isArray(config.competitive_adjusters)
      ? config.competitive_adjusters
      : []
    setPopupAdjusters(nextAdjusters)

    const levels = config.levels_adjuster
    const toEntry = (entry?: { multiplier?: number; offset?: number }): AmenityAdjusterEntry => {
      const multiplier = Number(entry?.multiplier)
      const offset = Number(entry?.offset)
      return {
        multiplier: Number.isFinite(multiplier) ? String(multiplier) : "1",
        offset: Number.isFinite(offset) ? String(offset) : "0",
      }
    }

    setAmenityAdjuster({
      applyToWeb: Boolean(levels?.apply_to_web ?? true),
      premium: toEntry(levels?.premium),
      standard: toEntry(levels?.standard),
      economy: toEntry(levels?.economy),
    })

    const loadedRulesRaw = (config as ProcessCsvConfiguration & { mapping_rules?: unknown }).mapping_rules
    const loadedRules = Array.isArray(loadedRulesRaw)
      ? loadedRulesRaw
          .map((item) => item as Partial<PipelineMappingRule>)
          .filter((item) => item && typeof item.pipelineName === "string")
          .map((item) => ({
            id: String(item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
            pipelineName: String(item.pipelineName ?? ""),
            column: String(item.column ?? ""),
            operator: (String(item.operator ?? "contains") as MappingOperator),
            value: String(item.value ?? ""),
          }))
      : []
    setMappingRules(loadedRules)

    const loadedPipelineMappingsRaw = (config as ProcessCsvConfiguration & { pipeline_mappings?: unknown }).pipeline_mappings
    if (Array.isArray(loadedPipelineMappingsRaw)) {
      const normalized = loadedPipelineMappingsRaw
        .map((item) => item as Partial<PipelineMappingConfig>)
        .filter((item) => item && typeof item.pipelineName === "string")
        .map((item) => ({
          pipelineName: String(item.pipelineName ?? ""),
          csvLocationColumn: String(item.csvLocationColumn ?? ""),
          csvDimensionColumn: String(item.csvDimensionColumn ?? ""),
          csvAreaColumn: String(item.csvAreaColumn ?? ""),
          csvAmenitiesColumn: String(item.csvAmenitiesColumn ?? ""),
          dimensionMode: (item.dimensionMode === "full" ? "full" : "first_two") as "full" | "first_two",
          fallbackPipelineName: String(item.fallbackPipelineName ?? ""),
          locationMappings: Array.isArray(item.locationMappings)
            ? item.locationMappings
                .map((lm) => lm as Partial<LocationStringMapping>)
                .map((lm) => ({
                  id: String(lm.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
                  csvValue: String(lm.csvValue ?? ""),
                  pipelineValue: String(lm.pipelineValue ?? ""),
                }))
            : [],
        }))
      setPipelineMappingConfigs(normalized)
    } else {
      setPipelineMappingConfigs(mappingPipelineNames.map((name) => createDefaultPipelineMappingConfig(name)))
    }

    const loadedGroupsRaw = (config as ProcessCsvConfiguration & { mapping_groups?: unknown }).mapping_groups
    const loadedGroups = Array.isArray(loadedGroupsRaw)
        ? loadedGroupsRaw
          .map((item) => item as unknown as Partial<MappingGroup>)
          .filter((item) => item && typeof item.id === "string")
          .map((item) => ({
            id: String(item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
            name: String(item.name ?? ""),
            pipelineName: String((item as Record<string, unknown>).pipelineName ?? (item as Record<string, unknown>).pipeline ?? mappingPipelineNames[0] ?? ""),
            fallbackGroupId: String(item.fallbackGroupId ?? ""),
            dimensionMode: (item.dimensionMode === "full" ? "full" : "first_two") as "full" | "first_two",
            columnMappings: Array.isArray(item.columnMappings)
              ? item.columnMappings
                  .map((mapping) => mapping as Partial<MappingGroupColumnMapping> & { pairs?: unknown })
                  .map((mapping) => ({
                    id: String(mapping.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
                    csvColumn: String(mapping.csvColumn ?? ""),
                    competitorColumn: String(mapping.competitorColumn ?? "") as MappingGroupCompetitorColumn,
                    pairs: Array.isArray(mapping.pairs)
                      ? mapping.pairs
                          .map((pair) => pair as Partial<MappingGroupPair>)
                          .map((pair) => ({
                            id: String(pair.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
                            csvValue: String(pair.csvValue ?? ""),
                            pipelineValue: String(pair.pipelineValue ?? ""),
                            exactMatch: Boolean(pair.exactMatch),
                            csvFirstTwoDimensions: Boolean(pair.csvFirstTwoDimensions),
                          }))
                      : [],
                  }))
              : [],
          }))
      : []
    setMappingGroups(loadedGroups)
  }

  useEffect(() => {
    if (!loadConfigOpen) return

    let cancelled = false

    const loadConfigurations = async () => {
      setIsLoadingProcessConfig(true)
      try {
        const scopedResponse = await listProcessCsvConfigurations(snapshotId)
        let configurations = Array.isArray(scopedResponse?.configurations) ? scopedResponse.configurations : []

        if (configurations.length === 0) {
          const allResponse = await listProcessCsvConfigurations()
          configurations = Array.isArray(allResponse?.configurations) ? allResponse.configurations : []
        }

        if (!cancelled) {
          setAvailableProcessConfigs(configurations)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load Process CSV configurations")
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProcessConfig(false)
        }
      }
    }

    void loadConfigurations()

    return () => {
      cancelled = true
    }
  }, [loadConfigOpen, snapshotId])

  const handleSelectProcessCsvConfig = (selected: ProcessCsvConfiguration) => {
    applyLoadedProcessCsvConfig(selected)
    setLoadConfigOpen(false)
    toast.success(`Loaded Process CSV configuration: ${selected.name}`)
  }

  const handleDeleteProcessCsvConfig = async (config: ProcessCsvConfiguration) => {
    if (!config?.id) {
      toast.error("This configuration cannot be deleted because it has no id.")
      return
    }

    const confirmed = window.confirm(`Delete Process CSV configuration \"${config.name || "Unnamed configuration"}\"?`)
    if (!confirmed) return

    setDeletingProcessConfigId(config.id)
    try {
      await deleteProcessCsvConfiguration(config.id)
      setAvailableProcessConfigs((prev) => prev.filter((item) => item.id !== config.id))
      toast.success("Process CSV configuration deleted.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete Process CSV configuration")
    } finally {
      setDeletingProcessConfigId(null)
    }
  }

  const handleOverwriteProcessCsvConfig = async (config: ProcessCsvConfiguration) => {
    const targetName = String(config.name ?? "").trim() || "Unnamed configuration"
    const confirmed = window.confirm(`Overwrite Process CSV configuration "${targetName}" with current settings?`)
    if (!confirmed) return

    setOverwritingProcessConfigId(config.id ?? targetName)
    setIsSavingProcessConfig(true)
    try {
      if (config.id) {
        await deleteProcessCsvConfiguration(config.id)
      }
      await saveProcessCsvConfigurationByName(targetName)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to overwrite Process CSV configuration")
    } finally {
      setOverwritingProcessConfigId(null)
      setIsSavingProcessConfig(false)
    }
  }

  const saveProcessCsvConfigurationByName = useCallback(async (name: string, options?: { silent?: boolean }) => {
    const standardOffsetRaw = Number(standardRateRoundingOffset)
    const standardOffset = Number.isFinite(standardOffsetRaw)
      ? Math.min(1, Math.max(0, standardOffsetRaw))
      : 0

    await saveProcessCsvConfiguration({
      name,
      snapshot_id: snapshotId,
      standard_rate_formula: standardRateFunction,
      standard_rate_rounding: {
        enabled: standardRateRoundingEnabled,
        offset: standardOffset,
      },
      competitive_adjusters: popupAdjusters,
      levels_adjuster: {
        apply_to_web: Boolean(resolvedAmenityAdjuster.applyToWeb),
        premium: resolvedAmenityAdjuster.premium,
        standard: resolvedAmenityAdjuster.standard,
        economy: resolvedAmenityAdjuster.economy,
      },
      mapping_rules: mappingRules,
      pipeline_mappings: pipelineMappingConfigs,
      mapping_groups: mappingGroups,
    })

    const refreshed = await listProcessCsvConfigurations(snapshotId)
    setAvailableProcessConfigs(Array.isArray(refreshed?.configurations) ? refreshed.configurations : [])

    if (!options?.silent) {
      toast.success("Process CSV configuration saved.")
    }
  }, [
    mappingGroups,
    mappingRules,
    pipelineMappingConfigs,
    popupAdjusters,
    resolvedAmenityAdjuster,
    snapshotId,
    standardRateFunction,
    standardRateRoundingEnabled,
    standardRateRoundingOffset,
  ])

  const handleSaveProcessCsvConfig = async () => {
    const defaultName = `process-csv-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}`
    const inputName = window.prompt("Name this Process CSV configuration", defaultName)
    const name = inputName?.trim()
    if (!name) return

    setIsSavingProcessConfig(true)
    try {
      await saveProcessCsvConfigurationByName(name)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save Process CSV configuration")
    } finally {
      setIsSavingProcessConfig(false)
    }
  }

  const handleMappingDialogOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      setShowMapping(true)
      return
    }

    setShowMapping(false)
  }, [])

  const handleCsvFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null
    setFile(nextFile)
    setReviewData(null)
    setApprovedChanges({})
    setTraceDialogRow(null)
  }

  const handleProcess = async () => {
    if (!file) return

    if (resolvedCalculatedRows.error) {
      toast.error(resolvedCalculatedRows.error)
      return
    }

    setIsProcessing(true)
    try {
      const originalText = await file.text()
      const original = toParsedCsv(originalText)
      setOriginalParsed(original)
      setCsvNumericVariables(detectNumericCsvColumns(original))
      const processed = applyCalculatedPricesToCsv(
        original,
        resolvedCalculatedRows.rows,
        effectiveRounding,
        popupAdjusters,
        resolvedAmenityAdjuster,
        standardRateFunction,
        mappingRules,
        pipelineMappingConfigs,
        mappingGroups,
      )

      if (original.headers.length === 0 || processed.headers.length === 0) {
        throw new Error("CSV appears empty or invalid. Please check the input file.")
      }

      const headers = processed.headers.length ? processed.headers : original.headers
      const changes = buildChanges(original, processed)
      const reviewRowsWithTrace = buildReviewRows(original, processed, changes, processed.traceByCsvRowIndex, processed.traceDetailsByCsvRowIndex)
      const nextReviewData: ReviewData = {
        fileName: file.name,
        headers,
        originalRows: original.rows,
        processedRows: processed.rows,
        changes,
        reviewRows: reviewRowsWithTrace,
      }

      setApprovedChanges(buildDefaultApprovals(changes))
      setTraceDialogRow(null)
      setReviewData(nextReviewData)
      toast.success("Current pipeline pricing applied in the browser. Review changes before download.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to process CSV"
      toast.error(message)
    } finally {
      setIsProcessing(false)
    }
  }

  const setChangeApproval = (id: string, approved: boolean) => {
    setApprovedChanges((prev: Record<string, boolean>) => ({ ...prev, [id]: approved }))
  }

  const setAllApprovals = (approved: boolean) => {
    if (!reviewData) return
    const next: Record<string, boolean> = {}
    for (const change of reviewData.changes) {
      next[change.id] = approved
    }
    setApprovedChanges(next)
  }

  const handleDownloadApproved = () => {
    if (!reviewData) return

    const mergedRows = reviewData.processedRows.map((row: string[]) => [...row])
    for (const change of reviewData.changes) {
      if (approvedChanges[change.id] !== true) {
        if (!mergedRows[change.rowIndex]) continue
        mergedRows[change.rowIndex][change.columnIndex] = change.originalValue
      }
    }

    const csv = toCsvText(reviewData.headers, mergedRows)
    downloadCsv(csv, `processed_approved_${reviewData.fileName}`)
    toast.success("Downloaded CSV with approved changes only.")
    resetDialogState()
  }

  const handleDownloadAllProcessed = () => {
    if (!reviewData) return
    const csv = toCsvText(reviewData.headers, reviewData.processedRows)
    downloadCsv(csv, `processed_all_${reviewData.fileName}`)
    toast.success("Downloaded CSV with all algorithm changes.")
    resetDialogState()
  }

  const approvedCount = reviewData
    ? reviewData.changes.filter((c: CsvRateChange) => approvedChanges[c.id] === true).length
    : 0

  const handleReviewSortClick = (column: ReviewSortColumn) => {
    setReviewSortBy((prev) => {
      if (prev === column) {
        setReviewSortDir((dir) => (dir === "asc" ? "desc" : "asc"))
        return prev
      }
      setReviewSortDir("asc")
      return column
    })
  }

  const sortedReviewRows = useMemo(() => {
    const rows = reviewData?.reviewRows ?? []
    const next = [...rows]
    const dir = reviewSortDir === "asc" ? 1 : -1

    const decisionState = (change: CsvRateChange | null): string => {
      if (!change) return "none"
      const approved = approvedChanges[change.id]
      if (approved === true) return "approved"
      if (approved === false) return "denied"
      return "pending"
    }

    const toComparable = (value: unknown) => {
      if (typeof value === "number" && Number.isFinite(value)) return { kind: "num" as const, num: value }
      if (typeof value === "boolean") return { kind: "num" as const, num: value ? 1 : 0 }
      const raw = String(value ?? "").trim()
      const numeric = Number(raw.replace(/[$,%\s,]/g, ""))
      if (raw !== "" && Number.isFinite(numeric)) return { kind: "num" as const, num: numeric }
      return { kind: "str" as const, str: raw.toLowerCase() }
    }

    const valueForColumn = (row: ReviewRow): unknown => {
      switch (reviewSortBy) {
        case "webDecision":
          return decisionState(row.webRateChange)
        case "standardDecision":
          return decisionState(row.standardRateChange)
        default:
          return row[reviewSortBy]
      }
    }

    next.sort((a, b) => {
      const aCmp = toComparable(valueForColumn(a))
      const bCmp = toComparable(valueForColumn(b))

      if (aCmp.kind === "num" && bCmp.kind === "num") {
        return (aCmp.num - bCmp.num) * dir
      }

      const aStr = aCmp.kind === "str" ? aCmp.str : String(aCmp.num)
      const bStr = bCmp.kind === "str" ? bCmp.str : String(bCmp.num)
      return aStr.localeCompare(bStr) * dir
    })

    return next
  }, [reviewData?.reviewRows, reviewSortBy, reviewSortDir, approvedChanges])

  const renderReviewSortableHeader = (label: string, column: ReviewSortColumn, infoText?: string) => (
    <th className="px-3 py-2 text-left font-medium">
      {void infoText}
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:underline"
        onClick={() => handleReviewSortClick(column)}
      >
        <span>{label}</span>
        {reviewSortBy === column ? (
          reviewSortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        )}
      </button>
    </th>
  )

  // ── Inline panel render ──────────────────────────────────────────────────
  if (inline) {
    const inlineResetState = () => {
      setFile(null)
      setIsProcessing(false)
      setReviewData(null)
      setApprovedChanges({})
      setTraceDialogRow(null)
      setPopupAdjusters([])
      setAmenityAdjuster(createDefaultAmenityAdjusterState())
      setMappingRules([])
      setMappingGroups([])
      setPipelineMappingConfigs(mappingPipelineNames.map((name) => createDefaultPipelineMappingConfig(name)))
      setOriginalParsed(null)
      setCsvNumericVariables([])
      lastAutoRebuildKeyRef.current = ""
    }

    return (
      <div className="flex flex-col gap-4 h-full min-h-0">
        <input
          ref={csvUploadInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onClick={(event) => {
            event.currentTarget.value = ""
          }}
          onChange={handleCsvFileSelected}
        />
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setLoadConfigOpen(true)}
            disabled={isSavingProcessConfig || isLoadingProcessConfig || deletingProcessConfigId !== null}
            title="Save configuration"
          >
            {isSavingProcessConfig ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => csvUploadInputRef.current?.click()}
          >
            Upload CSV
          </Button>
        </div>
        {file ? <div className="text-xs text-muted-foreground text-right">Selected: {file.name}</div> : null}

        {/* Panel header — only shown when reviewing changes */}
        {reviewData && (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="text-sm text-muted-foreground space-y-1">
                <span className="text-xs text-muted-foreground block">
                  Reviewing only New Web Rate / New Standard Rate changes.
                  <br />
                  Rows changed: {reviewData.reviewRows.length.toLocaleString()} · Changes approved: {approvedCount.toLocaleString()} / {reviewData.changes.length.toLocaleString()}
                </span>
              </div>
            </div>
            {true ? (
            <Dialog open={standardRateOpen} onOpenChange={setStandardRateOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  Standard Rate Function
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[900px]">
                <DialogHeader>
                  <DialogTitle>Standard rate function</DialogTitle>
                  <DialogDescription>
                    The standard rate is calculated from the web rate using the current curve.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <div className="flex flex-col gap-2">
                      <div>
                        <div>Current curve:</div>
                        <div>{`Standard = ${DEFAULT_STANDARD_RATE_FUNCTION}`}</div>
                      </div>
                      <div className="relative">
                        <svg
                          viewBox={`0 0 ${standardRateChart.svgWidth} ${standardRateChart.svgHeight}`}
                          className="h-[420px] w-full rounded border bg-white cursor-grab active:cursor-grabbing"
                          onMouseDown={(event) => handleStandardRateDragStart(event.clientX, event.clientY)}
                          onMouseMove={(event) => handleStandardRateDragMove(event.clientX, event.clientY)}
                          onMouseUp={handleStandardRateDragEnd}
                          onMouseLeave={handleStandardRateDragEnd}
                          onTouchStart={(event) => { const touch = event.touches[0]; if (touch) handleStandardRateDragStart(touch.clientX, touch.clientY) }}
                          onTouchMove={(event) => { const touch = event.touches[0]; if (touch) handleStandardRateDragMove(touch.clientX, touch.clientY) }}
                          onTouchEnd={handleStandardRateDragEnd}
                        >
                          <defs>
                            <linearGradient id="grid-inline" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0" stopColor="currentColor" stopOpacity="0.08" />
                              <stop offset="1" stopColor="currentColor" stopOpacity="0.08" />
                            </linearGradient>
                          </defs>
                          <rect x={standardRateChart.margin.left} y={standardRateChart.margin.top} width={standardRateChart.plotWidth} height={standardRateChart.plotHeight} fill="url(#grid-inline)" />
                          <line x1={standardRateChart.margin.left} y1={standardRateChart.margin.top} x2={standardRateChart.margin.left} y2={standardRateChart.margin.top + standardRateChart.plotHeight} stroke="currentColor" strokeOpacity="0.4" />
                          <line x1={standardRateChart.margin.left} y1={standardRateChart.margin.top + standardRateChart.plotHeight} x2={standardRateChart.margin.left + standardRateChart.plotWidth} y2={standardRateChart.margin.top + standardRateChart.plotHeight} stroke="currentColor" strokeOpacity="0.4" />
                          {standardRateChart.xTicks.map((tick) => (
                            <g key={`gx2-${tick.value}`}>
                              <line x1={tick.x} y1={standardRateChart.margin.top} x2={tick.x} y2={standardRateChart.margin.top + standardRateChart.plotHeight} stroke="currentColor" strokeOpacity="0.08" />
                              <text x={tick.x} y={standardRateChart.margin.top + standardRateChart.plotHeight + 20} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.7">{tick.label}</text>
                            </g>
                          ))}
                          {standardRateChart.yTicks.map((tick) => (
                            <g key={`gy2-${tick.value}`}>
                              <line x1={standardRateChart.margin.left} y1={tick.y} x2={standardRateChart.margin.left + standardRateChart.plotWidth} y2={tick.y} stroke="currentColor" strokeOpacity="0.08" />
                              <text x={standardRateChart.margin.left - 8} y={tick.y + 3} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.7">{tick.label}</text>
                            </g>
                          ))}
                          {standardRateChart.breakpoints.map((bp) => (
                            <line key={`bp2-${bp.value}`} x1={bp.x} y1={standardRateChart.margin.top} x2={bp.x} y2={standardRateChart.margin.top + standardRateChart.plotHeight} stroke="currentColor" strokeOpacity="0.35" strokeDasharray="6 6" />
                          ))}
                          <path d={standardRateChart.path} fill="none" stroke="currentColor" strokeWidth="2" />
                          <text x={standardRateChart.margin.left + standardRateChart.plotWidth / 2} y={standardRateChart.svgHeight - 12} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.7">Web Rate ($)</text>
                          <text x={14} y={standardRateChart.margin.top + standardRateChart.plotHeight / 2} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.7" transform={`rotate(-90 14 ${standardRateChart.margin.top + standardRateChart.plotHeight / 2})`}>Standard Rate ($)</text>
                        </svg>
                        <div className="absolute right-2 top-2 flex flex-col gap-2">
                          <Button type="button" size="sm" variant="secondary" onClick={() => setStandardRateZoomX((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))))}>Zoom X +</Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => setStandardRateZoomX((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))))}>Zoom X -</Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => setStandardRateZoomY((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))))}>Zoom Y +</Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => setStandardRateZoomY((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))))}>Zoom Y -</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => { setStandardRateZoomX(1); setStandardRateZoomY(1); setStandardRatePanX(0); setStandardRatePanY(0) }}>Reset</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="standard-rate-function-inline" className="text-xs font-medium text-muted-foreground">Custom function (x = web rate)</Label>
                    <Input id="standard-rate-function-inline" placeholder="Example: x < 100 ? 1.8 * x : x < 200 ? 1.6 * x : 1.4 * x" value={standardRateFunction} onChange={(e) => setStandardRateFunction(e.target.value)} />
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                    <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 sm:gap-3">
                      <Button type="button" variant="outline" size="sm">
                        Rounding (Standard Rate)
                      </Button>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="standard-rate-rounding-enabled-inline"
                          checked={standardRateRoundingEnabled}
                          onCheckedChange={(checked: unknown) => setStandardRateRoundingEnabled(Boolean(checked))}
                        />
                        <label htmlFor="standard-rate-rounding-enabled-inline" className="text-sm">
                          Enable
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <label htmlFor="standard-rate-rounding-offset-inline" className="text-xs text-muted-foreground">
                          Round to
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            $
                          </span>
                          <Input
                            id="standard-rate-rounding-offset-inline"
                            type="text"
                            inputMode="decimal"
                            value={standardRateRoundingOffsetInput}
                            onChange={(e) => handleStandardRateRoundingOffsetChange(e.target.value)}
                            className="h-8 w-[120px] pl-5"
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">($0.00 to $1.00)</span>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" onClick={() => { toast.success("Standard rate function saved."); setStandardRateOpen(false) }}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
          </div>
        )}

        {/* Panel body */}
        {!reviewData ? (
          <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden">
            <div className="flex w-full flex-wrap items-start gap-2">
              <span className="text-sm font-medium">Adjusters</span>
              <Button type="button" size="sm" variant="outline" onClick={functionDialog.handleOpen}>Competitive</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowLevels(true)}>Levels</Button>
              <div className="ml-auto flex shrink-0 flex-col items-end gap-1 self-start">
                <Button type="button" size="sm" className="h-8" variant="outline" onClick={() => setStandardRateOpen(true)}>
                  Standard Rate Function
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowMapping(true)} disabled={mappingPipelineNames.length === 0}>
                  Mapping
                </Button>
              </div>
            </div>
            <div className="rounded-md border p-3 space-y-3">
              {popupAdjusters.length === 0 ? (
                <p className="text-xs text-muted-foreground">No competitive adjusters configured.</p>
              ) : null}
              <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {popupAdjusters.map((adj: Adjuster, idx: number) => (
                  <li key={`${adj.type}-${idx}`} className="h-full">
                    {adj.type === "competitive" ? (
                      <CompetitiveAdjusterCard
                        adjuster={adj as CompetitivePriceAdjuster}
                        stepNumber={idx + 1}
                        totalSteps={totalProcessAdjusterSteps}
                        onRemove={() => handleRemovePopupAdjuster(idx)}
                          showVariable
                      />
                    ) : adj.type === "function" ? (
                      <FunctionAdjusterCard
                        adjuster={adj as FunctionBasedAdjuster}
                        stepNumber={idx + 1}
                        totalSteps={totalProcessAdjusterSteps}
                        onRemove={() => handleRemovePopupAdjuster(idx)}
                      />
                    ) : (
                      <TemporalAdjusterCard
                        adjuster={adj as TemporalAdjuster}
                        stepNumber={idx + 1}
                        totalSteps={totalProcessAdjusterSteps}
                        onRemove={() => handleRemovePopupAdjuster(idx)}
                      />
                    )}
                  </li>
                ))}
                {showLevelsAdjusterPreview ? (
                  <li className="h-full">
                    <LevelsAdjusterPreviewCard
                      amenityAdjuster={amenityAdjuster}
                      onRemove={handleRemoveLevelsAdjuster}
                      stepNumber={popupAdjusters.length + 1}
                      totalSteps={totalProcessAdjusterSteps}
                    />
                  </li>
                ) : null}
              </ol>
            </div>
          </div>
        ) : (
          <div className="space-y-3 flex-1 min-h-0 overflow-hidden">
            <div className="flex w-full flex-wrap items-start gap-2">
              <span className="text-sm font-medium">Adjusters</span>
              <Button type="button" size="sm" variant="outline" onClick={functionDialog.handleOpen}>Competitive</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowLevels(true)}>Levels</Button>
              <div className="ml-auto flex shrink-0 flex-col items-end gap-1 self-start">
                <Button type="button" size="sm" className="h-8" variant="outline" onClick={() => setStandardRateOpen(true)}>
                  Standard Rate Function
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowMapping(true)} disabled={mappingPipelineNames.length === 0}>
                  Mapping
                </Button>
              </div>
            </div>
            <div className="rounded-md border p-3 space-y-3">
              {popupAdjusters.length === 0 ? (
                <p className="text-xs text-muted-foreground">No competitive adjusters configured.</p>
              ) : null}
              <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {popupAdjusters.map((adj: Adjuster, idx: number) => (
                  <li key={`${adj.type}-${idx}`} className="h-full">
                    {adj.type === "competitive" ? (
                      <CompetitiveAdjusterCard
                        adjuster={adj as CompetitivePriceAdjuster}
                        stepNumber={idx + 1}
                        totalSteps={totalProcessAdjusterSteps}
                        onRemove={() => handleRemovePopupAdjuster(idx)}
                          showVariable
                      />
                    ) : adj.type === "function" ? (
                      <FunctionAdjusterCard
                        adjuster={adj as FunctionBasedAdjuster}
                        stepNumber={idx + 1}
                        totalSteps={totalProcessAdjusterSteps}
                        onRemove={() => handleRemovePopupAdjuster(idx)}
                      />
                    ) : (
                      <TemporalAdjusterCard
                        adjuster={adj as TemporalAdjuster}
                        stepNumber={idx + 1}
                        totalSteps={totalProcessAdjusterSteps}
                        onRemove={() => handleRemovePopupAdjuster(idx)}
                      />
                    )}
                  </li>
                ))}
                {showLevelsAdjusterPreview ? (
                  <li className="h-full">
                    <LevelsAdjusterPreviewCard
                      amenityAdjuster={amenityAdjuster}
                      onRemove={handleRemoveLevelsAdjuster}
                      stepNumber={popupAdjusters.length + 1}
                      totalSteps={totalProcessAdjusterSteps}
                    />
                  </li>
                ) : null}
              </ol>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setAllApprovals(true)}>Approve all</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setAllApprovals(false)}>Reject all</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setReviewData(null); setApprovedChanges({}); setTraceDialogRow(null) }}>Choose another CSV</Button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto rounded-md border">
              {reviewData.reviewRows.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No changes were produced by pricing algorithms. You can still download the processed CSV.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Trace</th>
                      {renderReviewSortableHeader("Row", "rowIndex")}
                      {renderReviewSortableHeader("Facility", "facilityName", "Maps from CSV Facility Name and matches calculated client_location (with city/location fallbacks).")}
                      {renderReviewSortableHeader("Unit", "unitSize", "Maps from CSV Size/Unit Size and matches calculated unit_dimensions. If unit_area is used, matching uses CSV Area instead.")}
                      {renderReviewSortableHeader("Total Units", "totalUnits")}
                      {renderReviewSortableHeader("Occupied", "occupied")}
                      {renderReviewSortableHeader("Available", "available")}
                      {renderReviewSortableHeader("Vacancy", "vacancy")}
                      {renderReviewSortableHeader("Occupancy", "occupancy")}
                      {renderReviewSortableHeader("Elevator Access", "hasElevatorAccessAmenity", "Derived from CSV Unit Amenities text containing elevator access terms.")}
                      {renderReviewSortableHeader("Drive Up", "hasDriveUpAmenity", "Derived from CSV Unit Amenities drive-up text, also used for has_drive_up_access matching when enabled.")}
                      {renderReviewSortableHeader("1st Floor", "hasFirstFloorAmenity", "Derived from CSV Unit Amenities text containing 1st floor / first floor.")}
                      {renderReviewSortableHeader("Climate Controlled", "hasClimateControlledAmenity", "Derived from CSV Unit Amenities climate-controlled text.")}
                      {renderReviewSortableHeader("Level", "amenityLevel", "Derived from CSV Unit Amenities tier keywords: Premium, Standard, Economy.")}
                      {renderReviewSortableHeader("Current Web", "currentWebRate", "Read from CSV Current Web Rate (or Current Rent Rate fallback).")}
                      {renderReviewSortableHeader("New Web", "proposedWebRate", "Calculated from matched pipeline web price, then popup/levels adjusters and rounding are applied.")}
                      {renderReviewSortableHeader("Web Decision", "webDecision")}
                      {renderReviewSortableHeader("Current Standard", "currentStandardRate", "Read from CSV Current Standard Rate.")}
                      {renderReviewSortableHeader("New Standard", "proposedStandardRate", "Calculated from the standard-rate function using New Web as input, then standard rounding is applied.")}
                      {renderReviewSortableHeader("Standard Decision", "standardDecision")}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReviewRows.map((row: ReviewRow) => (
                      <tr key={row.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2 align-top">
                          {row.traceDetails ? (
                            <Button type="button" size="sm" variant="outline" onClick={() => openTraceDialog(row)}>
                              View
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">{row.rowIndex + 2}</td>
                        <td className="px-3 py-2 align-top">{row.facilityName || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.unitSize || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.totalUnits || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.occupied || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.available || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.vacancy || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.occupancy || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.hasElevatorAccessAmenity ? "✓" : ""}</td>
                        <td className="px-3 py-2 align-top">{row.hasDriveUpAmenity ? "✓" : ""}</td>
                        <td className="px-3 py-2 align-top">{row.hasFirstFloorAmenity ? "✓" : ""}</td>
                        <td className="px-3 py-2 align-top">{row.hasClimateControlledAmenity ? "✓" : ""}</td>
                        <td className="px-3 py-2 align-top">{row.amenityLevel || ""}</td>
                        <td className="px-3 py-2 align-top text-muted-foreground">{row.currentWebRate || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.proposedWebRate || "—"}</td>
                        <td className="px-3 py-2 align-top">
                          {row.webRateChange ? (
                            <div className="flex items-center gap-2">
                              <Button type="button" size="sm" variant={approvedChanges[row.webRateChange.id] === true ? "default" : "outline"} onClick={() => setChangeApproval(row.webRateChange!.id, true)}>Approve</Button>
                              <Button type="button" size="sm" variant={approvedChanges[row.webRateChange.id] === false ? "destructive" : "outline"} onClick={() => setChangeApproval(row.webRateChange!.id, false)}>Deny</Button>
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2 align-top text-muted-foreground">{row.currentStandardRate || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.proposedStandardRate || "—"}</td>
                        <td className="px-3 py-2 align-top">
                          {row.standardRateChange ? (
                            <div className="flex items-center gap-2">
                              <Button type="button" size="sm" variant={approvedChanges[row.standardRateChange.id] === true ? "default" : "outline"} onClick={() => setChangeApproval(row.standardRateChange!.id, true)}>Approve</Button>
                              <Button type="button" size="sm" variant={approvedChanges[row.standardRateChange.id] === false ? "destructive" : "outline"} onClick={() => setChangeApproval(row.standardRateChange!.id, false)}>Deny</Button>
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Panel footer */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {!reviewData ? (
            <Button
              onClick={handleProcess}
              disabled={!file || isProcessing}
              className="w-full"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isProcessing ? "Applying…" : "Apply Pricing"}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => { if (!reviewData) return; const csv = toCsvText(reviewData.headers, reviewData.processedRows); downloadCsv(csv, `processed_all_${reviewData.fileName}`); toast.success("Downloaded CSV with all algorithm changes."); inlineResetState() }}>
                Download All Changes
              </Button>
              <Button type="button" onClick={() => { if (!reviewData) return; const mergedRows = reviewData.processedRows.map((row: string[]) => [...row]); for (const change of reviewData.changes) { if (approvedChanges[change.id] !== true) { if (!mergedRows[change.rowIndex]) continue; mergedRows[change.rowIndex][change.columnIndex] = change.originalValue } }; const csv = toCsvText(reviewData.headers, mergedRows); downloadCsv(csv, `processed_approved_${reviewData.fileName}`); toast.success("Downloaded CSV with approved changes only."); inlineResetState() }}>
                Download Approved Changes
              </Button>
            </>
          )}
        </div>

        {/* Supporting dialogs */}
        <Dialog open={loadConfigOpen} onOpenChange={setLoadConfigOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Config Settings</DialogTitle>
              <DialogDescription>Load, save, or clear your Process CSV configuration.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                onClick={handleSaveProcessCsvConfig}
                disabled={isSavingProcessConfig || isLoadingProcessConfig || deletingProcessConfigId !== null}
              >
                {isSavingProcessConfig ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                Save New Config
              </Button>
              <Button type="button" variant="outline" onClick={handleClearProcessCsvConfig}>
                Clear Current Config
              </Button>
            </div>
            <div className="max-h-[360px] overflow-auto space-y-2">
              {availableProcessConfigs.map((config) => (
                <div key={config.id ?? config.name} className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 justify-start"
                    onClick={() => handleSelectProcessCsvConfig(config)}
                  >
                    {config.name || "Unnamed configuration"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSavingProcessConfig || overwritingProcessConfigId === (config.id ?? (config.name || "Unnamed configuration"))}
                    onClick={() => handleOverwriteProcessCsvConfig(config)}
                  >
                    {overwritingProcessConfigId === (config.id ?? (config.name || "Unnamed configuration")) ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={!config.id || deletingProcessConfigId === config.id}
                    onClick={() => handleDeleteProcessCsvConfig(config)}
                  >
                    {deletingProcessConfigId === config.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Delete"
                    )}
                  </Button>
                </div>
              ))}
              {availableProcessConfigs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No configurations available.</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLoadConfigOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showMapping} onOpenChange={handleMappingDialogOpenChange}>
          <DialogContent className="sm:max-w-[760px]">
            <DialogHeader>
              <DialogTitle>Mapping</DialogTitle>
            </DialogHeader>
            <div className="max-h-[62vh] overflow-y-auto pr-1">
              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Mapping groups</div>
                  <Button type="button" size="sm" variant="outline" onClick={addMappingGroup} disabled={mappingPipelineNames.length === 0}>
                    Add Group
                  </Button>
                </div>
                {mappingGroups.length > 0 ? (
                  <>
                    <div className="sticky top-0 z-10 -mx-3 mb-3 border-b bg-background/95 px-3 pb-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                      <div className="mt-2 space-y-1">
                        {mappingGroups.map((group) => {
                          const isActive = group.id === selectedMappingGroupId
                          return (
                            <Button
                              key={group.id}
                              type="button"
                              size="sm"
                              variant={isActive ? "default" : "outline"}
                              className="h-8 w-full justify-start"
                              onClick={() => setSelectedMappingGroupId(group.id)}
                            >
                              {group.name || "Unnamed group"}
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Selected group</Label>
                        <select
                          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                          value={selectedMappingGroupId}
                          onChange={(e) => setSelectedMappingGroupId(e.target.value)}
                        >
                          {mappingGroups.map((group) => (
                            <option key={group.id} value={group.id}>{group.name || "Unnamed group"}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Group name</Label>
                        <Input
                          className="mt-1 h-9"
                          placeholder="Location + Size"
                          value={selectedMappingGroup?.name ?? ""}
                          onChange={(e) => selectedMappingGroup && updateMappingGroup(selectedMappingGroup.id, { name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Pipeline</Label>
                        <select
                          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                          value={selectedMappingGroup?.pipelineName ?? ""}
                          onChange={(e) => selectedMappingGroup && updateMappingGroup(selectedMappingGroup.id, { pipelineName: e.target.value })}
                        >
                          {mappingPipelineNames.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Fallback group</Label>
                        <select
                          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                          value={selectedMappingGroup?.fallbackGroupId ?? ""}
                          onChange={(e) => selectedMappingGroup && updateMappingGroup(selectedMappingGroup.id, { fallbackGroupId: e.target.value })}
                        >
                          <option value="">None</option>
                          {mappingGroups.filter((group) => group.id !== selectedMappingGroup?.id).map((group) => (
                            <option key={group.id} value={group.id}>{group.name || "Unnamed group"}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">Column mappings</div>
                        <Button type="button" size="sm" variant="outline" onClick={() => selectedMappingGroup && addGroupColumnMapping(selectedMappingGroup.id)}>
                          Add Column Mapping
                        </Button>
                      </div>
                      {(selectedMappingGroup?.columnMappings ?? []).map((mapping) => (
                        <div key={mapping.id} className="rounded-md border p-2 space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                            <Input
                              className="h-9"
                              placeholder="CSV column"
                              value={mapping.csvColumn}
                              onChange={(e) => selectedMappingGroup && updateGroupColumnMapping(selectedMappingGroup.id, mapping.id, { csvColumn: e.target.value })}
                            />
                            <Input
                              className="h-9"
                              placeholder="Pipeline column"
                              value={mapping.competitorColumn}
                              onChange={(e) => selectedMappingGroup && updateGroupColumnMapping(selectedMappingGroup.id, mapping.id, { competitorColumn: e.target.value as MappingGroupCompetitorColumn })}
                            />
                            <div className="flex gap-2">
                              <Button type="button" size="sm" variant="outline" onClick={() => selectedMappingGroup && addGroupColumnMappingPair(selectedMappingGroup.id, mapping.id)}>
                                Add Pair
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => selectedMappingGroup && removeGroupColumnMapping(selectedMappingGroup.id, mapping.id)}>
                                Remove
                              </Button>
                            </div>
                          </div>
                          {(mapping.pairs ?? []).map((pair) => (
                            <div key={pair.id} className="rounded-md border border-dashed p-2 space-y-2">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <Input
                                  className="h-9 rounded-full"
                                  placeholder="CSV Value"
                                  value={pair.exactMatch || pair.csvFirstTwoDimensions ? "" : pair.csvValue}
                                  disabled={pair.exactMatch || pair.csvFirstTwoDimensions}
                                  onChange={(e) => selectedMappingGroup && updateGroupColumnMappingPair(selectedMappingGroup.id, mapping.id, pair.id, { csvValue: e.target.value })}
                                />
                                <Input
                                  className="h-9 rounded-full"
                                  placeholder="Pipeline value"
                                  value={pair.exactMatch || pair.csvFirstTwoDimensions ? "" : pair.pipelineValue}
                                  disabled={pair.exactMatch || pair.csvFirstTwoDimensions}
                                  onChange={(e) => selectedMappingGroup && updateGroupColumnMappingPair(selectedMappingGroup.id, mapping.id, pair.id, { pipelineValue: e.target.value })}
                                />
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs">
                                <label className="inline-flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={pair.exactMatch}
                                    onChange={(e) => selectedMappingGroup && updateGroupColumnMappingPair(selectedMappingGroup.id, mapping.id, pair.id, { exactMatch: e.target.checked })}
                                  />
                                  <span>Exact Match</span>
                                </label>
                                <label className="inline-flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={pair.csvFirstTwoDimensions}
                                    onChange={(e) => selectedMappingGroup && updateGroupColumnMappingPair(selectedMappingGroup.id, mapping.id, pair.id, { csvFirstTwoDimensions: e.target.checked })}
                                  />
                                  <span>Dimensions Operator</span>
                                </label>
                                <Button type="button" size="sm" variant="outline" onClick={() => selectedMappingGroup && removeGroupColumnMappingPair(selectedMappingGroup.id, mapping.id, pair.id)}>
                                  Remove Pair
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <Button type="button" size="sm" variant="destructive" onClick={() => selectedMappingGroup && removeMappingGroup(selectedMappingGroup.id)}>
                        Delete Group
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No mapping groups yet. Add a group to configure grouped mapping behavior.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleMappingDialogOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AddFunctionAdjusterDialog
          open={functionDialog.open}
          onOpenChange={functionDialog.setOpen}
          onAdd={handleAddPopupAdjuster}
          availableVariables={csvNumericVariables.filter((name: string) => !RATE_VARIABLE_EXCLUSIONS.has(normalizeColumnKey(name)))}
          competitorData={pricingContext?.competitorData ?? []}
          clientAvailableUnits={pricingContext?.clientAvailableUnits ?? 0}
          includeAvailableUnits={false}
        />

        <Dialog open={Boolean(traceDialogRow)} onOpenChange={(nextOpen) => { if (!nextOpen) setTraceDialogRow(null) }}>
          <DialogContent className="sm:max-w-[640px]">
            <DialogHeader>
              <DialogTitle>Trace details</DialogTitle>
              <DialogDescription>
                {traceDialogRow?.traceDetails
                  ? `Pipeline: ${traceDialogRow.traceDetails.pipelineName} · Row ${traceDialogRow.rowIndex + 2}`
                  : "No trace details available."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {traceDialogRow?.traceDetails ? (
                <>
                  <div className="text-sm">
                    <span className="font-medium">Traced price: </span>
                    <span>{traceDialogRow.traceDetails.price || "—"}</span>
                  </div>
                  <div className="max-h-[360px] overflow-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Competitor column</th>
                          <th className="px-3 py-2 text-left font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {traceDialogRow.traceDetails.comboMapEntries.map((entry) => (
                          <tr key={entry.key} className="border-b last:border-b-0">
                            <td className="px-3 py-2 align-top font-mono text-xs">{entry.key}</td>
                            <td className="px-3 py-2 align-top">{entry.value || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No trace details available for this row.</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTraceDialogRow(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showLevels} onOpenChange={setShowLevels}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Levels</DialogTitle>
              <DialogDescription>Configure Unit Amenities adjustments (Premium, Standard, Economy).</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="text-muted-foreground">Apply to:</span>
                <label className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={amenityAdjuster.applyToWeb} onChange={(e) => setAmenityAdjuster((prev) => ({ ...prev, applyToWeb: e.target.checked }))} />
                  <span>Web rate</span>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="font-medium text-muted-foreground">Tier</div>
                <div className="font-medium text-muted-foreground">Multiplier</div>
                <div className="font-medium text-muted-foreground">Offset</div>
                {([{ key: "premium", label: "Premium" }, { key: "standard", label: "Standard" }, { key: "economy", label: "Economy" }] as const).map((tier) => (
                  <div key={tier.key} className="contents">
                    <div className="flex items-center">{tier.label}</div>
                    <div><Input className="h-8" placeholder={tier.key === "premium" ? "1.05" : tier.key === "standard" ? "1" : "0.95"} value={amenityAdjuster[tier.key].multiplier} onChange={(e) => setAmenityAdjuster((prev: AmenityAdjusterState) => ({ ...prev, [tier.key]: { ...prev[tier.key], multiplier: e.target.value } }))} /></div>
                    <div><Input className="h-8" placeholder={tier.key === "economy" ? "-5" : tier.key === "standard" ? "0" : "5"} value={amenityAdjuster[tier.key].offset} onChange={(e) => setAmenityAdjuster((prev: AmenityAdjusterState) => ({ ...prev, [tier.key]: { ...prev[tier.key], offset: e.target.value } }))} /></div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowLevels(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }
  // ── End inline panel render ──────────────────────────────────────────────

  return (
    <div className="flex items-center gap-2">
      <Dialog
        open={open}
        onOpenChange={(nextOpen: boolean) => {
          if (!nextOpen) {
            resetDialogState()
            return
          }
          setOpen(true)
        }}
      >
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            disabled={hasInvalidFilters}
            title={hasInvalidFilters ? "Only Location, Dimension, and optional Drive Up filters are supported for pricing effect" : "Effect Pricing"}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Effect Pricing
          </Button>
        </DialogTrigger>
        <DialogContent className="w-screen max-w-screen h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <DialogTitle>{reviewData ? "Review CSV Changes" : "Apply pricing algorithms"}</DialogTitle>
              <DialogDescription>
                {reviewData ? (
                  <>
                    Review each algorithm change before final download.
                    <br />
                    <span className="text-xs text-muted-foreground mt-2 block">
                      Reviewing only New Web Rate / New Standard Rate changes.
                      <br />
                      Rows changed: {reviewData.reviewRows.length.toLocaleString()} · Changes approved: {approvedCount.toLocaleString()} / {reviewData.changes.length.toLocaleString()}
                    </span>
                  </>
                ) : (
                  <>
                    Upload a client CSV and apply pricing algorithms.
                    <br />
                    <span className="text-xs text-muted-foreground mt-2 block">
                      Supported filters: client_location, unit_dimensions or unit_area (from CSV Area), has_drive_up_access.
                      <br />
                      Competitive adjusters appear after upload in the review screen.
                      <br />
                      Uses the currently displayed pipeline price table in the browser.
                      <br />
                      has_drive_up_access matching uses CSV &apos;Unit Amenities&apos; text (Drive Up) when present.
                      <br />
                      Ensure columns: &apos;Facility Name&apos;, &apos;Size&apos;, &apos;Current Web Rate&apos;, &apos;Current Standard Rate&apos;, &apos;New Web Rate&apos;, &apos;New Standard Rate&apos;.
                    </span>
                  </>
                )}
              </DialogDescription>
            </div>
            <div className="pr-6 flex flex-col items-end gap-2">
              <input
                ref={csvUploadInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onClick={(event) => {
                  event.currentTarget.value = ""
                }}
                onChange={handleCsvFileSelected}
              />
              <div className="flex items-center gap-2">
                {reviewData ? (
                  <Dialog open={standardRateOpen} onOpenChange={setStandardRateOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="sm">
                        Standard Rate Function
                      </Button>
                    </DialogTrigger>
                <DialogContent className="sm:max-w-[900px]">
                  <DialogHeader>
                    <DialogTitle>Standard rate function</DialogTitle>
                    <DialogDescription>
                      The standard rate is calculated from the web rate using the current curve.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      <div className="flex flex-col gap-2">
                        <div>
                          <div>Current curve:</div>
                          <div>{`Standard = ${DEFAULT_STANDARD_RATE_FUNCTION}`}</div>
                        </div>
                        <div className="relative">
                          <svg
                            viewBox={`0 0 ${standardRateChart.svgWidth} ${standardRateChart.svgHeight}`}
                            className="h-[420px] w-full rounded border bg-white cursor-grab active:cursor-grabbing"
                            onMouseDown={(event) => handleStandardRateDragStart(event.clientX, event.clientY)}
                            onMouseMove={(event) => handleStandardRateDragMove(event.clientX, event.clientY)}
                            onMouseUp={handleStandardRateDragEnd}
                            onMouseLeave={handleStandardRateDragEnd}
                            onTouchStart={(event) => {
                              const touch = event.touches[0]
                              if (touch) handleStandardRateDragStart(touch.clientX, touch.clientY)
                            }}
                            onTouchMove={(event) => {
                              const touch = event.touches[0]
                              if (touch) handleStandardRateDragMove(touch.clientX, touch.clientY)
                            }}
                            onTouchEnd={handleStandardRateDragEnd}
                          >
                          <defs>
                            <linearGradient id="grid" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0" stopColor="currentColor" stopOpacity="0.08" />
                              <stop offset="1" stopColor="currentColor" stopOpacity="0.08" />
                            </linearGradient>
                          </defs>
                          <rect
                            x={standardRateChart.margin.left}
                            y={standardRateChart.margin.top}
                            width={standardRateChart.plotWidth}
                            height={standardRateChart.plotHeight}
                            fill="url(#grid)"
                          />
                          <line
                            x1={standardRateChart.margin.left}
                            y1={standardRateChart.margin.top}
                            x2={standardRateChart.margin.left}
                            y2={standardRateChart.margin.top + standardRateChart.plotHeight}
                            stroke="currentColor"
                            strokeOpacity="0.4"
                          />
                          <line
                            x1={standardRateChart.margin.left}
                            y1={standardRateChart.margin.top + standardRateChart.plotHeight}
                            x2={standardRateChart.margin.left + standardRateChart.plotWidth}
                            y2={standardRateChart.margin.top + standardRateChart.plotHeight}
                            stroke="currentColor"
                            strokeOpacity="0.4"
                          />

                          {standardRateChart.xTicks.map((tick) => (
                            <g key={`gx-${tick.value}`}>
                              <line
                                x1={tick.x}
                                y1={standardRateChart.margin.top}
                                x2={tick.x}
                                y2={standardRateChart.margin.top + standardRateChart.plotHeight}
                                stroke="currentColor"
                                strokeOpacity="0.08"
                              />
                              <text
                                x={tick.x}
                                y={standardRateChart.margin.top + standardRateChart.plotHeight + 20}
                                textAnchor="middle"
                                fontSize="10"
                                fill="currentColor"
                                fillOpacity="0.7"
                              >
                                {tick.label}
                              </text>
                            </g>
                          ))}
                          {standardRateChart.yTicks.map((tick) => (
                            <g key={`gy-${tick.value}`}>
                              <line
                                x1={standardRateChart.margin.left}
                                y1={tick.y}
                                x2={standardRateChart.margin.left + standardRateChart.plotWidth}
                                y2={tick.y}
                                stroke="currentColor"
                                strokeOpacity="0.08"
                              />
                              <text
                                x={standardRateChart.margin.left - 8}
                                y={tick.y + 3}
                                textAnchor="end"
                                fontSize="10"
                                fill="currentColor"
                                fillOpacity="0.7"
                              >
                                {tick.label}
                              </text>
                            </g>
                          ))}

                          {standardRateChart.breakpoints.map((bp) => (
                            <line
                              key={`bp-${bp.value}`}
                              x1={bp.x}
                              y1={standardRateChart.margin.top}
                              x2={bp.x}
                              y2={standardRateChart.margin.top + standardRateChart.plotHeight}
                              stroke="currentColor"
                              strokeOpacity="0.35"
                              strokeDasharray="6 6"
                            />
                          ))}

                          <path d={standardRateChart.path} fill="none" stroke="currentColor" strokeWidth="2" />

                          <text
                            x={standardRateChart.margin.left + standardRateChart.plotWidth / 2}
                            y={standardRateChart.svgHeight - 12}
                            textAnchor="middle"
                            fontSize="11"
                            fill="currentColor"
                            fillOpacity="0.7"
                          >
                            Web Rate ($)
                          </text>
                          <text
                            x={14}
                            y={standardRateChart.margin.top + standardRateChart.plotHeight / 2}
                            textAnchor="middle"
                            fontSize="11"
                            fill="currentColor"
                            fillOpacity="0.7"
                            transform={`rotate(-90 14 ${standardRateChart.margin.top + standardRateChart.plotHeight / 2})`}
                          >
                            Standard Rate ($)
                          </text>
                          </svg>
                          <div className="absolute right-2 top-2 flex flex-col gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setStandardRateZoomX((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))))}
                            >
                              Zoom X +
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setStandardRateZoomX((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))))}
                            >
                              Zoom X -
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setStandardRateZoomY((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))))}
                            >
                              Zoom Y +
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setStandardRateZoomY((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))))}
                            >
                              Zoom Y -
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setStandardRateZoomX(1)
                                setStandardRateZoomY(1)
                                setStandardRatePanX(0)
                                setStandardRatePanY(0)
                              }}
                            >
                              Reset
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="standard-rate-function" className="text-xs font-medium text-muted-foreground">
                        Custom function (x = web rate)
                      </Label>
                      <Input
                        id="standard-rate-function"
                        placeholder="Example: x < 100 ? 1.8 * x : x < 200 ? 1.6 * x : 1.4 * x"
                        value={standardRateFunction}
                        onChange={(e) => setStandardRateFunction(e.target.value)}
                      />
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 sm:gap-3">
                        <Button type="button" variant="outline" size="sm">
                          Rounding (Standard Rate)
                        </Button>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="standard-rate-rounding-enabled"
                            checked={standardRateRoundingEnabled}
                            onCheckedChange={(checked: unknown) => setStandardRateRoundingEnabled(Boolean(checked))}
                          />
                          <label htmlFor="standard-rate-rounding-enabled" className="text-sm">
                            Enable
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <label htmlFor="standard-rate-rounding-offset" className="text-xs text-muted-foreground">
                            Round to
                          </label>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              $
                            </span>
                            <Input
                              id="standard-rate-rounding-offset"
                              type="text"
                              inputMode="decimal"
                              value={standardRateRoundingOffsetInput}
                              onChange={(e) => handleStandardRateRoundingOffsetChange(e.target.value)}
                              className="h-8 w-[120px] pl-5"
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">($0.00 to $1.00)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      onClick={() => {
                        toast.success("Standard rate function saved.")
                        setStandardRateOpen(false)
                      }}
                    >
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
                  </Dialog>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setLoadConfigOpen(true)}
                  disabled={isSavingProcessConfig || isLoadingProcessConfig || deletingProcessConfigId !== null}
                  title="Save configuration"
                >
                  {isSavingProcessConfig ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => csvUploadInputRef.current?.click()}
                >
                  Upload CSV
                </Button>
              </div>
              {file ? <div className="text-xs text-muted-foreground">Selected: {file.name}</div> : null}
            </div>
          </div>
        </DialogHeader>

        {!reviewData ? (
          <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-hidden pr-1">
            <div className="flex w-full flex-wrap items-start gap-2">
              <span className="text-sm font-medium">Adjusters</span>
              <Button type="button" size="sm" variant="outline" onClick={functionDialog.handleOpen}>
                Competitive
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowLevels(true)}
              >
                Levels
              </Button>
              <div className="ml-auto flex shrink-0 flex-col items-end gap-1 self-start">
                <Button type="button" size="sm" className="h-8" variant="outline" onClick={() => setStandardRateOpen(true)}>
                  Standard Rate Function
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowMapping(true)} disabled={mappingPipelineNames.length === 0}>
                  Mapping
                </Button>
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-3">
              {popupAdjusters.length === 0 ? (
                <p className="text-xs text-muted-foreground">No competitive adjusters configured.</p>
              ) : null}
              <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {popupAdjusters.map((adj: Adjuster, idx: number) => (
                  <li key={`${adj.type}-${idx}`} className="h-full">
                    {adj.type === "competitive" ? (
                      <CompetitiveAdjusterCard
                        adjuster={adj as CompetitivePriceAdjuster}
                        stepNumber={idx + 1}
                        totalSteps={totalProcessAdjusterSteps}
                        onRemove={() => handleRemovePopupAdjuster(idx)}
                          showVariable
                      />
                    ) : adj.type === "function" ? (
                      <FunctionAdjusterCard
                        adjuster={adj as FunctionBasedAdjuster}
                        stepNumber={idx + 1}
                        totalSteps={totalProcessAdjusterSteps}
                        onRemove={() => handleRemovePopupAdjuster(idx)}
                      />
                    ) : (
                      <TemporalAdjusterCard
                        adjuster={adj as TemporalAdjuster}
                        stepNumber={idx + 1}
                        totalSteps={totalProcessAdjusterSteps}
                        onRemove={() => handleRemovePopupAdjuster(idx)}
                      />
                    )}
                  </li>
                ))}
                {showLevelsAdjusterPreview ? (
                  <li className="h-full">
                    <LevelsAdjusterPreviewCard
                      amenityAdjuster={amenityAdjuster}
                      onRemove={handleRemoveLevelsAdjuster}
                      stepNumber={popupAdjusters.length + 1}
                      totalSteps={totalProcessAdjusterSteps}
                    />
                  </li>
                ) : null}
              </ol>
            </div>
          </div>
        ) : (
          <div className="space-y-3 flex-1 min-h-0 overflow-auto pr-1">
            <div className="flex w-full flex-wrap items-start gap-2">
              <span className="text-sm font-medium">Adjusters</span>
              <Button type="button" size="sm" variant="outline" onClick={functionDialog.handleOpen}>
                Competitive
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowLevels(true)}
              >
                Levels
              </Button>
              <div className="ml-auto flex shrink-0 flex-col items-end gap-1 self-start">
                <Button type="button" size="sm" className="h-8" variant="outline" onClick={() => setStandardRateOpen(true)}>
                  Standard Rate Function
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowMapping(true)} disabled={mappingPipelineNames.length === 0}>
                  Mapping
                </Button>
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-3">
              {popupAdjusters.length === 0 ? (
                <p className="text-xs text-muted-foreground">No competitive adjusters configured.</p>
              ) : null}
              <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {popupAdjusters.map((adj: Adjuster, idx: number) => (
                  <li key={`${adj.type}-${idx}`} className="h-full">
                    {adj.type === "competitive" ? (
                      <CompetitiveAdjusterCard
                        adjuster={adj as CompetitivePriceAdjuster}
                        stepNumber={idx + 1}
                        totalSteps={totalProcessAdjusterSteps}
                        onRemove={() => handleRemovePopupAdjuster(idx)}
                          showVariable
                      />
                    ) : adj.type === "function" ? (
                      <FunctionAdjusterCard
                        adjuster={adj as FunctionBasedAdjuster}
                        stepNumber={idx + 1}
                        totalSteps={totalProcessAdjusterSteps}
                        onRemove={() => handleRemovePopupAdjuster(idx)}
                      />
                    ) : (
                      <TemporalAdjusterCard
                        adjuster={adj as TemporalAdjuster}
                        stepNumber={idx + 1}
                        totalSteps={totalProcessAdjusterSteps}
                        onRemove={() => handleRemovePopupAdjuster(idx)}
                      />
                    )}
                  </li>
                ))}
                {showLevelsAdjusterPreview ? (
                  <li className="h-full">
                    <LevelsAdjusterPreviewCard
                      amenityAdjuster={amenityAdjuster}
                      onRemove={handleRemoveLevelsAdjuster}
                      stepNumber={popupAdjusters.length + 1}
                      totalSteps={totalProcessAdjusterSteps}
                    />
                  </li>
                ) : null}
              </ol>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setAllApprovals(true)}>
                Approve all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setAllApprovals(false)}>
                Reject all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setReviewData(null)
                  setApprovedChanges({})
                  setTraceDialogRow(null)
                }}
              >
                Choose another CSV
              </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-auto rounded-md border">
              {reviewData.reviewRows.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No changes were produced by pricing algorithms. You can still download the processed CSV.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Trace</th>
                      {renderReviewSortableHeader("Row", "rowIndex")}
                      {renderReviewSortableHeader("Facility", "facilityName", "Maps from CSV Facility Name and matches calculated client_location (with city/location fallbacks).")}
                      {renderReviewSortableHeader("Unit", "unitSize", "Maps from CSV Size/Unit Size and matches calculated unit_dimensions. If unit_area is used, matching uses CSV Area instead.")}
                      {renderReviewSortableHeader("Total Units", "totalUnits")}
                      {renderReviewSortableHeader("Occupied", "occupied")}
                      {renderReviewSortableHeader("Available", "available")}
                      {renderReviewSortableHeader("Vacancy", "vacancy")}
                      {renderReviewSortableHeader("Occupancy", "occupancy")}
                      {renderReviewSortableHeader("Elevator Access", "hasElevatorAccessAmenity", "Derived from CSV Unit Amenities text containing elevator access terms.")}
                      {renderReviewSortableHeader("Drive Up", "hasDriveUpAmenity", "Derived from CSV Unit Amenities drive-up text, also used for has_drive_up_access matching when enabled.")}
                      {renderReviewSortableHeader("1st Floor", "hasFirstFloorAmenity", "Derived from CSV Unit Amenities text containing 1st floor / first floor.")}
                      {renderReviewSortableHeader("Climate Controlled", "hasClimateControlledAmenity", "Derived from CSV Unit Amenities climate-controlled text.")}
                      {renderReviewSortableHeader("Level", "amenityLevel", "Derived from CSV Unit Amenities tier keywords: Premium, Standard, Economy.")}
                      {renderReviewSortableHeader("Current Web", "currentWebRate", "Read from CSV Current Web Rate (or Current Rent Rate fallback).")}
                      {renderReviewSortableHeader("New Web", "proposedWebRate", "Calculated from matched pipeline web price, then popup/levels adjusters and rounding are applied.")}
                      {renderReviewSortableHeader("Web Decision", "webDecision")}
                      {renderReviewSortableHeader("Current Standard", "currentStandardRate", "Read from CSV Current Standard Rate.")}
                      {renderReviewSortableHeader("New Standard", "proposedStandardRate", "Calculated from the standard-rate function using New Web as input, then standard rounding is applied.")}
                      {renderReviewSortableHeader("Standard Decision", "standardDecision")}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReviewRows.map((row: ReviewRow) => (
                      <tr key={row.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2 align-top">
                          {row.traceDetails ? (
                            <Button type="button" size="sm" variant="outline" onClick={() => openTraceDialog(row)}>
                              View
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">{row.rowIndex + 2}</td>
                        <td className="px-3 py-2 align-top">{row.facilityName || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.unitSize || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.totalUnits || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.occupied || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.available || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.vacancy || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.occupancy || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.hasElevatorAccessAmenity ? "✓" : ""}</td>
                        <td className="px-3 py-2 align-top">{row.hasDriveUpAmenity ? "✓" : ""}</td>
                        <td className="px-3 py-2 align-top">{row.hasFirstFloorAmenity ? "✓" : ""}</td>
                        <td className="px-3 py-2 align-top">{row.hasClimateControlledAmenity ? "✓" : ""}</td>
                        <td className="px-3 py-2 align-top">{row.amenityLevel || ""}</td>
                        <td className="px-3 py-2 align-top text-muted-foreground">{row.currentWebRate || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.proposedWebRate || "—"}</td>
                        <td className="px-3 py-2 align-top">
                          {row.webRateChange ? (
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={approvedChanges[row.webRateChange.id] === true ? "default" : "outline"}
                                onClick={() => setChangeApproval(row.webRateChange!.id, true)}
                              >
                                Approve
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={approvedChanges[row.webRateChange.id] === false ? "destructive" : "outline"}
                                onClick={() => setChangeApproval(row.webRateChange!.id, false)}
                              >
                                Deny
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top text-muted-foreground">{row.currentStandardRate || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.proposedStandardRate || "—"}</td>
                        <td className="px-3 py-2 align-top">
                          {row.standardRateChange ? (
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={approvedChanges[row.standardRateChange.id] === true ? "default" : "outline"}
                                onClick={() => setChangeApproval(row.standardRateChange!.id, true)}
                              >
                                Approve
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={approvedChanges[row.standardRateChange.id] === false ? "destructive" : "outline"}
                                onClick={() => setChangeApproval(row.standardRateChange!.id, false)}
                              >
                                Deny
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0">
          {!reviewData ? (
            <Button onClick={handleProcess} disabled={!file || isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isProcessing ? "Applying..." : "Apply Pricing Algorithms"}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={handleDownloadAllProcessed}>
                Download All Changes
              </Button>
              <Button type="button" onClick={handleDownloadApproved}>
                Download Approved Changes
              </Button>
            </>
          )}
        </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddFunctionAdjusterDialog
        open={functionDialog.open}
        onOpenChange={functionDialog.setOpen}
        onAdd={handleAddPopupAdjuster}
        availableVariables={csvNumericVariables.filter((name: string) => !RATE_VARIABLE_EXCLUSIONS.has(normalizeColumnKey(name)))}
        competitorData={pricingContext?.competitorData ?? []}
        clientAvailableUnits={pricingContext?.clientAvailableUnits ?? 0}
        includeAvailableUnits={false}
      />

      <Dialog open={Boolean(traceDialogRow)} onOpenChange={(nextOpen) => { if (!nextOpen) setTraceDialogRow(null) }}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Trace details</DialogTitle>
            <DialogDescription>
              {traceDialogRow?.traceDetails
                ? `Pipeline: ${traceDialogRow.traceDetails.pipelineName} · Row ${traceDialogRow.rowIndex + 2}`
                : "No trace details available."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {traceDialogRow?.traceDetails ? (
              <>
                <div className="text-sm">
                  <span className="font-medium">Traced price: </span>
                  <span>{traceDialogRow.traceDetails.price || "—"}</span>
                </div>
                <div className="max-h-[360px] overflow-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Competitor column</th>
                        <th className="px-3 py-2 text-left font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traceDialogRow.traceDetails.comboMapEntries.map((entry) => (
                        <tr key={entry.key} className="border-b last:border-b-0">
                          <td className="px-3 py-2 align-top font-mono text-xs">{entry.key}</td>
                          <td className="px-3 py-2 align-top">{entry.value || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No trace details available for this row.</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTraceDialogRow(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={loadConfigOpen} onOpenChange={setLoadConfigOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Config Settings</DialogTitle>
            <DialogDescription>Load, save, or clear your Process CSV configuration.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              onClick={handleSaveProcessCsvConfig}
              disabled={isSavingProcessConfig || isLoadingProcessConfig || deletingProcessConfigId !== null}
            >
              {isSavingProcessConfig ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Save New Config
            </Button>
            <Button type="button" variant="outline" onClick={handleClearProcessCsvConfig}>
              Clear Current Config
            </Button>
          </div>
          <div className="max-h-[360px] overflow-auto space-y-2">
            {availableProcessConfigs.map((config) => (
              <div key={config.id ?? config.name} className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 justify-start"
                  onClick={() => handleSelectProcessCsvConfig(config)}
                >
                  {config.name || "Unnamed configuration"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSavingProcessConfig || overwritingProcessConfigId === (config.id ?? (config.name || "Unnamed configuration"))}
                  onClick={() => handleOverwriteProcessCsvConfig(config)}
                >
                  {overwritingProcessConfigId === (config.id ?? (config.name || "Unnamed configuration")) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Save Over"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={!config.id || deletingProcessConfigId === config.id}
                  onClick={() => handleDeleteProcessCsvConfig(config)}
                >
                  {deletingProcessConfigId === config.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Delete"
                  )}
                </Button>
              </div>
            ))}
            {availableProcessConfigs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No configurations available.</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLoadConfigOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMapping} onOpenChange={handleMappingDialogOpenChange}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Mapping</DialogTitle>
          </DialogHeader>
          <div className="max-h-[62vh] overflow-y-auto pr-1">
            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">Mapping groups</div>
                <Button type="button" size="sm" variant="outline" onClick={addMappingGroup} disabled={mappingPipelineNames.length === 0}>
                  Add Group
                </Button>
              </div>
              {mappingGroups.length > 0 ? (
                <>
                  <div className="sticky top-0 z-10 -mx-3 mb-3 border-b bg-background/95 px-3 pb-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <div className="mt-2 space-y-1">
                      {mappingGroups.map((group) => {
                        const isActive = group.id === selectedMappingGroupId
                        return (
                          <Button
                            key={group.id}
                            type="button"
                            size="sm"
                            variant={isActive ? "default" : "outline"}
                            className="h-8 w-full justify-start"
                            onClick={() => setSelectedMappingGroupId(group.id)}
                          >
                            {group.name || "Unnamed group"}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Selected group</Label>
                      <select
                        className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                        value={selectedMappingGroupId}
                        onChange={(e) => setSelectedMappingGroupId(e.target.value)}
                      >
                        {mappingGroups.map((group) => (
                          <option key={group.id} value={group.id}>{group.name || "Unnamed group"}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Group name</Label>
                      <Input
                        className="mt-1 h-9"
                        placeholder="Location + Size"
                        value={selectedMappingGroup?.name ?? ""}
                        onChange={(e) => selectedMappingGroup && updateMappingGroup(selectedMappingGroup.id, { name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Pipeline</Label>
                      <select
                        className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                        value={selectedMappingGroup?.pipelineName ?? ""}
                        onChange={(e) => selectedMappingGroup && updateMappingGroup(selectedMappingGroup.id, { pipelineName: e.target.value })}
                      >
                        {mappingPipelineNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Fallback group</Label>
                      <select
                        className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                        value={selectedMappingGroup?.fallbackGroupId ?? ""}
                        onChange={(e) => selectedMappingGroup && updateMappingGroup(selectedMappingGroup.id, { fallbackGroupId: e.target.value })}
                      >
                        <option value="">None</option>
                        {mappingGroups.filter((group) => group.id !== selectedMappingGroup?.id).map((group) => (
                          <option key={group.id} value={group.id}>{group.name || "Unnamed group"}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">Column mappings</div>
                      <Button type="button" size="sm" variant="outline" onClick={() => selectedMappingGroup && addGroupColumnMapping(selectedMappingGroup.id)}>
                        Add Column Mapping
                      </Button>
                    </div>
                    {(selectedMappingGroup?.columnMappings ?? []).map((mapping) => (
                      <div key={mapping.id} className="rounded-md border p-2 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                          <Input
                            className="h-9"
                            placeholder="CSV column"
                            value={mapping.csvColumn}
                            onChange={(e) => selectedMappingGroup && updateGroupColumnMapping(selectedMappingGroup.id, mapping.id, { csvColumn: e.target.value })}
                          />
                          <Input
                            className="h-9"
                            placeholder="Pipeline column"
                            value={mapping.competitorColumn}
                            onChange={(e) => selectedMappingGroup && updateGroupColumnMapping(selectedMappingGroup.id, mapping.id, { competitorColumn: e.target.value as MappingGroupCompetitorColumn })}
                          />
                          <div className="flex gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => selectedMappingGroup && addGroupColumnMappingPair(selectedMappingGroup.id, mapping.id)}>
                              Add Pair
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => selectedMappingGroup && removeGroupColumnMapping(selectedMappingGroup.id, mapping.id)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                        {(mapping.pairs ?? []).map((pair) => (
                          <div key={pair.id} className="rounded-md border border-dashed p-2 space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <Input
                                className="h-9 rounded-full"
                                placeholder="CSV value"
                                value={pair.exactMatch || pair.csvFirstTwoDimensions ? "" : pair.csvValue}
                                disabled={pair.exactMatch || pair.csvFirstTwoDimensions}
                                onChange={(e) => selectedMappingGroup && updateGroupColumnMappingPair(selectedMappingGroup.id, mapping.id, pair.id, { csvValue: e.target.value })}
                              />
                              <Input
                                className="h-9 rounded-full"
                                placeholder="Pipeline Value"
                                value={pair.exactMatch || pair.csvFirstTwoDimensions ? "" : pair.pipelineValue}
                                disabled={pair.exactMatch || pair.csvFirstTwoDimensions}
                                onChange={(e) => selectedMappingGroup && updateGroupColumnMappingPair(selectedMappingGroup.id, mapping.id, pair.id, { pipelineValue: e.target.value })}
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs">
                              <label className="inline-flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={pair.exactMatch}
                                  onChange={(e) => selectedMappingGroup && updateGroupColumnMappingPair(selectedMappingGroup.id, mapping.id, pair.id, { exactMatch: e.target.checked })}
                                />
                                <span>Exact match between CSV and pipeline columns</span>
                              </label>
                              <label className="inline-flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={pair.csvFirstTwoDimensions}
                                  onChange={(e) => selectedMappingGroup && updateGroupColumnMappingPair(selectedMappingGroup.id, mapping.id, pair.id, { csvFirstTwoDimensions: e.target.checked })}
                                />
                                <span>CSV first two dimensions only</span>
                              </label>
                              <Button type="button" size="sm" variant="outline" onClick={() => selectedMappingGroup && removeGroupColumnMappingPair(selectedMappingGroup.id, mapping.id, pair.id)}>
                                Remove Pair
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <Button type="button" size="sm" variant="destructive" onClick={() => selectedMappingGroup && removeMappingGroup(selectedMappingGroup.id)}>
                      Delete Group
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No mapping groups yet. Add a group to configure grouped mapping behavior.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleMappingDialogOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLevels} onOpenChange={setShowLevels}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Levels</DialogTitle>
            <DialogDescription>
              Configure Unit Amenities adjustments (Premium, Standard, Economy).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-muted-foreground">Apply to:</span>
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={amenityAdjuster.applyToWeb}
                  onChange={(e) => setAmenityAdjuster((prev) => ({ ...prev, applyToWeb: e.target.checked }))}
                />
                <span>Web rate</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="font-medium text-muted-foreground">Tier</div>
              <div className="font-medium text-muted-foreground">Multiplier</div>
              <div className="font-medium text-muted-foreground">Offset</div>

              {([
                { key: "premium", label: "Premium" },
                { key: "standard", label: "Standard" },
                { key: "economy", label: "Economy" },
              ] as const).map((tier) => (
                <div key={tier.key} className="contents">
                  <div className="flex items-center">{tier.label}</div>
                  <div>
                    <Input
                      className="h-8"
                      placeholder={tier.key === "premium" ? "1.05" : tier.key === "standard" ? "1" : "0.95"}
                      value={amenityAdjuster[tier.key].multiplier}
                      onChange={(e) =>
                        setAmenityAdjuster((prev: AmenityAdjusterState) => ({
                          ...prev,
                          [tier.key]: { ...prev[tier.key], multiplier: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Input
                      className="h-8"
                      placeholder={tier.key === "economy" ? "-5" : tier.key === "standard" ? "0" : "5"}
                      value={amenityAdjuster[tier.key].offset}
                      onChange={(e) =>
                        setAmenityAdjuster((prev: AmenityAdjusterState) => ({
                          ...prev,
                          [tier.key]: { ...prev[tier.key], offset: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowLevels(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Process CSV info"
          >
            <Info className="h-4 w-4" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="text-xs">
            Use this for pricing CSVs. Requires combinatoric filters on
            <strong> client_location</strong> and <strong>unit_dimensions</strong> or <strong>unit_area</strong>.
            <br />
            For <strong>unit_area</strong>, CSV matching uses the <strong>Area</strong> column directly.
            Optional combinatoric <strong>has_drive_up_access</strong> maps from CSV Unit Amenities (Drive Up).
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
