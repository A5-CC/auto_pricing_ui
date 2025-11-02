import type { ColumnStatistics } from "@/lib/api/types"

/**
 * Aggregates column statistics by data type and returns sorted type counts
 * Sorts by count (descending), then by predefined type order
 */
export function getTypeCounts(columnsStats: Record<string, ColumnStatistics>): [string, number][] {
  const typeCounts: Record<string, number> = {}

  Object.values(columnsStats).forEach(stat => {
    const type = stat.data_type
    typeCounts[type] = (typeCounts[type] || 0) + 1
  })

  const typeOrder = ['float64', 'Int64', 'boolean', 'string']
  return Object.entries(typeCounts)
    .sort(([typeA, countA], [typeB, countB]) => {
      if (countA !== countB) return countB - countA
      const aIndex = typeOrder.indexOf(typeA)
      const bIndex = typeOrder.indexOf(typeB)
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
    })
}
