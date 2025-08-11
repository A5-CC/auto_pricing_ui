"use client"

import { Button } from "@/components/ui/button"

export function RunNowButton({
  disabled,
  loading,
  onClick,
}: {
  disabled: boolean
  loading: boolean
  onClick: () => void
}) {
  return (
    <Button onClick={onClick} disabled={disabled || loading}>
      {loading ? "Queuing…" : disabled ? "Running…" : "Run now"}
    </Button>
  )
}


