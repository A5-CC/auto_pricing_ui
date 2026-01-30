
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, FileSpreadsheet } from "lucide-react"
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
  // - facility_location_city: "Facility Location City"
  // - competitor_name: "Competitor Name"
  // All other filters must be empty.
  
  const allowedKeys = new Set(["unit_dimensions", "facility_location_city", "competitor_name"]);
  
  // NOTE: 'competitors', 'locations', 'unitCategories' are standard legacy keys.
  // 'locations' is legacy modstorage_location.
  // 'facility_location_city' is expected to be passed if used.
  
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
              Supported filters: Location, Dimensions.
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
  )
}
