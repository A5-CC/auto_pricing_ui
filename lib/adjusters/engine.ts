/**
 * E2 Price Adjuster Engine
 *
 * Orchestrates sequential application of price adjusters to calculate final price.
 *
 * Typical adjuster pipeline flow:
 *   1. Competitive: Establishes base price from competitor data
 *   2. Function: Applies multipliers based on numeric variables
 *   3. Temporal: Applies time-based multipliers
 *
 * Example:
 *   Base: min($85) × 0.97 = $82.45 (competitive)
 *   Adjust: $82.45 × 0.90 = $74.21 (function: available_units discount)
 *   Final: $74.21 × 1.10 = $81.63 (temporal: Friday premium)
 */

import {
  Adjuster,
  CalculatePriceInput,
  CalculatePriceResult,
} from './types'
import { applyCompetitiveAdjuster } from './competitive'
import { applyFunctionAdjuster, FunctionContext } from './function-adjuster'
import { applyTemporalAdjuster } from './temporal'

/**
 * Calculates final price by applying adjusters sequentially
 *
 * @param input - Calculate price input (competitor data, client unit, adjusters, timestamp)
 * @returns Final price or null if calculation fails
 *
 * @example Complete adjuster pipeline
 * const input = {
 *   competitorData: [...], // E1 filtered competitor data
 *   clientUnit: { available_units: 20 },
 *   adjusters: [
 *     {
 *       type: 'competitive',
 *       price_columns: ['monthly_rate_online', 'monthly_rate_regular'],
 *       aggregation: 'min',
 *       multiplier: 0.97
 *     },
 *     {
 *       type: 'function',
 *       variable: 'available_units',
 *       function_string: '1.0 - 0.005*x',
 *       domain_min: 0,
 *       domain_max: 100
 *     },
 *     {
 *       type: 'temporal',
 *       granularity: 'weekly',
 *       multipliers: [0.95, 0.95, 0.95, 0.98, 1.10, 1.15, 1.10]
 *     }
 *   ],
 *   currentDate: new Date('2025-11-14') // Friday
 * }
 * calculatePrice(input)
 * // Step 1 (competitive): min(competitors) × 0.97 = $82.45
 * // Step 2 (function): $82.45 × 0.90 = $74.21
 * // Step 3 (temporal): $74.21 × 1.10 = $81.63
 * // Returns: 81.63
 */
