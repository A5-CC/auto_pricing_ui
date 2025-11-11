/**
 * Competitive Price Adjuster
 *
 * Aggregates competitor prices using fallback chain strategy to maximize coverage.
 *
 * Dataset reality:
 *   - 43 price columns, most with low fill rates (<20%)
 *   - Different competitors populate different columns
 *   - Single column selection would ignore 50-80% of competitors
 *
 * Fallback chain solution:
 *   - Try price_columns in order for each competitor row
 *   - Take first non-null value found
 *   - Maximizes competitive landscape coverage
 */

import { CompetitivePriceAdjuster, E1DataRow } from './types'

/**
 * Default price column fallback chain
 * Based on analysis of E1 unified dataset:
 *   - monthly_rate_web: 45.3% fill rate for competitors
 *   - monthly_rate_online: 50.6% fill rate
 *   - monthly_rate_standard: 44.7% fill rate
 *   - Combined coverage: ~85-90% (most competitors have at least one)
 */
export const DEFAULT_PRICE_FALLBACK_CHAIN = [
  'monthly_rate_web',
  'monthly_rate_online',
  'monthly_rate_standard',
  'web_rate',
  'monthly_rate_regular',
]

/**
 * Extracts price from a competitor row using fallback chain
 *
 * @param row - E1 competitor data row
 * @param priceColumns - Fallback chain array
 * @returns Price or null if no valid price found
 */
function extractPriceWithFallback(
  row: E1DataRow,
  priceColumns: string[]
): number | null {
  for (const column of priceColumns) {
    const value = row[column]
    if (typeof value === 'number' && isFinite(value) && value > 0) {
      return value
    }
  }
  return null
}

/**
 * Aggregates array of prices using specified method
 *
 * @param prices - Array of valid competitor prices
 * @param aggregation - Aggregation method (min/max/avg)
 * @returns Aggregated price
 */
function aggregatePrices(
  prices: number[],
  aggregation: 'min' | 'max' | 'avg'
): number {
  if (prices.length === 0) {
    throw new Error('Cannot aggregate empty price array')
  }

  switch (aggregation) {
    case 'min':
      return Math.min(...prices)
    case 'max':
      return Math.max(...prices)
    case 'avg': {
      const sum = prices.reduce((acc, price) => acc + price, 0)
      return sum / prices.length
    }
    default:
      throw new Error(`Invalid aggregation method: ${aggregation}`)
  }
}

/**
 * Applies competitive price adjuster
 *
 * @param adjuster - Competitive adjuster configuration
 * @param competitorData - E1 competitor data (already filtered by E1 categorical filters)
 * @returns Base price (aggregated competitor unit price × multiplier), or null if no prices found
 *
 * @example Undercut minimum by 3%
 * const adjuster = {
 *   type: 'competitive',
 *   price_columns: ['monthly_rate_web', 'monthly_rate_online'],
 *   aggregation: 'min',
 *   multiplier: 0.97
 * }
 * const competitorData = [
 *   { competitor_name: 'Public Storage', monthly_rate_web: 100, ... },
 *   { competitor_name: 'U-Haul', monthly_rate_online: 95, ... },
 *   { competitor_name: 'SecureSpace', monthly_rate_web: 110, ... }
 * ]
 * applyCompetitiveAdjuster(adjuster, competitorData)
 * // Extracts: [100, 95, 110]
 * // Min: 95
 * // With multiplier: 95 * 0.97 = 92.15
 *
 * @example Match average competitor unit price
 * const adjuster = {
 *   type: 'competitive',
 *   price_columns: ['monthly_rate_web', 'monthly_rate_standard'],
 *   aggregation: 'avg',
 *   multiplier: 1.0
 * }
 * // Returns: average of all competitor unit prices found
 */
