import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { CompetitivePriceAdjuster } from '@/lib/adjusters'
import { DEFAULT_PRICE_FALLBACK_CHAIN } from '@/lib/adjusters'
import { TrendingDown } from 'lucide-react'
import { useState } from 'react'

interface AddCompetitiveAdjusterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (adjuster: CompetitivePriceAdjuster) => void
  availablePriceColumns?: string[]
}

export function AddCompetitiveAdjusterDialog({
  open,
  onOpenChange,
  onAdd,
  availablePriceColumns,
}: AddCompetitiveAdjusterDialogProps) {
  const priceColumns = availablePriceColumns && availablePriceColumns.length > 0
    ? availablePriceColumns
    : DEFAULT_PRICE_FALLBACK_CHAIN
  const [aggregation, setAggregation] = useState<'min' | 'max' | 'avg'>('min')
  const [multiplier, setMultiplier] = useState('0.97')
  const [offset, setOffset] = useState('0')
  const [priceColumn, setPriceColumn] = useState<string>(priceColumns[0])

  const handleAdd = () => {
    const parsedMultiplier = parseFloat(multiplier);
    const parsedOffset = parseFloat(offset);
    const safeMultiplier = Number.isFinite(parsedMultiplier) ? Math.max(0.0001, parsedMultiplier) : 1;
    const safeOffset = Number.isFinite(parsedOffset) ? parsedOffset : 0;

    const adjuster: CompetitivePriceAdjuster = {
      type: 'competitive',
      price_columns: priceColumn ? [priceColumn] : [priceColumns[0]],
      aggregation,
      multiplier: safeMultiplier,
      offset: safeOffset,
    };
    onAdd(adjuster);
    onOpenChange(false);
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
            Set your base price from competitor prices. Choose how to aggregate their prices (minimum, maximum, or average), then apply a multiplier to position yourself relative to the market.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Price source column</Label>
            <Select value={priceColumn} onValueChange={setPriceColumn}>
              <SelectTrigger className="focus:ring-blue-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                  {priceColumns.map((column) => (
                  <SelectItem key={column} value={column}>{column}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              One column only. Aggregation is applied across competitors for this selected column.
            </p>
          </div>

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

          <div className="space-y-2">
            <Label>Offset</Label>
            <Input
              type="number"
              step="0.01"
              value={offset}
              onChange={(e) => setOffset(e.target.value)}
              placeholder="-1 or 5"
              className="focus:ring-blue-500"
            />
            <p className="text-xs text-muted-foreground">
              Positive adds, negative subtracts.
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
