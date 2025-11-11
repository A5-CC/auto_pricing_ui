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
import { Clock } from 'lucide-react'
import type { TemporalAdjuster } from '@/lib/adjusters'
import { validateTemporalAdjuster } from '@/lib/adjusters'

interface AddTemporalAdjusterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (adjuster: TemporalAdjuster) => void
}

// Default multiplier values
const DEFAULT_WEEKLY_MULTIPLIERS = '0.9, 0.92, 0.95, 0.98, 1.1, 1.15, 1.12'
const DEFAULT_MONTHLY_MULTIPLIERS = '1.0, 1.0, 1.05, 1.05, 1.1, 1.15, 1.2, 1.15, 1.1, 1.05, 1.0, 0.95'

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
    const parsedMultipliers = multipliers
      .split(',')
      .map((m) => parseFloat(m.trim()))
      .filter((m) => !isNaN(m))

    return validateTemporalAdjuster({
      type: 'temporal',
      granularity,
      multipliers: parsedMultipliers,
    })
  }, [granularity, multipliers])

  const handleAdd = () => {
    if (!validation.valid) return

    const parsedMultipliers = multipliers
      .split(',')
      .map((m) => parseFloat(m.trim()))
      .filter((m) => !isNaN(m))

    const adjuster: TemporalAdjuster = {
      type: 'temporal',
      granularity,
      multipliers: parsedMultipliers,
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

          <div className="space-y-2">
            <Label>Multipliers (comma-separated)</Label>
            <Input
              value={multipliers}
              onChange={(e) => setMultipliers(e.target.value)}
              placeholder={
                granularity === 'weekly'
                  ? DEFAULT_WEEKLY_MULTIPLIERS
                  : DEFAULT_MONTHLY_MULTIPLIERS
              }
              className={`font-mono text-sm focus:ring-violet-500 ${!validation.valid && validation.error ? 'border-destructive focus:ring-destructive' : ''}`}
            />
            <p className="text-xs text-muted-foreground">
              {granularity === 'weekly'
                ? 'Exactly 7 values for Mon, Tue, Wed, Thu, Fri, Sat, Sun'
                : 'Exactly 12 values for Jan through Dec'}
            </p>
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
