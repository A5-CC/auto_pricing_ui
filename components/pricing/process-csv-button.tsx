
"use client"

import { useState } from "react"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, FileSpreadsheet, Info } from "lucide-react"
import { processClientCSV } from "@/lib/api/client/pricing"
import type { Adjuster } from '@/lib/adjusters'
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
}

export function ProcessCsvButton({ snapshotId, filters, adjusters, combinatoric }: ProcessCsvButtonProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

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

  const handleProcess = async () => {
    if (!file) return

    setIsProcessing(true)
    try {
      await processClientCSV(file, snapshotId, filters, adjusters, combinatoric)
      toast.success("CSV processed and downloaded successfully.")
      setOpen(false)
      setFile(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process CSV")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            disabled={hasInvalidFilters}
            title={hasInvalidFilters ? "Only Location and Dimension filters are supported for CSV processing" : "Process Client CSV"}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Process CSV
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Process Client CSV</DialogTitle>
          <DialogDescription>
            Upload a client CSV file to update pricing based on current filters.
            <br />
            <span className="text-xs text-muted-foreground mt-2 block">
              Supported filters: modstorage_location, unit_dimensions.
              <br />
              Ensure columns: &apos;Facility Name&apos;, &apos;Size&apos;, &apos;New Web Rate&apos;.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="csv-file">Client CSV</Label>
            <Input 
              id="csv-file" 
              type="file" 
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleProcess} disabled={!file || isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isProcessing ? "Processing..." : "Process & Download"}
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
            Use this for storEDGE client CSVs. Requires combinatoric filters on
            <strong> modstorage_location</strong> and <strong>unit_dimensions</strong>.
            Competitors are non-combinatoric. You can include more filters, but they must be non-combinatoric.
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
