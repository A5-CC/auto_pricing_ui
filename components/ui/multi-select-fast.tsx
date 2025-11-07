/**
 * ============================================================================
 * MULTI-SELECT-FAST.TSX - PERFORMANCE-OPTIMIZED VARIANT (CURRENTLY UNUSED)
 * ============================================================================
 *
 * This is a highly optimized version of the multi-select component that was
 * created to solve severe performance issues with dropdown opening times.
 *
 * PERFORMANCE INVESTIGATION FINDINGS:
 * - Original multi-select.tsx had ~1 second delay when opening dropdowns
 * - Root cause identified: Radix UI Popover/Portal has significant overhead
 *   due to portal mounting, position calculation, focus trapping, and
 *   accessibility management
 * - Secondary issue: cmdk library adds heavy indexing/fuzzy search overhead
 *
 * THIS VARIANT'S OPTIMIZATIONS:
 * ✅ Replaces Radix UI Popover with simple absolute-positioned div
 * ✅ Replaces cmdk with native input + Array.filter() for search
 * ✅ Adds click-outside-to-close functionality
 * ✅ Adds escape-key-to-close functionality
 * ✅ Auto-focuses search input on open
 *
 * RESULT: Opens instantly (no delay) vs ~1s delay in original
 *
 * WHY NOT USED:
 * We opted to keep using multi-select.tsx (with Radix Popover) because:
 * - Radix provides robust accessibility features out-of-the-box
 * - Radix handles edge cases (positioning, scroll containers, etc.)
 * - The 1s delay, while noticeable, was deemed acceptable for now
 * - We did optimize multi-select.tsx by replacing cmdk with simple search
 *
 * WHEN TO USE THIS:
 * If the 1s opening delay becomes unacceptable, simply replace imports:
 *   from: "@/components/ui/multi-select"
 *   to:   "@/components/ui/multi-select-fast"
 *
 * TRADE-OFFS:
 * - Loses automatic positioning (may get cut off by parent overflow)
 * - Manual accessibility implementation (basic, but functional)
 * - May not handle all edge cases that Radix handles
 *
 * MAINTAINED AS: Backup solution / proof-of-concept for future optimization
 * ============================================================================
 */
"use client"

import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
  const [searchTerm, setSearchTerm] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

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

  const contextSelectedValues = useMemo(() => {
    return values ? new Set(values) : selectedValues
  }, [values, selectedValues])

  // Reset search when opening/closing
  useEffect(() => {
    if (!open) {
      setSearchTerm("")
    }
  }, [open])

  // Click outside to close
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  // Escape key to close
  useEffect(() => {
    if (!open) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [open])

  return (
    <MultiSelectContext
      value={{
        open,
        setOpen,
        selectedValues: contextSelectedValues,
        toggleValue,
        searchTerm,
        setSearchTerm,
      }}
    >
      <div className="relative" ref={containerRef}>
        {children}
      </div>
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
  const { open, setOpen } = useMultiSelectContext()

  return (
    <Button
      {...props}
      variant={props.variant ?? "outline"}
      role={props.role ?? "combobox"}
      aria-expanded={props["aria-expanded"] ?? open}
      onClick={() => setOpen(!open)}
      className={cn(
        "flex h-auto min-h-9 w-fit items-center justify-between gap-2 overflow-hidden rounded-md border border-input bg-transparent px-3 py-1.5 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
    >
      {children}
      <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
    </Button>
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
  const { selectedValues, toggleValue, open } = useMultiSelectContext()

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
      className={cn(
        "flex w-full gap-1.5 overflow-hidden",
        className,
      )}
    >
      {selectedValues.size > 0 && (
        <Badge variant="outline">
          {selectedValues.size} selected
        </Badge>
      )}
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
  const { open, searchTerm, setSearchTerm } = useMultiSelectContext()
  const canSearch = typeof search === "object" ? true : search
  const searchPlaceholder = typeof search === "object" ? search.placeholder : "Search..."
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus search input when opened
  useEffect(() => {
    if (open && canSearch && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open, canSearch])

  if (!open) return null

  return (
    <div className="absolute z-50 mt-1 w-full bg-popover text-popover-foreground rounded-md border shadow-md">
      {canSearch && (
        <div className="flex items-center border-b px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      )}
      <div className="max-h-[300px] overflow-y-auto p-2" {...props}>
        {children}
      </div>
    </div>
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
  const { toggleValue, selectedValues, searchTerm } = useMultiSelectContext()
  const isSelected = selectedValues.has(value)

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
      className={cn("flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm", className)}
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
  return <div {...props} />
}

export function MultiSelectSeparator(
  props: ComponentPropsWithoutRef<"div">
) {
  return <div className="h-px bg-border my-1" {...props} />
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
