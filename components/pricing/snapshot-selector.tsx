"use client"

import { PricingSnapshot } from "@/lib/api/types"

export function SnapshotSelector({
  snapshots,
  value,
  onChange,
}: {
  snapshots: PricingSnapshot[]
  value: string
  onChange: (val: string) => void
}) {
  return (
    <select
      className="mt-1 w-full rounded-md border px-2 py-2 text-sm outline-none focus-visible:border-ring"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="latest">Latest</option>
      {snapshots.map((s) => (
        <option key={s.date} value={s.date}>{s.date}</option>
      ))}
    </select>
  )
}


