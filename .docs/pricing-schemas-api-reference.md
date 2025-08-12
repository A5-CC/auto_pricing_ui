# Pricing Schemas API Reference

Backend endpoints for accessing pricing data schemas.

## Endpoints

### GET /competitors/pricing-schemas

Returns both spine and canonical schemas in one call.

```typescript
interface PricingSchemas {
  spine: SpineColumn[]
  canonical?: CanonicalWideSchema
  spine_exists: boolean
  canonical_exists: boolean
}

interface SpineColumn {
  id: string
  label: string
  description: string
  type: "string" | "decimal" | "boolean" | "integer"
}

interface CanonicalWideSchema {
  version: number
  last_updated: string
  columns: Record<string, CanonicalColumn>
  total_columns: number
}

interface CanonicalColumn {
  type: "string" | "decimal" | "boolean" | "integer"
  first_seen: string
  label?: string
  unit?: string
  description?: string
}
```

### GET /competitors/pricing-schemas/spine

Returns immutable primary key columns.

**Response**: `SpineColumn[]`

### GET /competitors/pricing-schemas/canonical

Returns evolved data columns schema.

**Response**: `CanonicalWideSchema`

### GET /competitors/pricing-schemas/columns/stats

Returns schema statistics.

```typescript
interface SchemaStats {
  spine_columns: number
  canonical_columns: number
  total_columns: number
  column_types: Record<string, number>
  latest_columns: Array<{name: string, first_seen: string}>
  schema_version: number
  last_updated?: string
}
```

## API Client Functions

```typescript
// Add to lib/api/client.ts
export async function getPricingSchemas(): Promise<PricingSchemas> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/pricing-schemas`)
  return response.json()
}

export async function getSchemaStats(): Promise<SchemaStats> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/pricing-schemas/columns/stats`)
  return response.json()
}
```