import { useState } from 'react'
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
import { TrendingDown } from 'lucide-react'
import type { CompetitivePriceAdjuster } from '@/lib/adjusters'
import { DEFAULT_PRICE_FALLBACK_CHAIN } from '@/lib/adjusters'

interface AddCompetitiveAdjusterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (adjuster: CompetitivePriceAdjuster) => void
}

export function AddCompetitiveAdjusterDialog({
  open,
  onOpenChange,
  onAdd,
}: AddCompetitiveAdjusterDialogProps) {
  const [aggregation, setAggregation] = useState<'min' | 'max' | 'avg'>('min')
  const [multiplier, setMultiplier] = useState('0.97')

  const handleAdd = () => {
    const adjuster: CompetitivePriceAdjuster = {
      type: 'competitive',
      price_columns: DEFAULT_PRICE_FALLBACK_CHAIN,
      aggregation,
      multiplier: parseFloat(multiplier),
    }
    onAdd(adjuster)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-l-4 border-l-blue-500">
        <DialogHeader className="pb-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-blue-100 p-2">
              <TrendingDown className="h-5 w-5 text-blue-600" />
            </div>
            <DialogTitle>Add Competitive Adjuster</DialogTitle>
          </div>
          <div className="h-1 w-12 bg-blue-500 rounded-full mb-2"></div>
          <DialogDescription>
            Anchor the pipeline to live competitor pricing using the fallback column chain, then
            fine-tune the baseline with aggregation + multiplier before additional adjusters run.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Aggregation</Label>
            <Select value={aggregation} onValueChange={(v) => setAggregation(v as 'min' | 'max' | 'avg')}>
              <SelectTrigger className="focus:ring-blue-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="min">Minimum (undercut competitors)</SelectItem>
                <SelectItem value="max">Maximum (match highest competitor)</SelectItem>
                <SelectItem value="avg">Average (middle ground)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Multiplier</Label>
            <Input
              type="number"
              step="0.01"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              placeholder="0.97"
              className="focus:ring-blue-500"
            />
            <p className="text-xs text-muted-foreground">
              Example: 0.97 = 3% below competitors, 1.05 = 5% above
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} className="bg-blue-500 hover:bg-blue-600 text-white">
            Add Adjuster
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
