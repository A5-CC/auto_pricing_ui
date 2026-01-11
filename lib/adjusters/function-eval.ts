/**
 * Safe Function Evaluation using mathjs
 *
 * Provides secure evaluation of mathematical expressions for function-based adjusters.
 * Uses mathjs restricted parser to prevent code injection.
 *
 * Security context:
 *   - Internal users only (not public SaaS)
 *   - Worst case: incorrect multiplier for single session (no persistence)
 *   - Mathjs sandbox blocks: JS globals, imports, filesystem, network
 *
 * Runtime failsafe: Evaluation errors return 1.0 neutral multiplier with warning log
 */

import { create, all, MathJsInstance } from 'mathjs'

/**
 * Mathjs instance with default configuration
 * Sandbox mode automatically restricts dangerous operations
 */
const math: MathJsInstance = create(all)

// Track which function strings have already emitted a negative-result warning
const warnedNegativeFunctions = new Set<string>()

/**
 * Evaluation result
 */
export interface EvaluationResult {
  success: boolean
  value: number          // Always returns a number (1.0 if error)
  error?: string         // Error message if evaluation failed
}

/**
 * Evaluates a mathematical function string with a given x value
 *
 * @param functionString - Math expression using 'x' as variable (e.g., "1.0 - 0.005*x")
 * @param xValue - Numeric value to substitute for x
 * @returns EvaluationResult with multiplier (1.0 neutral if error)
 *
 * @example
 * evaluateSafeFunction("1.0 - 0.005*x", 20)
 * // Returns: { success: true, value: 0.90 }
 *
 * evaluateSafeFunction("1.0 / 0", 10)
 * // Returns: { success: false, value: 1.0, error: "Division by zero" }
 */
export function evaluateSafeFunction(
  functionString: string,
  xValue: number
): EvaluationResult {
  try {
    // Evaluate expression with x as scope variable
    const result = math.evaluate(functionString, { x: xValue })

    // Validate result is finite number
    if (typeof result !== 'number' || !isFinite(result)) {
      console.warn(
        `[function-eval] Non-numeric or non-finite result: ${result} for f="${functionString}", x=${xValue}`
      )
      return {
        success: false,
        value: 1.0,
        error: `Result is not a finite number: ${result}`,
      }
    }

    // Warn if result is negative (multipliers should be non-negative).
    // Clamp negatives to 0.0 to avoid sign flips; warn only once per function string
    if (typeof result === 'number' && result < 0) {
      if (!warnedNegativeFunctions.has(functionString)) {
        console.warn(
          `[function-eval] Negative multiplier: ${result} for f="${functionString}", x=${xValue}. Clamping to 0.0.`
        )
        warnedNegativeFunctions.add(functionString)
      }
      return {
        success: true,
        value: 0.0,
      }
    }

    return {
      success: true,
      value: result,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error)
    console.error(
      `[function-eval] Evaluation failed for f="${functionString}", x=${xValue}:`,
      errorMessage
    )
    return {
      success: false,
      value: 1.0,
      error: errorMessage,
    }
  }
}

/**
 * Validation result for function string syntax
 */
export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates function string syntax without executing it
 *
 * @param functionString - Math expression to validate
 * @returns ValidationResult indicating if syntax is valid
 *
 * @example
 * validateFunctionSyntax("1.0 - 0.005*x")
 * // Returns: { valid: true }
 *
 * validateFunctionSyntax("1.0 - 0.005*")
 * // Returns: { valid: false, error: "Unexpected end of expression" }
 */
export function validateFunctionSyntax(
  functionString: string
): ValidationResult {
  if (!functionString || functionString.trim() === '') {
    return {
      valid: false,
      error: 'Function string cannot be empty',
    }
  }

  try {
    // Parse the expression (doesn't evaluate, just checks syntax)
    math.parse(functionString)

    // Check if expression uses 'x' variable
    // Note: mathjs doesn't provide easy way to extract variables, so we do string check
    if (!functionString.includes('x')) {
      return {
        valid: false,
        error: 'Function must use variable "x"',
      }
    }

    return { valid: true }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error)
    return {
      valid: false,
      error: errorMessage,
    }
  }
}

/**
 * Tests function evaluation with sample values to catch runtime issues
 *
 * @param functionString - Math expression to test
 * @param testValues - Array of test x values (defaults to common test cases)
 * @returns ValidationResult with error if any test fails
 *
 * @example
 * testFunctionEvaluation("1.0 - 0.005*x", [0, 10, 20, 50])
 * // Returns: { valid: true } if all evaluations succeed
 *
 * testFunctionEvaluation("1.0 / x", [0, 10, 20])
 * // Returns: { valid: false, error: "Division by zero at x=0" }
 */
export function testFunctionEvaluation(
  functionString: string,
  testValues: number[] = [0, 1, 10, 100, 1000]
): ValidationResult {
  // First check syntax
  const syntaxCheck = validateFunctionSyntax(functionString)
  if (!syntaxCheck.valid) {
    return syntaxCheck
  }

  // Test evaluation with sample values
  for (const testValue of testValues) {
    const result = evaluateSafeFunction(functionString, testValue)
    if (!result.success) {
      return {
        valid: false,
        error: `Evaluation failed at x=${testValue}: ${result.error}`,
      }
    }
  }

  return { valid: true }
}

/**
 * Comprehensive validation for FunctionBasedAdjuster config
 * Used in client-side validation before pipeline save
 *
 * @param variable - Variable name from dataset
 * @param functionString - Math expression
 * @param domainMin - Expected minimum value
 * @param domainMax - Expected maximum value
 * @param availableColumns - List of valid column names in dataset (optional)
 * @returns ValidationResult with detailed error message
 */
export function validateFunctionAdjusterConfig(
  variable: string,
  functionString: string,
  domainMin: number,
  domainMax: number,
  availableColumns?: string[]
): ValidationResult {
  // Validate variable name
  if (!variable || variable.trim() === '') {
    return {
      valid: false,
      error: 'Variable name cannot be empty',
    }
  }

  // Check if variable exists in dataset (if column list provided)
  if (availableColumns && !availableColumns.includes(variable)) {
    return {
      valid: false,
      error: `Variable "${variable}" not found in dataset. Available: ${availableColumns.join(', ')}`,
    }
  }

  // Validate domain
  if (!isFinite(domainMin) || !isFinite(domainMax)) {
    return {
      valid: false,
      error: 'Domain bounds must be finite numbers',
    }
  }

  if (domainMin >= domainMax) {
    return {
      valid: false,
      error: `Domain minimum (${domainMin}) must be less than maximum (${domainMax})`,
    }
  }

  // Validate function syntax
  const syntaxCheck = validateFunctionSyntax(functionString)
  if (!syntaxCheck.valid) {
    return syntaxCheck
  }

  // Test evaluation at domain boundaries and midpoint
  const testValues = [domainMin, (domainMin + domainMax) / 2, domainMax]
  const evalTest = testFunctionEvaluation(functionString, testValues)
  if (!evalTest.valid) {
    return evalTest
  }

  return { valid: true }
}
