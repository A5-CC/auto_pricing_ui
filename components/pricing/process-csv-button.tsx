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
import type { Adjuster } from '@/lib/adjusters';
import { evaluateSafeFunction } from "@/lib/adjusters";
import type { E1DataRow } from "@/lib/api/types";
import { FileSpreadsheet, Info, Loader2, Trash2 } from "lucide-react";
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
  facilityName: string
  unitSize: string
  totalUnits: string
  occupied: string
  available: string
  vacancy: string
  occupancy: string
  amenities: string
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

type ProcessedCsvResult = ParsedCsv & {
  traceByCsvRowIndex: Record<number, number>
}


const DEFAULT_STANDARD_RATE_FUNCTION = "x < 100 ? 1.8x : x < 200 ? 1.6x + 20 : 1.4x + 60"

const REVIEWABLE_RATE_COLUMNS = new Set(["newwebrate", "newstandardrate", "newrentrate"])
const CURRENT_WEB_RATE_COLUMNS = new Set(["currentwebrate", "currentrentrate"])
const CURRENT_STANDARD_RATE_COLUMNS = new Set(["currentstandardrate"])
const FACILITY_NAME_COLUMNS = new Set(["facilityname"])
const UNIT_SIZE_COLUMNS = new Set(["size", "unitsize", "unitdimensions"])
const AREA_COLUMNS = new Set(["area", "unitarea", "sqft", "squarefeet"])
const UNIT_TYPE_COLUMNS = new Set(["unittype", "unittypecode", "unittypecategory"])
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
  traceByCsvRowIndex?: Record<number, number>
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

    const baseRow: ReviewRow = existing ?? {
      id: `row-${change.rowIndex}`,
      rowIndex: change.rowIndex,
      traceCalculatedRowIndex: Number.isFinite(traceByCsvRowIndex?.[change.rowIndex])
        ? Number(traceByCsvRowIndex?.[change.rowIndex])
        : null,
      traceTargetId: Number.isFinite(traceByCsvRowIndex?.[change.rowIndex])
        ? `calculated-price-row-${Number(traceByCsvRowIndex?.[change.rowIndex])}`
        : null,
      facilityName: getCellValue(originalRow, facilityNameIndex) || getCellValue(processedRow, facilityNameIndex),
      unitSize: getCellValue(originalRow, unitSizeIndex) || getCellValue(processedRow, unitSizeIndex),
      totalUnits: getCellValue(originalRow, totalUnitsIndex) || getCellValue(processedRow, totalUnitsIndex),
      occupied: getCellValue(originalRow, occupiedIndex) || getCellValue(processedRow, occupiedIndex),
      available: getCellValue(originalRow, availableIndex) || getCellValue(processedRow, availableIndex),
      vacancy: getCellValue(originalRow, vacancyIndex) || getCellValue(processedRow, vacancyIndex),
      occupancy: getCellValue(originalRow, occupancyIndex) || getCellValue(processedRow, occupancyIndex),
      amenities: getCellValue(originalRow, amenitiesIndex) || getCellValue(processedRow, amenitiesIndex),
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
  standardRateFunction?: string
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

  const locationIndex = findColumnIndex(headers, LOCATION_COLUMNS)
  const unitSizeIndex = findColumnIndex(headers, UNIT_SIZE_COLUMNS)
  const areaIndex = findColumnIndex(headers, AREA_COLUMNS)
  const unitTypeIndex = findColumnIndex(headers, UNIT_TYPE_COLUMNS)
  const unitAmenitiesIndex = findColumnIndex(headers, UNIT_AMENITIES_COLUMNS)
  let newWebRateIndex = findColumnIndex(headers, NEW_WEB_RATE_COLUMNS)
  let newStandardRateIndex = findColumnIndex(headers, NEW_STANDARD_RATE_COLUMNS)
  const newRentRateIndex = findColumnIndex(headers, NEW_RENT_RATE_COLUMNS)
  let matchedUnitAreaIndex = findColumnIndex(headers, MATCHED_UNIT_AREA_COLUMNS)

  const hasUnitAreaRowsPre = calculatedRows.some((row) => Boolean(getAreaLookupToken(row.comboMap.unit_area)))

  if (locationIndex < 0) {
    throw new Error("CSV must include a facility/location column to map frontend pricing.")
  }

  if (hasUnitAreaRowsPre && areaIndex < 0) {
    throw new Error("CSV must include an Area column to match unit_area pipelines.")
  }

  if (!hasUnitAreaRowsPre && unitSizeIndex < 0) {
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
  if (hasAmenityAdjustments && unitAmenitiesIndex < 0) {
    throw new Error("CSV must include a Unit Amenities column to apply amenity adjustments.")
  }

  if (matchedUnitAreaIndex < 0) {
    headers.push("Matched Unit Area")
    matchedUnitAreaIndex = headers.length - 1
    for (const row of rows) row.push("")
  }

  const priceLookup = new Map<string, { price: number; calculatedRowIndex: number }>()
  const cityPriceLookup = new Map<string, { price: number; calculatedRowIndex: number }>()
  const areaLookup = new Map<string, Array<{ area: number; price: number; calculatedRowIndex: number }>>()
  const traceByCsvRowIndex: Record<number, number> = {}
  let hasUnitAreaRows = false

  const areaBucketKey = (place: string, driveUpAccess: string) => `${place}__${driveUpAccess || ""}`
  const setLookupIfMissing = (
    map: Map<string, { price: number; calculatedRowIndex: number }>,
    key: string,
    value: { price: number; calculatedRowIndex: number }
  ) => {
    if (!map.has(key)) map.set(key, value)
  }

  const addAreaCandidate = (bucket: string, area: number, price: number, calculatedRowIndex: number) => {
    const next = areaLookup.get(bucket) ?? []
    next.push({ area, price, calculatedRowIndex })
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
    const driveUpAccess = normalizeDriveUpAccessValue(calculatedRow.comboMap.has_drive_up_access)
    if (!location || (!dimensionToken && !areaToken)) continue
    const webPrice = applyConfiguredRounding(calculatedRow.price, webRounding)
    const price = webPrice
    const pricedRow = { price, calculatedRowIndex }
    if (dimensionToken) {
      setLookupIfMissing(priceLookup, buildPriceLookupKey(location, dimensionToken, driveUpAccess), pricedRow)
      if (locationKey) setLookupIfMissing(priceLookup, buildPriceLookupKey(locationKey, dimensionToken, driveUpAccess), pricedRow)
      if (city) setLookupIfMissing(cityPriceLookup, buildPriceLookupKey(city, dimensionToken, driveUpAccess), pricedRow)
      if (cityKey) setLookupIfMissing(cityPriceLookup, buildPriceLookupKey(cityKey, dimensionToken, driveUpAccess), pricedRow)
    }
    if (areaToken) {
      setLookupIfMissing(priceLookup, buildPriceLookupKey(location, areaToken, driveUpAccess), pricedRow)
      if (locationKey) setLookupIfMissing(priceLookup, buildPriceLookupKey(locationKey, areaToken, driveUpAccess), pricedRow)
      if (city) setLookupIfMissing(cityPriceLookup, buildPriceLookupKey(city, areaToken, driveUpAccess), pricedRow)
      if (cityKey) setLookupIfMissing(cityPriceLookup, buildPriceLookupKey(cityKey, areaToken, driveUpAccess), pricedRow)

      const parsedArea = parseAreaTokenValue(areaToken)
      if (parsedArea !== null) {
        addAreaCandidate(areaBucketKey(location, driveUpAccess), parsedArea, price, calculatedRowIndex)
        addAreaCandidate(areaBucketKey(location, ""), parsedArea, price, calculatedRowIndex)
        if (locationKey) {
          addAreaCandidate(areaBucketKey(locationKey, driveUpAccess), parsedArea, price, calculatedRowIndex)
          addAreaCandidate(areaBucketKey(locationKey, ""), parsedArea, price, calculatedRowIndex)
        }
        if (city) {
          addAreaCandidate(areaBucketKey(city, driveUpAccess), parsedArea, price, calculatedRowIndex)
          addAreaCandidate(areaBucketKey(city, ""), parsedArea, price, calculatedRowIndex)
        }
        if (cityKey) {
          addAreaCandidate(areaBucketKey(cityKey, driveUpAccess), parsedArea, price, calculatedRowIndex)
          addAreaCandidate(areaBucketKey(cityKey, ""), parsedArea, price, calculatedRowIndex)
        }
      }
    }
  }

  if (priceLookup.size === 0) {
    throw new Error("No frontend price rows available. Make sure location and unit_dimensions or unit_area are combinatoric in the pipeline table.")
  }

  let matchedRows = 0
  for (let csvRowIndex = 0; csvRowIndex < rows.length; csvRowIndex++) {
    const row = rows[csvRowIndex]
    const csvRow = rowToRecord(headers, row)
    const location = normalizeLocationKey(getCellValue(row, locationIndex))
    const locationKey = location
    const city = normalizeCityValue(getCellValue(row, locationIndex))
    const cityKey = normalizeLocationKey(city)
    const dimensionToken = unitSizeIndex >= 0 ? getDimensionLookupToken(getCellValue(row, unitSizeIndex)) : ""
    const areaToken = areaIndex >= 0 ? getAreaLookupToken(getCellValue(row, areaIndex)) : ""
    const driveUpAccess = unitTypeIndex >= 0 ? normalizeDriveUpAccessValue(getCellValue(row, unitTypeIndex)) : ""
    let matchedAreaValue = ""
    const allowDimensionMatching = !hasUnitAreaRows

    let mappedMatch =
      (areaToken && driveUpAccess ? priceLookup.get(buildPriceLookupKey(location, areaToken, driveUpAccess)) : undefined) ??
      (areaToken ? priceLookup.get(buildPriceLookupKey(location, areaToken)) : undefined) ??
      (areaToken && driveUpAccess && locationKey ? priceLookup.get(buildPriceLookupKey(locationKey, areaToken, driveUpAccess)) : undefined) ??
      (areaToken && locationKey ? priceLookup.get(buildPriceLookupKey(locationKey, areaToken)) : undefined) ??
      (areaToken && driveUpAccess && city ? cityPriceLookup.get(buildPriceLookupKey(city, areaToken, driveUpAccess)) : undefined) ??
      (areaToken && city ? cityPriceLookup.get(buildPriceLookupKey(city, areaToken)) : undefined) ??
      (areaToken && driveUpAccess && cityKey ? cityPriceLookup.get(buildPriceLookupKey(cityKey, areaToken, driveUpAccess)) : undefined) ??
      (areaToken && cityKey ? cityPriceLookup.get(buildPriceLookupKey(cityKey, areaToken)) : undefined) ??
      (allowDimensionMatching && dimensionToken && driveUpAccess ? priceLookup.get(buildPriceLookupKey(location, dimensionToken, driveUpAccess)) : undefined) ??
      (allowDimensionMatching && dimensionToken ? priceLookup.get(buildPriceLookupKey(location, dimensionToken)) : undefined) ??
      (allowDimensionMatching && dimensionToken && driveUpAccess && locationKey ? priceLookup.get(buildPriceLookupKey(locationKey, dimensionToken, driveUpAccess)) : undefined) ??
      (allowDimensionMatching && dimensionToken && locationKey ? priceLookup.get(buildPriceLookupKey(locationKey, dimensionToken)) : undefined) ??
      (allowDimensionMatching && dimensionToken && driveUpAccess && city ? cityPriceLookup.get(buildPriceLookupKey(city, dimensionToken, driveUpAccess)) : undefined) ??
      (allowDimensionMatching && dimensionToken && city ? cityPriceLookup.get(buildPriceLookupKey(city, dimensionToken)) : undefined)
      ?? (allowDimensionMatching && dimensionToken && driveUpAccess && cityKey ? cityPriceLookup.get(buildPriceLookupKey(cityKey, dimensionToken, driveUpAccess)) : undefined)
      ?? (allowDimensionMatching && dimensionToken && cityKey ? cityPriceLookup.get(buildPriceLookupKey(cityKey, dimensionToken)) : undefined)

    if (mappedMatch !== undefined && areaToken) {
      matchedAreaValue = areaToken.replace(/^area:/, "")
    }

    if (mappedMatch === undefined && areaToken) {
      const targetArea = parseAreaTokenValue(areaToken)
      if (targetArea !== null) {
        const candidateBuckets = [
          areaBucketKey(location, driveUpAccess),
          areaBucketKey(location, ""),
          areaBucketKey(city, driveUpAccess),
          areaBucketKey(city, ""),
        ]

        let best: { area: number; price: number; delta: number; calculatedRowIndex: number } | null = null
        for (const bucket of candidateBuckets) {
          if (!bucket.startsWith("__")) {
            const candidates = areaLookup.get(bucket) ?? []
            for (const c of candidates) {
              const delta = Math.abs(c.area - targetArea)
              if (delta > 3) continue
              if (!best || delta < best.delta) {
                best = { area: c.area, price: c.price, delta, calculatedRowIndex: c.calculatedRowIndex }
              }
            }
            if (best && best.delta === 0) break
          }
        }

        if (best) {
          mappedMatch = { price: best.price, calculatedRowIndex: best.calculatedRowIndex }
          matchedAreaValue = Number.isInteger(best.area) ? String(Math.trunc(best.area)) : String(best.area)
        }
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
    matchedRows += 1
  }

  if (matchedRows === 0) {
    throw new Error(hasUnitAreaRows
      ? "No uploaded CSV rows matched the current pipeline table by location + area."
      : "No uploaded CSV rows matched the current pipeline table by location + size."
    )
  }

  return { headers, rows, traceByCsvRowIndex }
}

export function ProcessCsvButton({ filters, calculatedRows = [], calculatedRowsBundle, rounding, pricingContext, inline = false }: ProcessCsvButtonProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [approvedChanges, setApprovedChanges] = useState<Record<string, boolean>>({})
  const [traceSelections, setTraceSelections] = useState<Record<string, boolean>>({})
  const [popupAdjusters, setPopupAdjusters] = useState<Adjuster[]>([])
  const [showLevels, setShowLevels] = useState(false)
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
  const [amenityAdjuster, setAmenityAdjuster] = useState<AmenityAdjusterState>({
    applyToWeb: true,
    premium: { multiplier: "1", offset: "0" },
    standard: { multiplier: "1", offset: "0" },
    economy: { multiplier: "1", offset: "0" },
  })
  const [originalParsed, setOriginalParsed] = useState<ParsedCsv | null>(null)
  const [csvNumericVariables, setCsvNumericVariables] = useState<string[]>([])

  const functionDialog = useAdjusterDialog()

  const resolvedCalculatedRows = useMemo<ResolvedCalculatedRows>(() => {
    const bundle = calculatedRowsBundle
    if (!bundle || bundle.length === 0) {
      return { rows: calculatedRows, error: null }
    }

    const merged: CalculatedPriceRow[] = []
    const ownerByKey = new Map<string, string>()

    for (const entry of bundle) {
      const pipelineName = entry.pipelineName || "Unnamed pipeline"
      for (const row of entry.rows ?? []) {
        if (typeof row?.price !== "number" || Number.isNaN(row.price)) continue

        const location = normalizeMatchValue(row.comboMap.client_location)
        const dimensionToken = getDimensionLookupToken(row.comboMap.unit_dimensions)
        const areaToken = getAreaLookupToken(row.comboMap.unit_area)
        const driveUpAccess = normalizeDriveUpAccessValue(row.comboMap.has_drive_up_access)

        const keyToken = areaToken || dimensionToken
        if (!location || !keyToken) continue

        const key = buildPriceLookupKey(location, keyToken, driveUpAccess)
        const existingOwner = ownerByKey.get(key)
        if (existingOwner && existingOwner !== pipelineName) {
          return {
            rows: [],
            error: `Pipeline overlap detected between "${existingOwner}" and "${pipelineName}" for the same location + size combination. Please ensure selected pipelines do not intersect.`,
          }
        }

        ownerByKey.set(key, pipelineName)
        merged.push(row)
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
  // - has_drive_up_access: optional drive-up match via CSV Unit Type
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
    setTraceSelections({})
    setPopupAdjusters([])
    setAmenityAdjuster({
      applyToWeb: true,
      premium: { multiplier: "1", offset: "0" },
      standard: { multiplier: "1", offset: "0" },
      economy: { multiplier: "1", offset: "0" },
    })
    setOriginalParsed(null)
    setCsvNumericVariables([])
  }

  const buildDefaultApprovals = (changes: CsvRateChange[]) => {
    const approvals: Record<string, boolean> = {}
    for (const change of changes) approvals[change.id] = true
    return approvals
  }

  const buildDefaultTraceSelections = (rows: ReviewRow[]) => {
    const selections: Record<string, boolean> = {}
    for (const row of rows) selections[row.id] = false
    return selections
  }

  const jumpToTraceTarget = (targetId: string | null) => {
    if (!targetId) return
    const target = document.getElementById(targetId)
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
  }

  const clearCalculatedTraceHighlights = () => {
    const rows = document.querySelectorAll('tr[data-calculated-row-index]')
    rows.forEach((row) => {
      const rowEl = row as HTMLElement
      rowEl.style.backgroundColor = ""
      rowEl.style.boxShadow = ""
      const cells = rowEl.querySelectorAll("td")
      cells.forEach((cell) => {
        const cellEl = cell as HTMLElement
        cellEl.style.outline = ""
        cellEl.style.outlineOffset = ""
        cellEl.style.backgroundColor = ""
      })
    })
  }

  const applyCalculatedTraceHighlights = (targetIds: string[]) => {
    clearCalculatedTraceHighlights()
    for (const id of targetIds) {
      const row = document.getElementById(id)
      if (!row) continue
      const rowEl = row as HTMLElement
      rowEl.style.backgroundColor = "rgba(59, 130, 246, 0.10)"
      rowEl.style.boxShadow = "inset 0 0 0 1px rgba(59, 130, 246, 0.45)"

      const cells = rowEl.querySelectorAll("td")
      if (cells.length > 0) {
        const firstCell = cells[0] as HTMLElement
        firstCell.style.outline = "2px solid rgba(59, 130, 246, 0.75)"
        firstCell.style.outlineOffset = "-2px"
        firstCell.style.backgroundColor = "rgba(59, 130, 246, 0.14)"

        const priceCell = cells[cells.length - 1] as HTMLElement
        priceCell.style.outline = "2px solid rgba(59, 130, 246, 0.75)"
        priceCell.style.outlineOffset = "-2px"
        priceCell.style.backgroundColor = "rgba(59, 130, 246, 0.14)"
      }
    }
  }

  const toggleTraceSelection = (row: ReviewRow) => {
    setTraceSelections((prev) => {
      const nextChecked = !Boolean(prev[row.id])
      if (nextChecked) jumpToTraceTarget(row.traceTargetId)
      return { ...prev, [row.id]: nextChecked }
    })
  }

  const setAllTraceSelections = (checked: boolean) => {
    if (!reviewData) return
    const next: Record<string, boolean> = {}
    for (const row of reviewData.reviewRows) {
      next[row.id] = checked
    }
    setTraceSelections(next)
  }

  useEffect(() => {
    if (!reviewData) {
      clearCalculatedTraceHighlights()
      return
    }

    const selectedTargetIds = reviewData.reviewRows
      .filter((row) => Boolean(traceSelections[row.id]) && Boolean(row.traceTargetId))
      .map((row) => row.traceTargetId as string)

    applyCalculatedTraceHighlights(selectedTargetIds)

    return () => {
      clearCalculatedTraceHighlights()
    }
  }, [traceSelections, reviewData])

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
    )
    const headers = processed.headers.length ? processed.headers : original.headers
    const changes = buildChanges(original, processed)
    const reviewRows = buildReviewRows(original, processed, changes, processed.traceByCsvRowIndex)
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
    setTraceSelections(buildDefaultTraceSelections(reviewRows))
  }, [
    file?.name,
    resolvedCalculatedRows.error,
    resolvedCalculatedRows.rows,
    effectiveRounding,
    resolvedAmenityAdjuster,
    standardRateFunction,
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

  useEffect(() => {
    if (!originalParsed) return
    try {
      rebuildReviewFromOriginal(originalParsed, popupAdjusters)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to apply adjustments")
    }
  }, [amenityAdjuster, originalParsed, popupAdjusters, rebuildReviewFromOriginal])

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
      )

      if (original.headers.length === 0 || processed.headers.length === 0) {
        throw new Error("CSV appears empty or invalid. Please check the input file.")
      }

      const headers = processed.headers.length ? processed.headers : original.headers
      const changes = buildChanges(original, processed)
      const reviewRowsWithTrace = buildReviewRows(original, processed, changes, processed.traceByCsvRowIndex)
      const nextReviewData: ReviewData = {
        fileName: file.name,
        headers,
        originalRows: original.rows,
        processedRows: processed.rows,
        changes,
        reviewRows: reviewRowsWithTrace,
      }

      setApprovedChanges(buildDefaultApprovals(changes))
      setTraceSelections(buildDefaultTraceSelections(reviewRowsWithTrace))
      setReviewData(nextReviewData)
      toast.success("Current pipeline pricing applied in the browser. Review changes before download.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process CSV")
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

  // ── Inline panel render ──────────────────────────────────────────────────
  if (inline) {
    const inlineResetState = () => {
      setFile(null)
      setIsProcessing(false)
      setReviewData(null)
      setApprovedChanges({})
      setTraceSelections({})
      setPopupAdjusters([])
      setAmenityAdjuster({
        applyToWeb: true,
        premium: { multiplier: "1", offset: "0" },
        standard: { multiplier: "1", offset: "0" },
        economy: { multiplier: "1", offset: "0" },
      })
      setOriginalParsed(null)
      setCsvNumericVariables([])
    }

    return (
      <div className="flex flex-col gap-4 h-full min-h-0">
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
          <div className="flex flex-col items-center justify-center gap-5 rounded-lg border-2 border-dashed border-muted-foreground/25 p-10 text-center">
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium">Upload your client CSV</p>
              <p className="text-xs text-muted-foreground">
                Requires columns: Facility Name, Size, Current Web Rate,<br />
                Current Standard Rate, New Web Rate, New Standard Rate.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              <input
                id="csv-file-inline"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById("csv-file-inline")?.click()}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {file ? file.name : "Choose CSV file…"}
              </Button>
              {file && (
                <p className="text-xs text-muted-foreground truncate max-w-full">
                  Selected: <span className="font-medium text-foreground">{file.name}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 flex-1 min-h-0 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Adjusters</span>
              <Button type="button" size="sm" variant="outline" onClick={functionDialog.handleOpen}>Competitive</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowLevels(true)}>Levels</Button>
            </div>
            <div className="rounded-md border p-3 space-y-2">
              {popupAdjusters.length === 0 ? (
                <p className="text-xs text-muted-foreground">No competitive adjusters configured.</p>
              ) : (
                popupAdjusters.map((adj: Adjuster, idx: number) => {
                  const fn = adj as { variable?: string; function_string?: string }
                  const summary = adj.type === 'function' && fn.variable && fn.function_string
                    ? `f(${fn.variable}) = ${fn.function_string}`
                    : adj.type
                  return (
                    <div key={`${adj.type}-${idx}`} className="flex items-center justify-between rounded border px-2 py-1.5 gap-3">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium capitalize">{idx + 1}. Competitive adjuster</span>
                        <span className="text-xs text-muted-foreground font-mono truncate">{summary}</span>
                      </div>
                      <Button type="button" size="sm" variant="ghost" onClick={() => handleRemovePopupAdjuster(idx)} className="h-7 px-2" aria-label="Remove adjuster">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setAllApprovals(true)}>Approve all</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setAllApprovals(false)}>Reject all</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setReviewData(null); setApprovedChanges({}); setTraceSelections({}) }}>Choose another CSV</Button>
            </div>
            <div className="overflow-auto rounded-md border" style={{ maxHeight: "calc(100vh - 420px)" }}>
              {reviewData.reviewRows.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No changes were produced by pricing algorithms. You can still download the processed CSV.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        <div className="flex flex-col gap-1">
                          <span>Trace</span>
                          <div className="flex items-center gap-1 text-[10px]">
                            <button
                              type="button"
                              className="rounded border px-1.5 py-0.5 hover:bg-muted"
                              onClick={() => setAllTraceSelections(true)}
                            >
                              All
                            </button>
                            <button
                              type="button"
                              className="rounded border px-1.5 py-0.5 hover:bg-muted"
                              onClick={() => setAllTraceSelections(false)}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      </th>
                      <th className="px-3 py-2 text-left font-medium">Row</th>
                      <th className="px-3 py-2 text-left font-medium">Facility</th>
                      <th className="px-3 py-2 text-left font-medium">Unit</th>
                      <th className="px-3 py-2 text-left font-medium">Total Units</th>
                      <th className="px-3 py-2 text-left font-medium">Occupied</th>
                      <th className="px-3 py-2 text-left font-medium">Available</th>
                      <th className="px-3 py-2 text-left font-medium">Vacancy</th>
                      <th className="px-3 py-2 text-left font-medium">Occupancy</th>
                      <th className="px-3 py-2 text-left font-medium">Amenities</th>
                      <th className="px-3 py-2 text-left font-medium">Current Web</th>
                      <th className="px-3 py-2 text-left font-medium">New Web</th>
                      <th className="px-3 py-2 text-left font-medium">Web Decision</th>
                      <th className="px-3 py-2 text-left font-medium">Current Standard</th>
                      <th className="px-3 py-2 text-left font-medium">New Standard</th>
                      <th className="px-3 py-2 text-left font-medium">Standard Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewData.reviewRows.map((row: ReviewRow) => (
                      <tr key={row.id} className="border-b last:border-b-0">
                        <td className={`px-3 py-2 align-top ${traceSelections[row.id] ? "bg-blue-50/60" : ""}`}>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleTraceSelection(row)}
                              className="inline-flex items-center justify-center"
                              aria-label={`Toggle trace for row ${row.rowIndex + 2}`}
                              title={row.traceTargetId ? "Trace to matching row" : "No trace target"}
                            >
                              <span
                                className={`h-3 w-3 rounded-full border ${traceSelections[row.id] ? "bg-blue-600 border-blue-600" : "bg-transparent border-muted-foreground/60"}`}
                              />
                            </button>
                            {row.traceTargetId ? (
                              <button
                                type="button"
                                className={`text-xs ${traceSelections[row.id] ? "text-blue-700" : "text-blue-600"} hover:underline`}
                                onClick={() => jumpToTraceTarget(row.traceTargetId)}
                                title="Jump to matching row"
                              >
                                ↖
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">{row.rowIndex + 2}</td>
                        <td className="px-3 py-2 align-top">{row.facilityName || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.unitSize || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.totalUnits || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.occupied || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.available || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.vacancy || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.occupancy || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.amenities || "—"}</td>
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
              {isProcessing ? "Applying…" : "Apply Pricing Algorithms"}
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
        <AddFunctionAdjusterDialog
          open={functionDialog.open}
          onOpenChange={functionDialog.setOpen}
          onAdd={handleAddPopupAdjuster}
          availableVariables={csvNumericVariables.filter((name: string) => !RATE_VARIABLE_EXCLUSIONS.has(normalizeColumnKey(name)))}
          competitorData={pricingContext?.competitorData ?? []}
          clientAvailableUnits={pricingContext?.clientAvailableUnits ?? 0}
          includeAvailableUnits={false}
        />
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
        <DialogContent className={reviewData ? "sm:max-w-[1000px] max-h-[85vh] overflow-hidden" : "sm:max-w-[425px]"}>
        <DialogHeader>
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
                      Drive-up matching uses CSV &apos;Unit Type&apos; when present.
                      <br />
                      Ensure columns: &apos;Facility Name&apos;, &apos;Size&apos;, &apos;Current Web Rate&apos;, &apos;Current Standard Rate&apos;, &apos;New Web Rate&apos;, &apos;New Standard Rate&apos;.
                    </span>
                  </>
                )}
              </DialogDescription>
            </div>
            {reviewData ? (
              <div className="pr-6">
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
              </div>
            ) : null}
          </div>
        </DialogHeader>

        {!reviewData ? (
          <div className="grid gap-4 py-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="csv-file">Client CSV</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2">
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
            </div>

            <div className="rounded-md border p-3 space-y-2">
              {popupAdjusters.length === 0 ? (
                <p className="text-xs text-muted-foreground">No competitive adjusters configured.</p>
              ) : (
                popupAdjusters.map((adj: Adjuster, idx: number) => {
                  const fn = adj as { variable?: string; function_string?: string }
                  const summary = adj.type === 'function' && fn.variable && fn.function_string
                    ? `f(${fn.variable}) = ${fn.function_string}`
                    : adj.type
                  return (
                  <div key={`${adj.type}-${idx}`} className="flex items-center justify-between rounded border px-2 py-1.5 gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium capitalize">{idx + 1}. Competitive adjuster</span>
                      <span className="text-xs text-muted-foreground font-mono truncate">{summary}</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemovePopupAdjuster(idx)}
                      className="h-7 px-2"
                      aria-label="Remove adjuster"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  )
                })
              )}
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
                  setTraceSelections({})
                }}
              >
                Choose another CSV
              </Button>
            </div>

            <div className="max-h-[48vh] overflow-auto rounded-md border">
              {reviewData.reviewRows.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No changes were produced by pricing algorithms. You can still download the processed CSV.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        <div className="flex flex-col gap-1">
                          <span>Trace</span>
                          <div className="flex items-center gap-1 text-[10px]">
                            <button
                              type="button"
                              className="rounded border px-1.5 py-0.5 hover:bg-muted"
                              onClick={() => setAllTraceSelections(true)}
                            >
                              All
                            </button>
                            <button
                              type="button"
                              className="rounded border px-1.5 py-0.5 hover:bg-muted"
                              onClick={() => setAllTraceSelections(false)}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      </th>
                      <th className="px-3 py-2 text-left font-medium">Row</th>
                      <th className="px-3 py-2 text-left font-medium">Facility</th>
                      <th className="px-3 py-2 text-left font-medium">Unit</th>
                      <th className="px-3 py-2 text-left font-medium">Total Units</th>
                      <th className="px-3 py-2 text-left font-medium">Occupied</th>
                      <th className="px-3 py-2 text-left font-medium">Available</th>
                      <th className="px-3 py-2 text-left font-medium">Vacancy</th>
                      <th className="px-3 py-2 text-left font-medium">Occupancy</th>
                      <th className="px-3 py-2 text-left font-medium">Amenities</th>
                      <th className="px-3 py-2 text-left font-medium">Current Web</th>
                      <th className="px-3 py-2 text-left font-medium">New Web</th>
                      <th className="px-3 py-2 text-left font-medium">Web Decision</th>
                      <th className="px-3 py-2 text-left font-medium">Current Standard</th>
                      <th className="px-3 py-2 text-left font-medium">New Standard</th>
                      <th className="px-3 py-2 text-left font-medium">Standard Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewData.reviewRows.map((row: ReviewRow) => (
                      <tr key={row.id} className="border-b last:border-b-0">
                        <td className={`px-3 py-2 align-top ${traceSelections[row.id] ? "bg-blue-50/60" : ""}`}>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleTraceSelection(row)}
                              className="inline-flex items-center justify-center"
                              aria-label={`Toggle trace for row ${row.rowIndex + 2}`}
                              title={row.traceTargetId ? "Trace to matching row" : "No trace target"}
                            >
                              <span
                                className={`h-3 w-3 rounded-full border ${traceSelections[row.id] ? "bg-blue-600 border-blue-600" : "bg-transparent border-muted-foreground/60"}`}
                              />
                            </button>
                            {row.traceTargetId ? (
                              <button
                                type="button"
                                className={`text-xs ${traceSelections[row.id] ? "text-blue-700" : "text-blue-600"} hover:underline`}
                                onClick={() => jumpToTraceTarget(row.traceTargetId)}
                                title="Jump to matching row"
                              >
                                ↖
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">{row.rowIndex + 2}</td>
                        <td className="px-3 py-2 align-top">{row.facilityName || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.unitSize || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.totalUnits || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.occupied || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.available || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.vacancy || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.occupancy || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.amenities || "—"}</td>
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

        <DialogFooter>
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
            Optional combinatoric <strong>has_drive_up_access</strong> maps from CSV Unit Type.
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
