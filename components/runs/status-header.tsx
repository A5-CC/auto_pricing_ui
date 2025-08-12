"use client"

import { useState } from "react"
import { RunStatus } from "@/lib/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ChevronDown, Play, RefreshCcw, AlertTriangle } from "lucide-react"

// Status badge removed from header actions to keep UI minimal; latest status is shown below

type RunMode = "standard" | "force"

export function StatusHeader({
  latestStatus,
  isBusy,
  triggering,
  onTrigger,
}: {
  latestStatus: RunStatus | null
  isBusy: boolean
  triggering: boolean
  onTrigger: (overwrite: boolean) => void
}) {
  const [mode, setMode] = useState<RunMode>("standard")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const isDisabled = triggering || isBusy
  const isForce = mode === "force"

  const handleRunClick = () => {
    if (isForce) {
      setConfirmOpen(true)
      return
    }
    onTrigger(false)
  }

  const confirmForce = () => {
    setConfirmOpen(false)
    onTrigger(true)
  }

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Monitor the A1/A2 competitor pricing pipeline and trigger new runs.
        </p>
      </div>
      <div className="flex items-center">
        <div className="flex items-stretch">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleRunClick}
                disabled={isDisabled}
                variant={isForce ? "destructive" : "default"}
                className="rounded-r-none"
                aria-label={isDisabled ? (triggering ? "Queuing" : "Running") : isForce ? "Force reprocess" : "Run pipeline"}
              >
                {triggering ? (
                  "Queuing…"
                ) : isBusy ? (
                  "Running…"
                ) : isForce ? (
                  <>
                    <RefreshCcw className="mr-1.5" /> Force reprocess
                  </>
                ) : (
                  <>
                    <Play className="mr-1.5" /> Run now
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isForce ? "Overwrite and reprocess existing data" : "Process new data only"}
            </TooltipContent>
          </Tooltip>

          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={isForce ? "destructive" : "default"}
                className="rounded-l-none border-l border-white/20 dark:border-white/10"
                size="icon"
                disabled={isDisabled}
                aria-label="Run options"
              >
                <ChevronDown />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-2">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Run options</div>
              <button
                type="button"
                onClick={() => {
                  setMode("standard")
                  setMenuOpen(false)
                }}
                className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent ${
                  !isForce ? "bg-accent/50" : ""
                }`}
                aria-pressed={mode === "standard"}
              >
                <Play className="mt-0.5 size-4 shrink-0" />
                <div>
                  <div className="text-sm font-medium">Standard run</div>
                  <div className="text-xs text-muted-foreground">Process new data only</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("force")
                  setMenuOpen(false)
                }}
                className={`mt-1.5 flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent ${
                  isForce ? "bg-accent/50" : ""
                }`}
                aria-pressed={mode === "force"}
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <div>
                  <div className="text-sm font-medium text-foreground">Force reprocess</div>
                  <div className="text-xs text-muted-foreground">Overwrite and reprocess existing data</div>
                </div>
              </button>
            </PopoverContent>
          </Popover>
        </div>

        {/* Intentionally no status badge here; status is displayed in the overview cards below */}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force reprocess?</DialogTitle>
            <DialogDescription>
              This will overwrite existing run data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmForce} disabled={triggering}>
              {triggering ? "Queuing…" : "Force run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}


