"use client"

import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react"
import { Badge } from "@/components/ui/badge"

type MultiSelectContextType = {
  open: boolean
  setOpen: (open: boolean) => void
  selectedValues: Set<string>
  toggleValue: (value: string) => void
  items: Map<string, ReactNode>
  onItemAdded: (value: string, label: ReactNode) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
}
const MultiSelectContext = createContext<MultiSelectContextType | null>(null)

export function MultiSelect({
  children,
  values,
  defaultValues,
  onValuesChange,
}: {
  children: ReactNode
  values?: string[]
  defaultValues?: string[]
  onValuesChange?: (values: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [selectedValues, setSelectedValues] = useState(
    new Set<string>(values ?? defaultValues),
  )
  const [items, setItems] = useState<Map<string, ReactNode>>(new Map())
  const [searchTerm, setSearchTerm] = useState("")

  function toggleValue(value: string) {
    const getNewSet = (prev: Set<string>) => {
      const newSet = new Set(prev)
      if (newSet.has(value)) {
        newSet.delete(value)
      } else {
        newSet.add(value)
      }
      return newSet
    }
    setSelectedValues(getNewSet)
    onValuesChange?.([...getNewSet(selectedValues)])
  }

  const onItemAdded = useCallback((value: string, label: ReactNode) => {
    setItems(prev => {
      if (prev.get(value) === label) return prev
      return new Map(prev).set(value, label)
    })
  }, [])

  const contextSelectedValues = useMemo(() => {
    return values ? new Set(values) : selectedValues
  }, [values, selectedValues])

  // Reset search when closing
  useEffect(() => {
    if (!open) {
      setSearchTerm("")
    }
  }, [open])

  return (
    <MultiSelectContext
      value={{
        open,
        setOpen,
        selectedValues: contextSelectedValues,
        toggleValue,
        items,
        onItemAdded,
        searchTerm,
        setSearchTerm,
      }}
    >
      <Popover open={open} onOpenChange={setOpen}>
        {children}
      </Popover>
    </MultiSelectContext>
  )
}

export function MultiSelectTrigger({
  className,
  children,
  ...props
}: {
  className?: string
  children?: ReactNode
} & ComponentPropsWithoutRef<typeof Button>) {
  const { open } = useMultiSelectContext()

  return (
    <PopoverTrigger asChild>
      <Button
        {...props}
        variant={props.variant ?? "outline"}
        role={props.role ?? "combobox"}
        aria-expanded={props["aria-expanded"] ?? open}
        className={cn(
          "flex h-auto min-h-9 w-fit items-center justify-between gap-2 overflow-hidden rounded-md border border-input bg-transparent px-3 py-1.5 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
          className,
        )}
      >
        {children}
        <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
  )
}

export function MultiSelectValue({
  placeholder,
  clickToRemove = true,
  className,
  overflowBehavior = "wrap-when-open",
  ...props
}: {
  placeholder?: string
  clickToRemove?: boolean
  overflowBehavior?: "wrap" | "wrap-when-open" | "cutoff"
} & Omit<ComponentPropsWithoutRef<"div">, "children">) {
  const { selectedValues, toggleValue, items, open } = useMultiSelectContext()
  const [overflowAmount, setOverflowAmount] = useState(0)
  const valueRef = useRef<HTMLDivElement>(null)
  const overflowRef = useRef<HTMLDivElement>(null)

  const shouldWrap =
    overflowBehavior === "wrap" ||
    (overflowBehavior === "wrap-when-open" && open)

  const checkOverflow = useCallback(() => {
    if (valueRef.current == null) return

    const containerElement = valueRef.current
    const overflowElement = overflowRef.current
    const items = containerElement.querySelectorAll<HTMLElement>(
      "[data-selected-item]",
    )

    if (overflowElement != null) overflowElement.style.display = "none"
    items.forEach(child => child.style.removeProperty("display"))
    let amount = 0
    for (let i = items.length - 1; i >= 0; i--) {
      const child = items[i]
      if (containerElement.scrollWidth <= containerElement.clientWidth) {
        break
      }
      amount = items.length - i
      child.style.display = "none"
      overflowElement?.style.removeProperty("display")
    }
    setOverflowAmount(amount)
  }, [])

  useLayoutEffect(() => {
    checkOverflow()
  }, [selectedValues, checkOverflow, shouldWrap])

  const handleResize = useCallback(
    (node: HTMLDivElement) => {
      valueRef.current = node

      const observer = new ResizeObserver(checkOverflow)
      observer.observe(node)

      return () => {
        observer.disconnect()
        valueRef.current = null
      }
    },
    [checkOverflow],
  )

  if (selectedValues.size === 0 && placeholder) {
    return (
      <span className="min-w-0 overflow-hidden font-normal text-foreground/70">
        {placeholder}
      </span>
    )
  }

  return (
    <div
      {...props}
      ref={handleResize}
      className={cn(
        "flex w-full gap-1.5 overflow-hidden",
        shouldWrap && "h-full flex-wrap",
        className,
      )}
    >
      {[...selectedValues]
        .filter(value => items.has(value))
        .map(value => (
          <Badge
            variant="outline"
            data-selected-item
            className="group flex items-center gap-1"
            key={value}
            onClick={
              clickToRemove
                ? e => {
                    e.stopPropagation()
                    toggleValue(value)
                  }
                : undefined
            }
          >
            {items.get(value)}
            {clickToRemove && (
              <XIcon className="size-2 text-muted-foreground group-hover:text-destructive" />
            )}
          </Badge>
        ))}
      <Badge
        style={{
          display: overflowAmount > 0 && !shouldWrap ? "block" : "none",
        }}
        variant="outline"
        ref={overflowRef}
      >
        +{overflowAmount}
      </Badge>
    </div>
  )
}

export function MultiSelectContent({
  search = true,
  children,
  ...props
}: {
  search?: boolean | { placeholder?: string; emptyMessage?: string }
  children: ReactNode
} & ComponentPropsWithoutRef<"div">) {
  const { searchTerm, setSearchTerm } = useMultiSelectContext()
  const canSearch = typeof search === "object" ? true : search
  const searchPlaceholder = typeof search === "object" ? search.placeholder : "Search..."
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus search input when opened
  useEffect(() => {
    if (canSearch && inputRef.current) {
      // Small delay to ensure popover is mounted
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [canSearch])

  return (
    <PopoverContent className="min-w-[var(--radix-popover-trigger-width)] p-0">
      {canSearch && (
        <div className="flex items-center border-b px-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mr-2 size-4 shrink-0 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      )}
      <div className="max-h-[300px] overflow-y-auto scroll-py-1 p-1" {...props}>
        {children}
      </div>
    </PopoverContent>
  )
}

export function MultiSelectItem({
  value,
  children,
  badgeLabel,
  onSelect,
  className,
  ...props
}: {
  badgeLabel?: ReactNode
  value: string
  onSelect?: (value: string) => void
  className?: string
} & Omit<ComponentPropsWithoutRef<"div">, "value" | "onSelect" | "className">) {
  const { toggleValue, selectedValues, onItemAdded, searchTerm } = useMultiSelectContext()
  const isSelected = selectedValues.has(value)

  useEffect(() => {
    onItemAdded(value, badgeLabel ?? children)
  }, [value, children, onItemAdded, badgeLabel])

  // Simple filter - check if value or children text includes search term
  const matchesSearch = useMemo(() => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    const valueText = value.toLowerCase()
    const childrenText = typeof children === "string" ? children.toLowerCase() : value.toLowerCase()
    return valueText.includes(term) || childrenText.includes(term)
  }, [searchTerm, value, children])

  if (!matchesSearch) return null

  return (
    <div
      {...props}
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className
      )}
      onClick={() => {
        toggleValue(value)
        onSelect?.(value)
      }}
    >
      <CheckIcon
        className={cn("size-4", isSelected ? "opacity-100" : "opacity-0")}
      />
      {children}
    </div>
  )
}

export function MultiSelectGroup(
  props: ComponentPropsWithoutRef<"div">
) {
  return (
    <div
      className="overflow-hidden p-1 text-foreground"
      {...props}
    />
  )
}

export function MultiSelectSeparator(
  props: ComponentPropsWithoutRef<"div">
) {
  return <div className="-mx-1 my-1 h-px bg-border" {...props} />
}

function useMultiSelectContext() {
  const context = useContext(MultiSelectContext)
  if (context == null) {
    throw new Error(
      "useMultiSelectContext must be used within a MultiSelectContext",
    )
  }
  return context
}
