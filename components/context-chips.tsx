interface ContextChip {
  label: string
  href?: string
  onClick?: () => void
  isCurrent?: boolean
}

interface ContextChipsProps {
  chips: ContextChip[]
}

export function ContextChips({ chips }: ContextChipsProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {chips.map((chip, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && <span className="text-muted-foreground">/</span>}
          {chip.onClick ? (
            <button
              type="button"
              onClick={chip.onClick}
              disabled={chip.isCurrent}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${
                chip.isCurrent 
                  ? "text-muted-foreground bg-muted" 
                  : "hover:bg-muted text-foreground"
              }`}
              aria-current={chip.isCurrent ? "page" : undefined}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground/50" />
              {chip.label}
            </button>
          ) : (
            <span 
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${
                chip.isCurrent 
                  ? "bg-muted text-foreground" 
                  : "text-muted-foreground"
              }`}
              aria-current={chip.isCurrent ? "page" : undefined}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground/50" />
              {chip.label}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}