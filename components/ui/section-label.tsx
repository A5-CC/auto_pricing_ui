/**
 * Section label component with optional right-side content
 * Used for section headers with uppercase styling
 */
export function SectionLabel({ text, right }: { text: string; right?: React.ReactNode }) {
  return (
    <div className="mt-1 mb-2 flex items-center justify-between">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{text}</div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  )
}
