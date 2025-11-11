/**
 * E2 Price Adjuster Type Definitions
 *
 * Adjusters apply sequentially to calculate final price:
 * 1. Competitive adjuster establishes base price from competitor data
 * 2. Function-based adjusters apply multipliers based on numeric variables
 * 3. Temporal adjusters apply time-based multipliers
 */

/**
 * Function-Based Price Adjuster
 *
 * Evaluates a mathematical function over a numeric variable to produce a multiplier.
 * The function string is evaluated using mathjs with restricted parser (safe eval).
 *
 * Example: Available units discount
 *   variable: "available_units"
 *   function_string: "1.0 - 0.005 * x"
 *   If available_units = 20: f(20) = 0.90 → 10% discount multiplier
 *
 * Domain bounds are used for:
 *   - Client-side validation (warn if out of range)
 *   - UI visualization (function plot preview)
 */
export interface FunctionBasedAdjuster {
  type: 'function'
  variable: string          // Column name from E1 dataset (e.g., "available_units", "rating", "distance_miles")
  function_string: string   // Math expression using 'x' as variable (e.g., "1.0 - 0.005*x", "0.8 + 0.02*x")
  domain_min: number        // Expected minimum value for variable (for validation/UI)
  domain_max: number        // Expected maximum value for variable (for validation/UI)
}

/**
 * Temporal Price Adjuster
 *
 * Applies time-based multipliers derived from snapshot timestamp.
 * Day of week and month are calculated from snapshot.date, NOT dataset columns.
 *
 * Weekly: 7 multipliers (Monday=0, Tuesday=1, ..., Sunday=6)
 * Monthly: 12 multipliers (January=0, February=1, ..., December=11)
 *
 * Example: Weekend premium
 *   granularity: "weekly"
 *   multipliers: [0.95, 0.95, 0.95, 0.98, 1.10, 1.15, 1.10]
 *   Friday (index 4) → 1.10 multiplier (10% premium)
 */
export interface TemporalAdjuster {
  type: 'temporal'
  granularity: 'weekly' | 'monthly'
  multipliers: number[]     // Length 7 for weekly, 12 for monthly
}

/**
 * Competitive Price Adjuster
 *
 * Aggregates competitor prices and applies multiplier.
 * Uses fallback chain strategy to maximize coverage across price columns.
 *
 * Fallback chain approach:
 *   price_columns: ["monthly_rate_web", "monthly_rate_online", "monthly_rate_standard"]
 *   For each competitor row, tries columns in order until non-null value found.
 *   This maximizes competitive landscape coverage (avoids bias from sparse columns).
 *
 * Example: Undercut minimum by 3%
 *   price_columns: ["monthly_rate_web", "monthly_rate_online", "monthly_rate_standard"]
 *   aggregation: "min"
 *   multiplier: 0.97
 *   If min competitor price = $100 → $97 base price
 *
 * Note: price_columns fallback chain may be subject to change based on stakeholder feedback.
 *       Current implementation uses hardcoded default chain but supports custom arrays.
 */
export interface CompetitivePriceAdjuster {
  type: 'competitive'
  price_columns: string[]       // Fallback chain (e.g., ["monthly_rate_web", "monthly_rate_online"])
  aggregation: 'min' | 'max' | 'avg'
  multiplier: number
}

/**
 * Union type for all adjuster types
 */
export type Adjuster =
  | FunctionBasedAdjuster
  | TemporalAdjuster
  | CompetitivePriceAdjuster

/**
 * Input to calculatePrice function
 */
export interface CalculatePriceInput {
  competitorData: E1DataRow[]     // Already filtered by E1 categorical filters
  clientUnit: ClientUnit           // Client inventory data (available_units)
  adjusters: Adjuster[]            // Sequential adjuster pipeline
  snapshotTimestamp: Date          // For temporal adjusters (day of week, month)
}

/**
 * E1 Unified Data Row (minimal type definition for price calculation)
 * Full schema documented in E1 unification design doc
 */
export interface E1DataRow {
  competitor_name: string
  // Price columns (43 total, subset shown)
  monthly_rate_web?: number | null
  monthly_rate_standard?: number | null
  monthly_rate_online?: number | null
  // Additional numeric variables for function adjusters
  rating?: number | null
  distance_miles?: number | null
  // ... other columns as needed
  [key: string]: unknown  // Allow dynamic column access
}

/**
 * Client Unit Data
 * Extracted from E0 /client endpoint
 */
export interface ClientUnit {
  available_units: number   // Count of client inventory rows (E0 data)
}

/**
 * Calculate Price Result
 * Currently returns single number (final price)
 * Future: May include breakdown of adjustment steps for debugging
 */
export type CalculatePriceResult = number

// Optional future: breakdown for transparency
// export interface CalculatePriceResultDetailed {
//   finalPrice: number
//   breakdown: AdjustmentStep[]
// }
//
// export interface AdjustmentStep {
//   adjusterType: string
//   inputPrice: number
//   multiplier: number
//   outputPrice: number
// }
