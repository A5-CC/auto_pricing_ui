
"use client"

import type { CalculatedPriceRow } from "@/components/pipelines/calculated-price"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Adjuster } from '@/lib/adjusters'
import { FileSpreadsheet, Info, Loader2 } from "lucide-react"
import { type ChangeEvent, useState } from "react"
import { toast } from "sonner"

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
  }
  calculatedRows?: CalculatedPriceRow[]
}

type ParsedCsv = {
  headers: string[]
  rows: string[][]
}

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
  facilityName: string
  unitSize: string
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

const REVIEWABLE_RATE_COLUMNS = new Set(["newwebrate", "newstandardrate"])
const CURRENT_WEB_RATE_COLUMNS = new Set(["currentwebrate"])
const CURRENT_STANDARD_RATE_COLUMNS = new Set(["currentstandardrate"])
const FACILITY_NAME_COLUMNS = new Set(["facilityname", "storagename", "propertyname", "sitename"])
const UNIT_SIZE_COLUMNS = new Set(["size", "unitsize", "unitdimensions"])
const LOCATION_COLUMNS = new Set(["facilityname", "storagename", "propertyname", "sitename", "location", "address", "modstoragelocation"])
const NEW_WEB_RATE_COLUMNS = new Set(["newwebrate"])
const NEW_STANDARD_RATE_COLUMNS = new Set(["newstandardrate"])

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

function normalizeDimensionValue(value: unknown): string {
  return normalizeMatchValue(value).replace(/\s+/g, "")
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

function buildReviewRows(original: ParsedCsv, processed: ParsedCsv, changes: CsvRateChange[]): ReviewRow[] {
  const headers = processed.headers.length ? processed.headers : original.headers
  const facilityNameIndex = findColumnIndex(headers, FACILITY_NAME_COLUMNS)
  const unitSizeIndex = findColumnIndex(headers, UNIT_SIZE_COLUMNS)
  const currentWebRateIndex = findColumnIndex(headers, CURRENT_WEB_RATE_COLUMNS)
  const currentStandardRateIndex = findColumnIndex(headers, CURRENT_STANDARD_RATE_COLUMNS)
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
      facilityName: getCellValue(originalRow, facilityNameIndex) || getCellValue(processedRow, facilityNameIndex),
      unitSize: getCellValue(originalRow, unitSizeIndex) || getCellValue(processedRow, unitSizeIndex),
      currentWebRate: getCellValue(originalRow, currentWebRateIndex),
      proposedWebRate: getCellValue(processedRow, newWebRateIndex),
      currentStandardRate: getCellValue(originalRow, currentStandardRateIndex),
      proposedStandardRate: getCellValue(processedRow, newStandardRateIndex),
      webRateChange: null,
      standardRateChange: null,
    }

    if (normalizeColumnKey(change.columnName) === "newwebrate") {
      baseRow.webRateChange = change
      baseRow.proposedWebRate = change.processedValue
    }

    if (normalizeColumnKey(change.columnName) === "newstandardrate") {
      baseRow.standardRateChange = change
      baseRow.proposedStandardRate = change.processedValue
    }

    byRow.set(change.rowIndex, baseRow)
  }

  return Array.from(byRow.values()).sort((a, b) => a.rowIndex - b.rowIndex)
}

