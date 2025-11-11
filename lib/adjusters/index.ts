/**
 * E2 Price Adjusters Module
 *
 * Client-side price calculation engine for Auto Pricing application.
 *
 * Module exports:
 *   - Type definitions (Adjuster union types, input/output interfaces)
 *   - Main calculation function (calculatePrice)
 *   - Individual adjuster implementations (for testing/debugging)
 *   - Validation functions (for client-side form validation)
 */

// Core types
export type {
  Adjuster,
  CompetitivePriceAdjuster,
  FunctionBasedAdjuster,
  TemporalAdjuster,
  CalculatePriceInput,
  CalculatePriceResult,
  E1DataRow,
  ClientUnit,
} from './types'

// Main calculation engine
export { calculatePrice, validateAdjusterPipeline } from './engine'
export type { PipelineValidationResult } from './engine'

// Individual adjuster implementations (for testing/debugging)
export { applyCompetitiveAdjuster, validateCompetitiveAdjuster, DEFAULT_PRICE_FALLBACK_CHAIN } from './competitive'
export type { CompetitiveValidationResult } from './competitive'

export { applyFunctionAdjuster, validateFunctionBasedAdjuster } from './function-adjuster'
export type { FunctionContext, FunctionAdjusterValidationResult } from './function-adjuster'

export { applyTemporalAdjuster, validateTemporalAdjuster, getDayName, getMonthName } from './temporal'
export type { TemporalValidationResult } from './temporal'

// Function evaluation utilities (for form validation/preview)
export {
  evaluateSafeFunction,
  validateFunctionSyntax,
  testFunctionEvaluation,
  validateFunctionAdjusterConfig,
} from './function-eval'
export type { EvaluationResult, ValidationResult } from './function-eval'

// Data validation utilities (for UI warnings)
export { hasValidCompetitorPrices, getPriceDiagnostics, formatColumnName } from './validation'