export function calculatePrice(input: CalculatePriceInput): CalculatePriceResult | null {
  try {
    // Validate input
    if (!input || !input.adjusters || input.adjusters.length === 0) {
      console.warn('[engine] No adjusters provided, cannot calculate price')
      return null
    }

    console.log(`[engine] ========== Starting price calculation ==========`)
    console.log(`[engine] Input: ${input.competitorData.length} rows, ${input.adjusters.length} adjusters`)
    console.log(`[engine] Client available units: ${input.clientUnit.available_units}`)
    console.log(`[engine] Current date for temporal adjusters: ${input.currentDate.toISOString()}`)

    let currentPrice: number | null = null
    const warnings: string[] = []

    // Apply adjusters sequentially
    for (let i = 0; i < input.adjusters.length; i++) {
      const adjuster = input.adjusters[i]
      console.log(`[engine] --- Adjuster ${i + 1}/${input.adjusters.length}: ${adjuster.type} ---`)

      if (adjuster.type === 'competitive') {
        // Competitive adjuster establishes base price (or replaces current price)
        console.log(`[engine] Calling competitive adjuster with config:`, {
          aggregation: adjuster.aggregation,
          multiplier: adjuster.multiplier,
          price_columns: adjuster.price_columns.slice(0, 3).join(', ') + '...'
        })

        const competitivePrice = applyCompetitiveAdjuster(
          adjuster,
          input.competitorData
        )

        if (competitivePrice === null) {
          console.error(`[engine] ❌ CALCULATION FAILED: Competitive adjuster ${i + 1} returned null`)
          return null
        }

        currentPrice = competitivePrice
        console.log(`[engine] ✓ After competitive adjuster: $${currentPrice.toFixed(2)}`)

      } else if (adjuster.type === 'function') {
        // Function adjuster applies multiplier to current price
        if (currentPrice === null) {
          console.error(
            `[engine] Function adjuster ${i + 1} requires existing price. Ensure a competitive adjuster runs first.`
          )
          return null
        }

        const context: FunctionContext = {
          competitorData: input.competitorData,
          clientUnit: input.clientUnit,
        }

        // Check if variable value is outside domain (soft warning)
        let variableValue: number | null = null
        if (adjuster.variable === 'available_units') {
          variableValue = input.clientUnit.available_units
        } else {
          // Get first non-null value from competitor data for warning check
          for (const row of input.competitorData) {
            const value = row[adjuster.variable]
            if (typeof value === 'number' && isFinite(value)) {
              variableValue = value
              break
            }
          }
        }

        if (variableValue !== null &&
            (variableValue < adjuster.domain_min || variableValue > adjuster.domain_max)) {
          const warning = `Variable "${adjuster.variable}" value (${variableValue}) is outside expected domain [${adjuster.domain_min}, ${adjuster.domain_max}]`
          warnings.push(warning)
        }

        const multiplier = applyFunctionAdjuster(adjuster, context)
        currentPrice = currentPrice * multiplier
        console.log(
          `[engine] After function adjuster (×${multiplier.toFixed(3)}): $${currentPrice.toFixed(2)}`
        )

      } else if (adjuster.type === 'temporal') {
        // Temporal adjuster applies multiplier to current price
        if (currentPrice === null) {
          console.error(
            `[engine] Temporal adjuster ${i + 1} requires existing price. Ensure a competitive adjuster runs first.`
          )
          return null
        }

        const multiplier = applyTemporalAdjuster(adjuster, input.currentDate)
        currentPrice = currentPrice * multiplier
        console.log(
          `[engine] After temporal adjuster (×${multiplier.toFixed(3)}): $${currentPrice.toFixed(2)}`
        )

      } else {
        console.error(
          `[engine] Unknown adjuster type at position ${i + 1}: ${(adjuster as { type: string }).type}`
        )
        // Don't fail completely, just skip unknown adjuster
        continue
      }
    }

    // Final validation
    if (currentPrice === null) {
      console.error('[engine] Price calculation completed but no price was established')
      return null
    }

    if (!isFinite(currentPrice) || currentPrice <= 0) {
      console.error(
        `[engine] Invalid final price: ${currentPrice}. Must be positive and finite.`
      )
      return null
    }

    console.log(`[engine] ✓ Final calculated price: $${currentPrice.toFixed(2)}`)
    if (warnings.length > 0) {
      console.log(`[engine] ⚠ ${warnings.length} warning(s):`, warnings)
    }
    return {
      price: currentPrice,
      warnings
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[engine] Unexpected error during price calculation:', errorMessage)
    return null
  }
}

/**
 * Validates that an adjuster pipeline is well-formed
 *
 * Checks:
 *   - At least one competitive adjuster exists
 *   - Non-competitive adjusters don't appear before competitive
 *   - All adjuster configs are valid
 *
 * @param adjusters - Adjuster pipeline to validate
 * @returns Validation result with errors/warnings
 */
export interface PipelineValidationResult {
  valid: boolean
  errors?: string[]
  warnings?: string[]
}

export function validateAdjusterPipeline(
  adjusters: Adjuster[]
): PipelineValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!adjusters || adjusters.length === 0) {
    errors.push('Pipeline must contain at least one adjuster')
    return { valid: false, errors }
  }

  // Check if pipeline has at least one competitive adjuster
  const hasCompetitive = adjusters.some(adj => adj.type === 'competitive')
  if (!hasCompetitive) {
    errors.push(
      'Pipeline must contain at least one competitive adjuster to establish base price'
    )
  }

  // Check if competitive adjuster appears before function/temporal
  const firstCompetitiveIndex = adjusters.findIndex(adj => adj.type === 'competitive')
  const firstNonCompetitiveIndex = adjusters.findIndex(
    adj => adj.type === 'function' || adj.type === 'temporal'
  )

  if (
    firstNonCompetitiveIndex !== -1 &&
    (firstCompetitiveIndex === -1 || firstNonCompetitiveIndex < firstCompetitiveIndex)
  ) {
    errors.push(
      `Adjuster at position ${firstNonCompetitiveIndex + 1} (${adjusters[firstNonCompetitiveIndex].type}) requires a competitive adjuster to run first`
    )
  }

  // Warn if there are multiple competitive adjusters
  const competitiveCount = adjusters.filter(adj => adj.type === 'competitive').length
  if (competitiveCount > 1) {
    warnings.push(
      `Pipeline has ${competitiveCount} competitive adjusters. Each replaces the current price rather than multiplying it.`
    )
  }

  // TODO: Individual adjuster validation
  // This would import validation functions from each adjuster module
  // and validate individual configs

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
