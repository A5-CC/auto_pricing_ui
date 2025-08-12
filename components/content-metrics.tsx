"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Binary, FileText } from "lucide-react"

export function ContentMetrics({
  words,
  tokens,
  className,
  size = "sm",
}: {
  words: number
  tokens: number
  className?: string
  size?: "sm" | "md"
}) {
  const formatter = new Intl.NumberFormat()

  const badgeSizeClass = size === "md" ? "px-2.5 py-1 text-sm [&>svg]:size-4" : "px-2 py-0.5 text-xs [&>svg]:size-3.5"

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2", className)}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            aria-label={`${formatter.format(words)} words`}
            className={cn("gap-1 tabular-nums", badgeSizeClass)}
          >
            <FileText aria-hidden className="text-muted-foreground" />
            <span className="font-medium">{formatter.format(words)}</span>
            <span className="hidden sm:inline text-muted-foreground">words</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Word count</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            aria-label={`${formatter.format(tokens)} tokens (estimated)`}
            className={cn("gap-1 tabular-nums", badgeSizeClass)}
          >
            <Binary aria-hidden className="text-muted-foreground" />
            <span className="font-medium">{formatter.format(tokens)}</span>
            <span className="hidden sm:inline text-muted-foreground">tokens</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Estimated tokens (≈0.75× words)</TooltipContent>
      </Tooltip>
    </div>
  )
}


