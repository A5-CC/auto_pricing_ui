"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { CheckIcon, ListTreeIcon, ChevronsUpDownIcon } from "lucide-react"

type GroupOption = {
  id: string
  label: string
}

export function GroupByControl({
  value,
  options,
  onChange,
  onExpandAll,
  onCollapseAll,
  fullWidth = true,
  className,
}: {
  value: string | null
  options: GroupOption[]
  onChange: (next: string | null) => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  fullWidth?: boolean
  className?: string
}) {
  const current = useMemo(() => options.find(o => o.id === value) ?? null, [options, value])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-label="Group by"
          className={cn(fullWidth ? "w-full" : "", "justify-between", className)}
        >
          <span className="inline-flex items-center gap-2 truncate">
            <ListTreeIcon className="size-4 text-muted-foreground" />
            <span className="truncate">
              {current ? `Group by: ${current.label}` : "Group by"}
            </span>
          </span>
          <ChevronsUpDownIcon className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="min-w-[var(--radix-popover-trigger-width)] p-0" align="end">
        <Command>
          <CommandList>
            <CommandGroup heading="Options">
              <CommandItem
                value="none"
                onSelect={() => onChange(null)}
                aria-selected={value == null}
              >
                <CheckIcon className={`mr-2 size-4 ${value == null ? "opacity-100" : "opacity-0"}`} />
                None
              </CommandItem>
              {options.map(opt => (
                <CommandItem
                  key={opt.id}
                  value={opt.id}
                  onSelect={() => onChange(opt.id)}
                  aria-selected={value === opt.id}
                >
                  <CheckIcon className={`mr-2 size-4 ${value === opt.id ? "opacity-100" : "opacity-0"}`} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {value && (onExpandAll || onCollapseAll) ? (
              <CommandGroup heading="Groups">
                {onExpandAll ? (
                  <CommandItem value="__expand_all" onSelect={() => onExpandAll?.()}>
                    Expand all
                  </CommandItem>
                ) : null}
                {onCollapseAll ? (
                  <CommandItem value="__collapse_all" onSelect={() => onCollapseAll?.()}>
                    Collapse all
                  </CommandItem>
                ) : null}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default GroupByControl


