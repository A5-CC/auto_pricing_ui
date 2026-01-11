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
 *   - monthly_rate_online: ~50% fill rate
 *   - monthly_rate_regular: ~45% fill rate
 *   - monthly_rate_instore: ~40% fill rate
 *   - Combined coverage: ~85-90% (most competitors have at least one)
 *
 * TECH DEBT (2025-12-16): Legacy columns (monthly_rate_web, monthly_rate_standard, web_rate)
 * are kept for backwards compatibility with existing parquet data. The canonical schema
 * was cleaned to consolidate duplicates, but historical data still uses old column names.
 * These can be removed once all parquet files have been regenerated with the new schema.
 * See: canonical-wide-schema.json v30+ for the clean schema.
 */
export const DEFAULT_PRICE_FALLBACK_CHAIN = [
  // Pricing-data spine (A2 normalized)
  'monthly_rate_starting',
  'monthly_rate_instore',
  // Current canonical columns
  'monthly_rate_online',
  'monthly_rate_regular',
  'monthly_rate_promo',
  // Legacy columns (backwards compat - see TECH DEBT above)
  'monthly_rate_web',
  'monthly_rate_standard',
  'web_rate',
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

    if (typeof value === 'number' && isFinite(value) && value > 0) return value

    // Pricing endpoints sometimes serialize numeric fields as strings.
    if (typeof value === 'string') {
      const cleaned = value.trim().replace(/[$,]/g, '')
      if (!cleaned) continue
      const n = Number.parseFloat(cleaned)
      if (Number.isFinite(n) && n > 0) return n
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
 *   price_columns: ['monthly_rate_online', 'monthly_rate_regular'],
 *   aggregation: 'min',
 *   multiplier: 0.97
 * }
 * const competitorData = [
 *   { competitor_name: 'Public Storage', monthly_rate_online: 100, ... },
 *   { competitor_name: 'U-Haul', monthly_rate_regular: 95, ... },
 *   { competitor_name: 'SecureSpace', monthly_rate_online: 110, ... }
 * ]
 * applyCompetitiveAdjuster(adjuster, competitorData)
 * // Extracts: [100, 95, 110]
 * // Min: 95
 * // With multiplier: 95 * 0.97 = 92.15
 *
 * @example Match average competitor unit price
 * const adjuster = {
 *   type: 'competitive',
 *   price_columns: ['monthly_rate_online', 'monthly_rate_regular'],
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

    const requestedColumns = adjuster.price_columns ?? []
    const hasRequested = Array.isArray(requestedColumns) && requestedColumns.length > 0
    const primaryColumns = hasRequested ? requestedColumns : DEFAULT_PRICE_FALLBACK_CHAIN

    console.log(`[competitive] Using price columns: ${primaryColumns.join(' → ')}`)

    const extractAll = (cols: string[]) => {
      const out: number[] = []
      for (const row of competitors) {
        const price = extractPriceWithFallback(row, cols)
        if (price !== null) out.push(price)
      }
      return out
    }

    // Extract prices using fallback chain
    let prices: number[] = extractAll(primaryColumns)

    // If a pipeline provided explicit columns but they don't exist in pricing-data,
    // fall back to the default chain so we can still compute a base price.
    if (prices.length === 0 && hasRequested) {
      console.warn(
        `[competitive] No prices found using configured columns. Falling back to DEFAULT_PRICE_FALLBACK_CHAIN.`
      )
      prices = extractAll(DEFAULT_PRICE_FALLBACK_CHAIN)
    }

    // Check if we found any prices
    if (prices.length === 0) {
      console.error(
        `[competitive] FAIL: No valid prices found in ${competitors.length} competitor units.`
      )
      console.error('[competitive] Sample competitor unit columns:', Object.keys(competitors[0] || {}))
      console.error(
        '[competitive] Sample competitor unit price values:',
        (hasRequested ? primaryColumns : DEFAULT_PRICE_FALLBACK_CHAIN)
          .slice(0, 10)
          .map(col => `${col}=${competitors[0]?.[col]}`)
          .join(', ')
      )
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
