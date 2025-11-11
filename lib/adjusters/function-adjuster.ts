/**
 * Function-Based Price Adjuster
 *
 * Applies mathematical functions over numeric variables to produce price multipliers.
 * Variables can come from:
 *   - E1 competitor data (rating, distance_miles, etc.)
 *   - Client unit data (available_units)
 *
 * Example: Available units discount
 *   f(x) = "1.0 - 0.005*x" where x = available_units = 20
 *   Multiplier = 0.90 (10% discount when 20 units available)
 */

import { FunctionBasedAdjuster, E1DataRow, ClientUnit } from './types'
import { evaluateSafeFunction, validateFunctionAdjusterConfig } from './function-eval'

/**
 * Context for function evaluation
 * Provides access to both competitor data and client data
 */
export interface FunctionContext {
  competitorData: E1DataRow[]  // E1 unified competitor data (already filtered)
  clientUnit: ClientUnit       // Client inventory data
}

/**
 * Extracts variable value from context
 *
 * Special handling:
 *   - "available_units" comes from clientUnit (E0 client data)
 *   - All other variables come from first competitor row (e.g., rating, distance_miles)
 *
 * @param variable - Variable name (e.g., "available_units", "rating")
 * @param context - Function evaluation context
 * @returns Variable value or null if not found/invalid
 */
function extractVariableValue(
  variable: string,
  context: FunctionContext
): number | null {
  // Special case: available_units from client data
  if (variable === 'available_units') {
    const value = context.clientUnit.available_units
    if (typeof value === 'number' && isFinite(value)) {
      return value
    }
    console.warn(`[function-adjuster] available_units is not a valid number: ${value}`)
    return null
  }

  // All other variables: extract from competitor data
  // For now, we use a simple strategy: take first competitor row with non-null value
  // Future enhancement: Could aggregate across competitors (avg, min, max)

  if (!context.competitorData || context.competitorData.length === 0) {
    console.warn(`[function-adjuster] No competitor data available for variable: ${variable}`)
    return null
  }

  // Search for first row with non-null value for this variable
  for (const row of context.competitorData) {
    const value = row[variable]
    if (typeof value === 'number' && isFinite(value)) {
      return value
    }
  }

  console.warn(
    `[function-adjuster] Variable "${variable}" not found or has no valid values in competitor data`
  )
  return null
}

/**
 * Applies function-based adjuster
 *
 * @param adjuster - Function-based adjuster configuration
 * @param context - Context with competitor and client data
 * @returns Multiplier (1.0 neutral if error)
 *
 * @example Available units discount
 * const adjuster = {
 *   type: 'function',
 *   variable: 'available_units',
 *   function_string: '1.0 - 0.005*x',
 *   domain_min: 0,
 *   domain_max: 100
 * }
 * const context = {
 *   competitorData: [...],
 *   clientUnit: { available_units: 20 }
 * }
 * applyFunctionAdjuster(adjuster, context)
 * // Returns: 0.90 (10% discount)
 *
 * @example Rating-based premium
 * const adjuster = {
 *   type: 'function',
 *   variable: 'rating',
 *   function_string: '0.8 + 0.04*x',  // 80% base + 4% per rating point
 *   domain_min: 1,
 *   domain_max: 5
 * }
 * // If average competitor rating is 4.5:
 * // Multiplier = 0.8 + 0.04*4.5 = 0.98
 */
export function applyFunctionAdjuster(
  adjuster: FunctionBasedAdjuster,
  context: FunctionContext
): number {
  try {
    // Extract variable value from context
    const variableValue = extractVariableValue(adjuster.variable, context)

    if (variableValue === null) {
      console.warn(
        `[function-adjuster] Could not extract value for variable "${adjuster.variable}". Returning neutral multiplier 1.0`
      )
      return 1.0
    }

    // Check if value is within expected domain (warn but don't fail)
    if (variableValue < adjuster.domain_min || variableValue > adjuster.domain_max) {
      console.warn(
        `[function-adjuster] Variable "${adjuster.variable}" value ${variableValue} outside expected domain [${adjuster.domain_min}, ${adjuster.domain_max}]`
      )
      // Continue evaluation anyway - domain is for validation/UI, not hard constraint
    }

    // Evaluate function
    const result = evaluateSafeFunction(adjuster.function_string, variableValue)

    if (!result.success) {
      console.error(
        `[function-adjuster] Function evaluation failed for "${adjuster.function_string}" with x=${variableValue}: ${result.error}`
      )
      return 1.0
    }

    return result.value

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[function-adjuster] Unexpected error applying function adjuster:`, errorMessage)
    return 1.0
  }
}

/**
 * Validation result for function-based adjuster configuration
 */
export interface FunctionAdjusterValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates function-based adjuster configuration
 * Used in client-side validation before pipeline save
 *
 * Note: This is a wrapper around validateFunctionAdjusterConfig from function-eval
 * for consistency with other adjuster validation functions
 *
 * @param adjuster - Function-based adjuster to validate
 * @param availableColumns - List of valid column names in dataset (optional)
 * @returns Validation result with error message if invalid
 */
export function validateFunctionBasedAdjuster(
  adjuster: FunctionBasedAdjuster,
  availableColumns?: string[]
): FunctionAdjusterValidationResult {
  const result = validateFunctionAdjusterConfig(
    adjuster.variable,
    adjuster.function_string,
    adjuster.domain_min,
    adjuster.domain_max,
    availableColumns
  )

  return {
    valid: result.valid,
    error: result.error,
  }
}
