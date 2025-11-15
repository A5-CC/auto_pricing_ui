import { useState, useEffect, useMemo } from 'react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Clock, RotateCcw } from 'lucide-react'
import type { TemporalAdjuster } from '@/lib/adjusters'
import { validateTemporalAdjuster } from '@/lib/adjusters'

interface AddTemporalAdjusterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (adjuster: TemporalAdjuster) => void
}

// Day and month labels
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Default multiplier values
const DEFAULT_WEEKLY_MULTIPLIERS = [0.9, 0.92, 0.95, 0.98, 1.1, 1.15, 1.12]
const DEFAULT_MONTHLY_MULTIPLIERS = [1.0, 1.0, 1.05, 1.05, 1.1, 1.15, 1.2, 1.15, 1.1, 1.05, 1.0, 0.95]

export function AddTemporalAdjusterDialog({
  open,
  onOpenChange,
  onAdd,
}: AddTemporalAdjusterDialogProps) {
  const [granularity, setGranularity] = useState<'weekly' | 'monthly'>('weekly')
  const [multipliers, setMultipliers] = useState(DEFAULT_WEEKLY_MULTIPLIERS)

  // Auto-update multipliers when granularity changes
  useEffect(() => {
    if (granularity === 'weekly') {
      setMultipliers(DEFAULT_WEEKLY_MULTIPLIERS)
    } else {
      setMultipliers(DEFAULT_MONTHLY_MULTIPLIERS)
    }
  }, [granularity])

  // Validate temporal adjuster configuration
  const validation = useMemo(() => {
    return validateTemporalAdjuster({
      type: 'temporal',
      granularity,
      multipliers,
    })
  }, [granularity, multipliers])

  const handleMultiplierChange = (index: number, value: string) => {
    const newMultipliers = [...multipliers]
    const parsedValue = parseFloat(value)
    newMultipliers[index] = isNaN(parsedValue) ? 1.0 : parsedValue
    setMultipliers(newMultipliers)
  }

  const resetToDefaults = () => {
    if (granularity === 'weekly') {
      setMultipliers(DEFAULT_WEEKLY_MULTIPLIERS)
    } else {
      setMultipliers(DEFAULT_MONTHLY_MULTIPLIERS)
    }
  }

  const handleAdd = () => {
    if (!validation.valid) return

    const adjuster: TemporalAdjuster = {
      type: 'temporal',
      granularity,
      multipliers,
    }
    onAdd(adjuster)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-l-4 border-l-violet-500">
        <DialogHeader className="pb-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-violet-100 p-2">
              <Clock className="h-5 w-5 text-violet-600" />
            </div>
            <DialogTitle>Add Temporal Adjuster</DialogTitle>
          </div>
          <div className="h-1 w-12 bg-violet-500 rounded-full mb-2"></div>
          <DialogDescription>
            Apply predictable weekly or monthly multipliers to smooth demand swings and bake in
            seasonality before the final price is emitted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Granularity</Label>
            <RadioGroup value={granularity} onValueChange={(v) => setGranularity(v as 'weekly' | 'monthly')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="weekly" id="weekly" />
                <Label htmlFor="weekly" className="font-normal cursor-pointer">
                  Weekly (7 values: Mon-Sun)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="monthly" id="monthly" />
                <Label htmlFor="monthly" className="font-normal cursor-pointer">
                  Monthly (12 values: Jan-Dec)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Multipliers</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetToDefaults}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset to defaults
              </Button>
            </div>

            {/* Weekly Grid */}
            {granularity === 'weekly' && (
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-2">
                  {/* Monday - Friday */}
                  {WEEK_DAYS.slice(0, 5).map((day, index) => (
                    <div key={day} className="text-center min-w-0">
                      <Label className="text-xs font-medium text-muted-foreground mb-1 block">
                        {day}
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={multipliers[index] || 1.0}
                        onChange={(e) => handleMultiplierChange(index, e.target.value)}
                        className={`h-10 text-center text-sm font-mono focus:ring-violet-500 w-full ${
                          !validation.valid && validation.error ? 'border-destructive focus:ring-destructive' : ''
                        }`}
                        placeholder="1.0"
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                  {/* Saturday - Sunday */}
                  {WEEK_DAYS.slice(5).map((day, index) => (
                    <div key={day} className="text-center min-w-0">
                      <Label className="text-xs font-medium text-muted-foreground mb-1 block">
                        {day}
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={multipliers[index + 5] || 1.0}
                        onChange={(e) => handleMultiplierChange(index + 5, e.target.value)}
                        className={`h-10 text-center text-sm font-mono focus:ring-violet-500 w-full ${
                          !validation.valid && validation.error ? 'border-destructive focus:ring-destructive' : ''
                        }`}
                        placeholder="1.0"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Set multipliers for weekdays and weekend
                </p>
              </div>
            )}

            {/* Monthly Grid */}
            {granularity === 'monthly' && (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto p-2 pr-3 bg-muted/20 rounded-lg">
                  {MONTHS.map((month, index) => (
                    <div key={month} className="text-center min-w-0">
                      <Label className="text-xs font-medium text-muted-foreground mb-1 block truncate">
                        {month}
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={multipliers[index] || 1.0}
                        onChange={(e) => handleMultiplierChange(index, e.target.value)}
                        className={`h-10 text-center text-sm font-mono focus:ring-violet-500 w-full ${
                          !validation.valid && validation.error ? 'border-destructive focus:ring-destructive' : ''
                        }`}
                        placeholder="1.0"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Set multipliers for each month of the year
                </p>
              </div>
            )}

            {!validation.valid && validation.error && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1">
                <span>⚠</span> {validation.error}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!validation.valid} className="bg-violet-500 hover:bg-violet-600 text-white disabled:opacity-50">
            Add Adjuster
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
