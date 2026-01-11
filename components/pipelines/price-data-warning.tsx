import { useMemo } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { hasValidCompetitorPrices, getPriceDiagnostics, formatColumnName } from '@/lib/adjusters/validation'
import { DEFAULT_PRICE_FALLBACK_CHAIN } from '@/lib/adjusters'
import type { E1DataRow } from '@/lib/adjusters'

interface PriceDataWarningProps {
  competitorData: E1DataRow[]
}

export function PriceDataWarning({ competitorData }: PriceDataWarningProps) {
  const diagnostics = useMemo(
    () => getPriceDiagnostics(competitorData),
    [competitorData]
  )

  const hasValidPrices = useMemo(
    () => hasValidCompetitorPrices(competitorData),
    [competitorData]
  )

  if (hasValidPrices) {
    return null // No warning needed
  }

  // No competitor data at all
  if (diagnostics.competitorRows === 0) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No competitor data</AlertTitle>
        <AlertDescription>
          {diagnostics.totalRows === 0 ? (
            <>
              No rows were loaded from the competitor dataset for the current snapshot.
              This usually means the backend returned no competitor rows (or the API URL is misconfigured).
            </>
          ) : (
            <>
              The current dataset has no competitor rows (all {diagnostics.totalRows} rows are client data).
            </>
          )}
          <span className="block mt-1">
            Adjust your filters (or snapshot) to include competitor data before adding price adjusters.
          </span>
        </AlertDescription>
      </Alert>
    )
  }

  // Competitors exist but no price data
  const formattedColumns = DEFAULT_PRICE_FALLBACK_CHAIN.map(formatColumnName)

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>No price data available</AlertTitle>
      <AlertDescription className="space-y-2">
        <div>
          Found {diagnostics.competitorRows} competitor unit{diagnostics.competitorRows !== 1 ? 's' : ''}, but none have
          valid prices in the expected price columns.
        </div>
        <div className="mt-2 border-l-2 border-muted-foreground/30 pl-3 text-xs italic text-muted-foreground">
          Price columns: {formattedColumns.join(', ')}
        </div>
        <div className="mt-1 text-xs">
          Try adjusting your filters to include different competitor units.
        </div>
      </AlertDescription>
    </Alert>
  )
}
