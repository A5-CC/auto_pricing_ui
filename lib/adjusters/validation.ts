/**
 * Validation utilities for adjuster prerequisites
 */

import { E1DataRow } from './types'
import { DEFAULT_PRICE_FALLBACK_CHAIN } from './competitive'

/**
 * Formats a column name for display
 * monthly_rate_web → Monthly Rate Web
 */
export function formatColumnName(columnName: string): string {
  return columnName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Checks if dataset has any valid competitor prices
 * Used to warn users before they try to add adjusters
 */
export function hasValidCompetitorPrices(
  competitorData: E1DataRow[],
  priceColumns: string[] = DEFAULT_PRICE_FALLBACK_CHAIN
): boolean {
  // Filter out client rows
  const competitors = competitorData.filter(
    row => row.competitor_name !== 'modSTORAGE'
  )

  if (competitors.length === 0) {
    return false
  }

  // Check if ANY competitor has ANY valid price in fallback chain
  for (const row of competitors) {
    for (const column of priceColumns) {
      const value = row[column]
      if (typeof value === 'number' && isFinite(value) && value > 0) {
        return true // Found at least one valid price
      }
    }
  }

  return false
}

/**
 * Gets diagnostic info about price data availability
 */
export function getPriceDiagnostics(
  competitorData: E1DataRow[],
  priceColumns: string[] = DEFAULT_PRICE_FALLBACK_CHAIN
): {
  totalRows: number
  competitorRows: number
  pricesFound: number
  coveragePercent: number
  checkedColumns: string[]
} {
  const competitors = competitorData.filter(
    row => row.competitor_name !== 'modSTORAGE'
  )

  let pricesFound = 0
  for (const row of competitors) {
    for (const column of priceColumns) {
      const value = row[column]
      if (typeof value === 'number' && isFinite(value) && value > 0) {
        pricesFound++
        break // Count each competitor only once
      }
    }
  }

  return {
    totalRows: competitorData.length,
    competitorRows: competitors.length,
    pricesFound,
    coveragePercent: competitors.length > 0 ? (pricesFound / competitors.length) * 100 : 0,
    checkedColumns: priceColumns,
  }
}
