interface ContextChip {
  label: string
  href?: string
  onClick?: () => void
  isCurrent?: boolean
}

export function useContextChips() {
  const createChips = (...chips: Array<{ 
    label: string
    onClick?: () => void
    isCurrent?: boolean 
  }>): ContextChip[] => {
    return chips.map(chip => ({
      label: chip.label,
      onClick: chip.onClick,
      isCurrent: chip.isCurrent ?? false
    }))
  }

  return { createChips }
}