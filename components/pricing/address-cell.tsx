"use client"

import { useMemo, useState } from "react"
import { MapPin } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface AddressCellProps {
  address: string
}

function parseAddress(address: string) {
  const normalized = address.trim().replace(/\s+/g, " ")
  const parts = normalized.split(",").map((p) => p.trim()).filter(Boolean)

  if (parts.length >= 3) {
    const street = parts[0]
    const city = parts[1]
    const third = parts[2]
    const countryRaw = parts[3] || ""
    const country = /^(usa|united states|us)$/i.test(countryRaw) ? "" : countryRaw

    // Separate state and ZIP if present
    const stateZipMatch = third.match(/^([A-Za-z]{2}|[A-Za-z\.\s]+)\s+(\d{5}(?:-\d{4})?)$/)
    if (stateZipMatch) {
      const state = stateZipMatch[1].toUpperCase()
      const zip = stateZipMatch[2]
      return { street, city, state, zip, country }
    }

    // Otherwise keep as-is
    return { street, city, stateZip: third, country }
  }

  // Fallback: just show the full address
  return { full: normalized }
}

// maps link intentionally omitted per design

export function AddressCell({ address }: AddressCellProps) {
  const [copied, setCopied] = useState(false)

  if (!address || address === "—") {
    return <span className="text-muted-foreground">—</span>
  }

  const parsed = useMemo(() => parseAddress(address), [address])
  const fullAddress = address

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullAddress)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // noop
    }
  }

  if ("full" in parsed) {
    return (
      <div className="group flex items-start gap-2 min-w-0">
        <Tooltip open={copied}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copy address"
              className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <MapPin className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent sideOffset={4}>Copied</TooltipContent>
        </Tooltip>
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-tight truncate" title={parsed.full}>{parsed.full}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-start gap-2 min-w-0">
      <Tooltip open={copied}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onCopy}
            aria-label="Copy address"
            className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <MapPin className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent sideOffset={4}>Copied</TooltipContent>
      </Tooltip>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="text-sm font-medium truncate" title={parsed.street}>
          {parsed.street}
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div className="truncate" title={parsed.city}>
            {parsed.city}
          </div>
          <div className="flex items-center gap-1 min-w-0">
            {"state" in parsed && parsed.zip ? (
              <>
                <span className="uppercase font-mono text-[10px] bg-muted/70 px-1 rounded">
                  {parsed.state}
                </span>
                <span className="font-mono text-[10px] tabular-nums">
                  {parsed.zip}
                </span>
              </>
            ) : (
              <span className="truncate" title={parsed.stateZip}>{parsed.stateZip}</span>
            )}
            {parsed.country && (
              <span className="uppercase text-[10px] bg-muted/70 px-1 rounded truncate" title={parsed.country}>
                {parsed.country}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}