export function applyCompetitiveAdjuster(
  adjuster: CompetitivePriceAdjuster,
  competitorData: E1DataRow[]
): number | null {
  try {
    console.log(`[competitive] Input: ${competitorData.length} total rows`)

    // Filter out client rows (modSTORAGE) - only process competitors
    const competitors = competitorData.filter(
      row => row.competitor_name !== 'modSTORAGE'
    )

    console.log(`[competitive] After filtering: ${competitors.length} competitor unit rows (excluded modSTORAGE)`)

    if (competitors.length === 0) {
      console.error('[competitive] FAIL: No competitor units available (all rows are client rows or empty dataset)')
      console.error('[competitive] competitorData sample:', competitorData.slice(0, 3))
      return null
    }

    // Use default fallback chain if none provided or empty
    const priceColumns =
      adjuster.price_columns && adjuster.price_columns.length > 0
        ? adjuster.price_columns
        : DEFAULT_PRICE_FALLBACK_CHAIN

    console.log(`[competitive] Using price columns: ${priceColumns.join(' → ')}`)

    // Extract prices using fallback chain
    const prices: number[] = []
    for (const row of competitors) {
      const price = extractPriceWithFallback(row, priceColumns)
      if (price !== null) {
        prices.push(price)
      }
    }

    // Check if we found any prices
    if (prices.length === 0) {
      console.error(
        `[competitive] FAIL: No valid prices found in ${competitors.length} competitor units using columns: ${priceColumns.join(', ')}`
      )
      console.error('[competitive] Sample competitor unit columns:', Object.keys(competitors[0] || {}))
      console.error('[competitive] Sample competitor unit price values:', priceColumns.map(col => `${col}=${competitors[0]?.[col]}`).join(', '))
      return null
    }

    // Log coverage stats
    const coveragePercent = (prices.length / competitors.length) * 100
    console.log(
      `[competitive] Found ${prices.length}/${competitors.length} competitor unit prices (${coveragePercent.toFixed(1)}% coverage)`
    )

    // Aggregate prices
    const aggregatedPrice = aggregatePrices(prices, adjuster.aggregation)

    // Validate multiplier
    if (
      typeof adjuster.multiplier !== 'number' ||
      !isFinite(adjuster.multiplier) ||
      adjuster.multiplier <= 0
    ) {
      console.error(
        `[competitive] Invalid multiplier: ${adjuster.multiplier}. Using 1.0 neutral.`
      )
      return aggregatedPrice
    }

    // Apply multiplier
    const finalPrice = aggregatedPrice * adjuster.multiplier

    console.log(
      `[competitive] ${adjuster.aggregation}(${prices.length} prices) = $${aggregatedPrice.toFixed(2)} × ${adjuster.multiplier} = $${finalPrice.toFixed(2)}`
    )

    return finalPrice
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(
      `[competitive] Unexpected error applying competitive adjuster:`,
      errorMessage
    )
    return null
  }
}

/**
 * Validation result for competitive adjuster configuration
 */
export interface CompetitiveValidationResult {
  valid: boolean
  error?: string
  warnings?: string[]
}

/**
 * Validates competitive adjuster configuration
 * Used in client-side validation before pipeline save
 *
 * @param adjuster - Competitive adjuster to validate
 * @param availableColumns - List of valid column names in dataset (optional)
 * @returns Validation result with error/warning messages
 */
export function validateCompetitiveAdjuster(
  adjuster: CompetitivePriceAdjuster,
  availableColumns?: string[]
): CompetitiveValidationResult {
  const warnings: string[] = []

  // Validate price_columns array exists and not empty
  if (!Array.isArray(adjuster.price_columns)) {
    return {
      valid: false,
      error: 'price_columns must be an array',
    }
  }

  if (adjuster.price_columns.length === 0) {
    warnings.push(
      'price_columns is empty, will use default fallback chain'
    )
  }

  // Validate column names exist in dataset (if available)
  if (availableColumns && adjuster.price_columns.length > 0) {
    for (const column of adjuster.price_columns) {
      if (!availableColumns.includes(column)) {
        warnings.push(
          `Column "${column}" not found in dataset. Available columns: ${availableColumns.slice(0, 10).join(', ')}...`
        )
      }
    }
  }

  // Validate aggregation method
  if (!['min', 'max', 'avg'].includes(adjuster.aggregation)) {
    return {
      valid: false,
      error: `Invalid aggregation: ${adjuster.aggregation}. Must be 'min', 'max', or 'avg'`,
    }
  }

  // Validate multiplier
  if (typeof adjuster.multiplier !== 'number' || !isFinite(adjuster.multiplier)) {
    return {
      valid: false,
      error: `Multiplier must be a finite number, got: ${adjuster.multiplier}`,
    }
  }

  if (adjuster.multiplier <= 0) {
    return {
      valid: false,
      error: `Multiplier must be positive, got: ${adjuster.multiplier}`,
    }
  }

  // Warn if multiplier seems unusual
  if (adjuster.multiplier > 2.0) {
    warnings.push(
      `Multiplier ${adjuster.multiplier} is unusually high (>2x markup). Is this intentional?`
    )
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
