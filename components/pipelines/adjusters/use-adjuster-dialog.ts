import { useState } from 'react'

/**
 * Shared hook for managing adjuster dialog state
 * Keeps dialog management consistent across all adjuster types
 */
export function useAdjusterDialog() {
  const [open, setOpen] = useState(false)

  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)

  return { open, handleOpen, handleClose, setOpen }
}