function applyCalculatedPricesToCsv(original: ParsedCsv, calculatedRows: CalculatedPriceRow[]): ParsedCsv {
  const headers = [...original.headers]
  const rows = original.rows.map((row) => [...row])

  const locationIndex = findColumnIndex(headers, LOCATION_COLUMNS)
  const unitSizeIndex = findColumnIndex(headers, UNIT_SIZE_COLUMNS)
  const newWebRateIndex = findColumnIndex(headers, NEW_WEB_RATE_COLUMNS)
  const newStandardRateIndex = findColumnIndex(headers, NEW_STANDARD_RATE_COLUMNS)

  if (locationIndex < 0 || unitSizeIndex < 0) {
    throw new Error("CSV must include facility/location and size columns to map frontend pricing.")
  }
  if (newWebRateIndex < 0 || newStandardRateIndex < 0) {
    throw new Error("CSV must include New Web Rate and New Standard Rate columns.")
  }

  const priceLookup = new Map<string, string>()
  for (const calculatedRow of calculatedRows) {
    if (typeof calculatedRow.price !== "number" || Number.isNaN(calculatedRow.price)) continue
    const location = normalizeMatchValue(calculatedRow.comboMap.modstorage_location)
    const dimension = normalizeDimensionValue(calculatedRow.comboMap.unit_dimensions)
    if (!location || !dimension) continue
    priceLookup.set(`${location}__${dimension}`, calculatedRow.price.toFixed(2))
  }

  if (priceLookup.size === 0) {
    throw new Error("No frontend price rows available. Make sure location and unit dimensions are combinatoric in the pipeline table.")
  }

  let matchedRows = 0
  for (const row of rows) {
    const location = normalizeMatchValue(getCellValue(row, locationIndex))
    const dimension = normalizeDimensionValue(getCellValue(row, unitSizeIndex))
    const mappedPrice = priceLookup.get(`${location}__${dimension}`)
    if (!mappedPrice) continue
    row[newWebRateIndex] = mappedPrice
    row[newStandardRateIndex] = mappedPrice
    matchedRows += 1
  }

  if (matchedRows === 0) {
    throw new Error("No uploaded CSV rows matched the current pipeline table by location + size.")
  }

  return { headers, rows }
}

export function ProcessCsvButton({ filters, calculatedRows = [] }: ProcessCsvButtonProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [approvedChanges, setApprovedChanges] = useState<Record<string, boolean>>({})

  // Validate allowed filters
  // Strictly Allowed:
  // - unit_dimensions: "Unit Dimensions"
  // - modstorage_location: "Facility Location"
  // - competitor_name: "Competitor Name"
  // All other filters must be empty.
  
  const allowedKeys = new Set(["unit_dimensions", "modstorage_location", "competitor_name"]);
  
  // NOTE: 'competitors', 'locations', 'unitCategories' are standard legacy keys.
  // 'locations' is legacy modstorage_location.
  // 'modstorage_location' is expected to be passed if used.
  
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
  }

  const handleProcess = async () => {
    if (!file) return

    setIsProcessing(true)
    try {
      const originalText = await file.text()
      const original = toParsedCsv(originalText)
      const processed = applyCalculatedPricesToCsv(original, calculatedRows)

      if (original.headers.length === 0 || processed.headers.length === 0) {
        throw new Error("CSV appears empty or invalid. Please check the input file.")
      }

      const headers = processed.headers.length ? processed.headers : original.headers
      const changes = buildChanges(original, processed)
      const reviewRows = buildReviewRows(original, processed, changes)
      const nextReviewData: ReviewData = {
        fileName: file.name,
        headers,
        originalRows: original.rows,
        processedRows: processed.rows,
        changes,
        reviewRows,
      }

      const approvals: Record<string, boolean> = {}
      for (const change of changes) {
        approvals[change.id] = true
      }

      setApprovedChanges(approvals)
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
            title={hasInvalidFilters ? "Only Location and Dimension filters are supported for pricing effect" : "Effect Pricing"}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Effect Pricing
          </Button>
        </DialogTrigger>
        <DialogContent className={reviewData ? "sm:max-w-[1000px] max-h-[85vh] overflow-hidden" : "sm:max-w-[425px]"}>
        <DialogHeader>
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
                  Supported filters: modstorage_location, unit_dimensions.
                  <br />
                  Uses the currently displayed pipeline price table in the browser.
                  <br />
                  Ensure columns: &apos;Facility Name&apos;, &apos;Size&apos;, &apos;Current Web Rate&apos;, &apos;Current Standard Rate&apos;, &apos;New Web Rate&apos;, &apos;New Standard Rate&apos;.
                </span>
              </>
            )}
          </DialogDescription>
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
                      <th className="px-3 py-2 text-left font-medium">Row</th>
                      <th className="px-3 py-2 text-left font-medium">Facility</th>
                      <th className="px-3 py-2 text-left font-medium">Unit</th>
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
                        <td className="px-3 py-2 align-top">{row.rowIndex + 2}</td>
                        <td className="px-3 py-2 align-top">{row.facilityName || "—"}</td>
                        <td className="px-3 py-2 align-top">{row.unitSize || "—"}</td>
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
            <strong> modstorage_location</strong> and <strong>unit_dimensions</strong>.
            Additional filters must be non-combinatoric. 
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
