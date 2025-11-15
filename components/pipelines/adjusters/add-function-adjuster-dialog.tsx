import { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calculator, Equal } from 'lucide-react'
import type { FunctionBasedAdjuster } from '@/lib/adjusters'
import { evaluateSafeFunction, validateFunctionSyntax } from '@/lib/adjusters'
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import type { E1DataRow } from '@/lib/api/types'
import { toast } from 'sonner'

interface AddFunctionAdjusterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (adjuster: FunctionBasedAdjuster) => void
  availableVariables?: string[]
  competitorData?: E1DataRow[]
  clientAvailableUnits?: number
}

function formatVariableName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function AddFunctionAdjusterDialog({
  open,
  onOpenChange,
  onAdd,
  availableVariables = [],
  competitorData = [],
  clientAvailableUnits = 0,
}: AddFunctionAdjusterDialogProps) {
  const [variable, setVariable] = useState('available_units')
  const [functionString, setFunctionString] = useState('1.0 - 0.005*x')
  const [committedFunction, setCommittedFunction] = useState('1.0 - 0.005*x')
  const [domainMin, setDomainMin] = useState('0')
  const [domainMax, setDomainMax] = useState('100')

  // Auto-detect domain min/max from dataset when variable changes
  useEffect(() => {
    if (!variable) return

    let min: number | null = null
    let max: number | null = null

    // Special case: available_units from client data
    if (variable === 'available_units') {
      min = 0
      max = clientAvailableUnits || 100
    } else {
      // Extract values from competitor data
      const values: number[] = []
      for (const row of competitorData) {
        const value = row[variable]
        if (typeof value === 'number' && isFinite(value)) {
          values.push(value)
        }
      }

      if (values.length > 0) {
        min = Math.min(...values)
        max = Math.max(...values)

        // Add 10% padding for better visualization
        const range = max - min
        if (range > 0) {
          min = Math.floor(min - range * 0.1)
          max = Math.ceil(max + range * 0.1)
        }
      }
    }

    // Only update if we found valid min/max
    if (min !== null && max !== null) {
      setDomainMin(min.toString())
      setDomainMax(max.toString())
    }
  }, [variable, competitorData, clientAvailableUnits])

  // Commit function for evaluation
  const handleCommitFunction = () => {
    setCommittedFunction(functionString)
  }

  // Handle Enter key to commit function
  const handleFunctionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommitFunction()
    }
  }

  // Evaluate function at sample points for preview
  const evaluateFunction = (xValue: number): number | null => {
    const result = evaluateSafeFunction(committedFunction, xValue)
    return result.success ? result.value : null
  }

  // Generate graph data points
  const graphData = useMemo(() => {
    const min = parseFloat(domainMin) || 0
    const max = parseFloat(domainMax) || 100
    const numPoints = 50 // Smooth curve with 50 points
    const step = (max - min) / (numPoints - 1)

    const points: { x: number; multiplier: number | null }[] = []

    for (let i = 0; i < numPoints; i++) {
      const xVal = min + (i * step)
      const result = evaluateSafeFunction(committedFunction, xVal)
      points.push({
        x: xVal,
        multiplier: result.success ? result.value : null
      })
    }

    return points
  }, [committedFunction, domainMin, domainMax])

  // Check if function is valid (all points succeeded)
  const isFunctionValid = useMemo(() => {
    return graphData.every(point => point.multiplier !== null)
  }, [graphData])

  // Calculate Y-axis domain for debugging
  const yAxisDomain = useMemo(() => {
    const validPoints = graphData.filter(p => p.multiplier !== null).map(p => p.multiplier as number)
    if (validPoints.length === 0) return [0, 1]

    const dataMin = Math.min(...validPoints)
    const dataMax = Math.max(...validPoints)
    const paddedMin = dataMin * 0.9
    const paddedMax = dataMax * 1.1

    console.log('[YAxis Debug]', {
      dataMin,
      dataMax,
      paddedMin,
      paddedMax,
      validPointsCount: validPoints.length
    })

    return [paddedMin, paddedMax]
  }, [graphData])

  const handleAdd = () => {
    // Validate function syntax before adding
    const syntaxValidation = validateFunctionSyntax(functionString)
    if (!syntaxValidation.valid) {
      toast.error('Invalid function expression', {
        description: syntaxValidation.error || 'Please check your function syntax and try again.',
      })
      return
    }

    // Validate domain values
    const min = parseFloat(domainMin)
    const max = parseFloat(domainMax)
    if (!isFinite(min) || !isFinite(max)) {
      toast.error('Invalid domain values', {
        description: 'Domain min and max must be valid numbers.',
      })
      return
    }
    if (min >= max) {
      toast.error('Invalid domain range', {
        description: 'Domain minimum must be less than maximum.',
      })
      return
    }

    const adjuster: FunctionBasedAdjuster = {
      type: 'function',
      variable,
      function_string: functionString,
      domain_min: min,
      domain_max: max,
    }
    onAdd(adjuster)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-l-4 border-l-amber-500">
        <DialogHeader className="pb-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-amber-100 p-2">
              <Calculator className="h-5 w-5 text-amber-600" />
            </div>
            <DialogTitle>Add Function Adjuster</DialogTitle>
          </div>
          <div className="h-1 w-12 bg-amber-500 rounded-full mb-2"></div>
          <DialogDescription>
            Apply a custom math expression to any numeric field so the resulting multiplier reacts
            to dataset signals (e.g., inventory, rating, distance).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Variable</Label>
            <Select value={variable} onValueChange={setVariable}>
              <SelectTrigger className="focus:ring-amber-500">
                <SelectValue placeholder="Select a variable">
                  {formatVariableName(variable)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available_units">
                  Available Units
                </SelectItem>
                {availableVariables.length > 0 && (
                  <>
                    {availableVariables.map((col) => (
                      <SelectItem key={col} value={col}>
                        {formatVariableName(col)}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select a numeric variable from the dataset to use in your function
            </p>
          </div>

          <div className="space-y-2">
            <Label>Function (using &apos;x&apos; as variable)</Label>
            <div className="relative">
              <Input
                value={functionString}
                onChange={(e) => setFunctionString(e.target.value)}
                onKeyDown={handleFunctionKeyDown}
                placeholder="1.0 - 0.005*x"
                className="font-mono text-sm focus:ring-amber-500 pr-12"
              />
              <button
                type="button"
                onClick={handleCommitFunction}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-sm bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center transition-colors"
                aria-label="Evaluate function"
              >
                <Equal className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Math expression using &apos;x&apos;. Press Enter or click = to evaluate
            </p>

            {/* Example Value Preview */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 mt-2">
              <p className="text-xs font-semibold text-amber-900 mb-2">Preview</p>
              <div className="flex items-center gap-4 text-xs font-mono">
                {(() => {
                  const min = parseFloat(domainMin) || 0
                  const max = parseFloat(domainMax) || 100
                  const mid = (min + max) / 2

                  const minResult = evaluateFunction(min)
                  const midResult = evaluateFunction(mid)
                  const maxResult = evaluateFunction(max)

                  if (minResult === null || midResult === null || maxResult === null) {
                    return <span className="text-red-600">Invalid expression</span>
                  }

                  return (
                    <>
                      <span className="text-muted-foreground">
                        x={min.toFixed(0)} → <strong className="text-foreground">{minResult.toFixed(2)}</strong>
                      </span>
                      <span className="text-muted-foreground">
                        x={mid.toFixed(0)} → <strong className="text-foreground">{midResult.toFixed(2)}</strong>
                      </span>
                      <span className="text-muted-foreground">
                        x={max.toFixed(0)} → <strong className="text-foreground">{maxResult.toFixed(2)}</strong>
                      </span>
                    </>
                  )
                })()}
              </div>
            </div>

            {/* Function Graph Preview */}
            {isFunctionValid ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 mt-2">
                <p className="text-xs font-semibold text-amber-900 mb-2">Function Curve</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <span className="font-medium">Preview Range:</span>
                  <Input
                    type="number"
                    value={domainMin}
                    onChange={(e) => setDomainMin(e.target.value)}
                    className="w-20 h-7 text-xs"
                  />
                  <span>—</span>
                  <Input
                    type="number"
                    value={domainMax}
                    onChange={(e) => setDomainMax(e.target.value)}
                    className="w-20 h-7 text-xs"
                  />
                </div>
                <ChartContainer
                  config={{
                    multiplier: {
                      label: "Multiplier",
                      color: "hsl(38, 92%, 50%)", // amber-500
                    },
                  }}
                  className="h-[200px] w-full"
                >
                  <LineChart
                    data={graphData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-amber-200" />
                    <XAxis
                      dataKey="x"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value: number) => Number.isInteger(value) ? value.toString() : value.toFixed(1)}
                      label={{ value: formatVariableName(variable), position: 'insideBottom', offset: -5, fontSize: 11 }}
                      stroke="hsl(45, 93%, 47%)" // amber-600
                    />
                    <YAxis
                      type="number"
                      domain={yAxisDomain}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value: number) => {
                        if (!isFinite(value) || value === null || value === undefined) return ''
                        return value.toFixed(2)
                      }}
                      label={{ value: 'Multiplier', angle: -90, position: 'left', fontSize: 11 }}
                      stroke="hsl(45, 93%, 47%)" // amber-600
                    />
                    <Line
                      type="monotone"
                      dataKey="multiplier"
                      stroke="hsl(38, 92%, 50%)" // amber-500
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} className="bg-amber-500 hover:bg-amber-600 text-white">
            Add Adjuster
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
