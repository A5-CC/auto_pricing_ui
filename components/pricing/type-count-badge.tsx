import { Binary, Hash, ToggleLeft, Type as TypeIcon } from "lucide-react"

export function TypeCountBadge({ type, count }: { type: string; count: number; compact?: boolean }) {
  const formatter = new Intl.NumberFormat()

  const getMeta = (t: string) => {
    switch (t) {
      case 'float64':
        return { color: 'bg-blue-100 text-blue-800', singular: 'decimal', plural: 'decimals', icon: <Binary className="h-3.5 w-3.5" aria-hidden /> }
      case 'Int64':
        return { color: 'bg-violet-100 text-violet-800', singular: 'integer', plural: 'integers', icon: <Hash className="h-3.5 w-3.5" aria-hidden /> }
      case 'boolean':
        return { color: 'bg-amber-100 text-amber-800', singular: 'boolean', plural: 'booleans', icon: <ToggleLeft className="h-3.5 w-3.5" aria-hidden /> }
      case 'string':
      default:
        return { color: 'bg-gray-100 text-gray-800', singular: 'string', plural: 'strings', icon: <TypeIcon className="h-3.5 w-3.5" aria-hidden /> }
    }
  }

  const meta = getMeta(type)
  const isPlural = count !== 1
  const label = isPlural ? meta.plural : meta.singular
  const title = `${formatter.format(count)} ${label} columns`

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium leading-none ${meta.color}`}
      title={title}
      aria-label={title}
    >
      {meta.icon}
      <span>{formatter.format(count)}</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}


