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
import { Calculator } from 'lucide-react'
import type { FunctionBasedAdjuster } from '@/lib/adjusters'

interface AddFunctionAdjusterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (adjuster: FunctionBasedAdjuster) => void
  availableVariables?: string[]
}

export function AddFunctionAdjusterDialog({
  open,
  onOpenChange,
  onAdd,
  availableVariables = [],
}: AddFunctionAdjusterDialogProps) {
  const [variable, setVariable] = useState('available_units')
  const [functionString, setFunctionString] = useState('1.0 - 0.005*x')
  const [domainMin, setDomainMin] = useState('0')
  const [domainMax, setDomainMax] = useState('100')

  const handleAdd = () => {
    const adjuster: FunctionBasedAdjuster = {
      type: 'function',
      variable,
      function_string: functionString,
      domain_min: parseFloat(domainMin),
      domain_max: parseFloat(domainMax),
    }
    onAdd(adjuster)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-l-4 border-l-amber-500">
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
                <SelectValue placeholder="Select a variable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available_units">
                  available_units (client inventory count)
                </SelectItem>
                {availableVariables.length > 0 && (
                  <>
                    {availableVariables.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
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
            <Input
              value={functionString}
              onChange={(e) => setFunctionString(e.target.value)}
              placeholder="1.0 - 0.005*x"
              className="font-mono text-sm focus:ring-amber-500"
            />
            <p className="text-xs text-muted-foreground">
              Math expression using &apos;x&apos;. Example: 1.0 - 0.005*x means 0.5% discount per unit
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Domain Min</Label>
              <Input
                type="number"
                value={domainMin}
                onChange={(e) => setDomainMin(e.target.value)}
                placeholder="0"
                className="focus:ring-amber-500"
              />
            </div>
            <div className="space-y-2">
              <Label>Domain Max</Label>
              <Input
                type="number"
                value={domainMax}
                onChange={(e) => setDomainMax(e.target.value)}
                placeholder="100"
                className="focus:ring-amber-500"
              />
            </div>
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
