export function normalizeFilterValue(value: unknown): string {
  const raw = typeof value === "string" ? value : String(value ?? "")
  return raw
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

export function toFilterDisplayValue(value: unknown): string {
  const raw = typeof value === "string" ? value : String(value ?? "")
  return raw
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
}
