/**
 * Temporal Price Adjuster
 *
 * Applies time-based multipliers derived from snapshot timestamp.
 * Day of week and month are calculated from snapshot.date metadata, NOT dataset columns.
 *
 * Use cases:
 *   - Weekend pricing premiums
 *   - Seasonal adjustments (summer demand, holiday periods)
 *   - Day-of-week demand patterns
 */

import { TemporalAdjuster } from './types'

/**
 * Applies temporal multiplier based on snapshot timestamp
 *
 * @param adjuster - Temporal adjuster configuration
 * @param timestamp - Snapshot timestamp (from snapshot.date)
 * @returns Multiplier for the time period (1.0 neutral if error)
 *
 * @example Weekly premium (higher prices on weekends)
 * const adjuster = {
 *   type: 'temporal',
 *   granularity: 'weekly',
 *   multipliers: [0.95, 0.95, 0.95, 0.98, 1.10, 1.15, 1.10] // Mon-Sun
 * }
 * applyTemporalAdjuster(adjuster, new Date('2025-11-14')) // Friday
 * // Returns: 1.10 (10% premium)
 *
 * @example Monthly seasonal adjustment
 * const adjuster = {
 *   type: 'temporal',
 *   granularity: 'monthly',
 *   multipliers: [0.90, 0.90, 0.95, 1.0, 1.05, 1.10, 1.15, 1.10, 1.0, 0.95, 0.90, 0.85]
 * }
 * applyTemporalAdjuster(adjuster, new Date('2025-06-15')) // June (index 5)
 * // Returns: 1.10 (summer demand peak)
 */
export function applyTemporalAdjuster(
  adjuster: TemporalAdjuster,
  timestamp: Date
): number {
  try {
    // Validate timestamp
    if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
      console.warn('[temporal] Invalid timestamp provided, returning neutral multiplier 1.0')
      return 1.0
    }

    let index: number

    if (adjuster.granularity === 'weekly') {
      // Validate array length
      if (adjuster.multipliers.length !== 7) {
        console.error(
          `[temporal] Weekly adjuster requires exactly 7 multipliers, got ${adjuster.multipliers.length}. Returning neutral 1.0`
        )
        return 1.0
      }

      // Get day of week: JavaScript Date.getDay() returns 0=Sunday, 6=Saturday
      // We want 0=Monday, 6=Sunday for more intuitive business logic
      const jsDay = timestamp.getDay()
      index = jsDay === 0 ? 6 : jsDay - 1 // Convert: Sun(0)→6, Mon(1)→0, ..., Sat(6)→5

    } else if (adjuster.granularity === 'monthly') {
      // Validate array length
      if (adjuster.multipliers.length !== 12) {
        console.error(
          `[temporal] Monthly adjuster requires exactly 12 multipliers, got ${adjuster.multipliers.length}. Returning neutral 1.0`
        )
        return 1.0
      }

      // Get month: 0=January, 11=December (matches our indexing)
      index = timestamp.getMonth()

    } else {
      console.error(
        `[temporal] Invalid granularity: ${adjuster.granularity}. Expected 'weekly' or 'monthly'. Returning neutral 1.0`
      )
      return 1.0
    }

    // Get multiplier at index
    const multiplier = adjuster.multipliers[index]

    // Validate multiplier is a positive number
    if (typeof multiplier !== 'number' || !isFinite(multiplier)) {
      console.error(
        `[temporal] Invalid multiplier at index ${index}: ${multiplier}. Returning neutral 1.0`
      )
      return 1.0
    }

    if (multiplier <= 0) {
      console.warn(
        `[temporal] Non-positive multiplier at index ${index}: ${multiplier}. Using absolute value.`
      )
      return Math.abs(multiplier)
    }

    return multiplier

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[temporal] Unexpected error applying temporal adjuster:`, errorMessage)
    return 1.0
  }
}

/**
 * Validation result for temporal adjuster configuration
 */
export interface TemporalValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates temporal adjuster configuration
 * Used in client-side validation before pipeline save
 *
 * @param adjuster - Temporal adjuster to validate
 * @returns Validation result with error message if invalid
 */
export function validateTemporalAdjuster(
  adjuster: TemporalAdjuster
): TemporalValidationResult {
  // Validate granularity
  if (adjuster.granularity !== 'weekly' && adjuster.granularity !== 'monthly') {
    return {
      valid: false,
      error: `Invalid granularity: ${adjuster.granularity}. Must be 'weekly' or 'monthly'`,
    }
  }

  // Validate multipliers array exists
  if (!Array.isArray(adjuster.multipliers)) {
    return {
      valid: false,
      error: 'Multipliers must be an array',
    }
  }

  // Validate array length
  const expectedLength = adjuster.granularity === 'weekly' ? 7 : 12
  if (adjuster.multipliers.length !== expectedLength) {
    return {
      valid: false,
      error: `${adjuster.granularity === 'weekly' ? 'Weekly' : 'Monthly'} adjuster requires exactly ${expectedLength} multipliers, got ${adjuster.multipliers.length}`,
    }
  }

  // Validate all multipliers are positive numbers
  for (let i = 0; i < adjuster.multipliers.length; i++) {
    const mult = adjuster.multipliers[i]
    if (typeof mult !== 'number' || !isFinite(mult)) {
      return {
        valid: false,
        error: `Multiplier at index ${i} is not a finite number: ${mult}`,
      }
    }
    if (mult <= 0) {
      return {
        valid: false,
        error: `Multiplier at index ${i} must be positive: ${mult}`,
      }
    }
  }

  return { valid: true }
}

/**
 * Helper: Get day name for weekly index (0=Monday, 6=Sunday)
 */
export function getDayName(index: number): string {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  return days[index] || 'Unknown'
}

/**
 * Helper: Get month name for monthly index (0=January, 11=December)
 */
export function getMonthName(index: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[index] || 'Unknown'
}
