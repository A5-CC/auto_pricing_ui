"use client"

import { ContextChips } from "@/components/context-chips"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useContextChips } from "@/hooks/useContextChips"
import { ExternalLink, MapPin, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

interface LocationEntry {
  id: string
  address: string
  radiusMiles: number | null
  radiusInput: string
}

export default function LocationsPage() {
  const { createChips } = useContextChips()
  const [addressInput, setAddressInput] = useState("")
  const [locations, setLocations] = useState<LocationEntry[]>([])

  const canAdd = addressInput.trim().length > 0

  const addLocation = () => {
    const address = addressInput.trim()
    if (!address) return
    const entry: LocationEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      address,
      radiusMiles: null,
      radiusInput: "",
    }
    setLocations((prev) => [entry, ...prev])
    setAddressInput("")
  }

  const removeLocation = (id: string) => {
    setLocations((prev) => prev.filter((loc) => loc.id !== id))
  }

  const updateRadiusInput = (id: string, value: string) => {
    setLocations((prev) =>
      prev.map((loc) => (loc.id === id ? { ...loc, radiusInput: value } : loc))
    )
  }

  const commitRadius = (id: string) => {
    setLocations((prev) =>
      prev.map((loc) => {
        if (loc.id !== id) return loc
        const sanitized = loc.radiusInput.replace(/[^0-9.]/g, "")
        const next = Number(sanitized)
        if (!sanitized || Number.isNaN(next) || next <= 0) {
          return { ...loc, radiusMiles: null }
        }
        return { ...loc, radiusMiles: next }
      })
    )
  }

  const locationRows = useMemo(() => locations, [locations])

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <ContextChips
        chips={createChips(
          {
            label: "Locations",
            isCurrent: true,
          }
        )}
      />
      <p className="text-sm text-muted-foreground">
        Add and validate target locations for competitor coverage. Use Google Maps to confirm the
        address and assign a search radius to each location.
      </p>

      <section className="rounded-lg border p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <label className="text-xs text-muted-foreground">Location address</label>
            <Input
              placeholder="123 Main St, Dallas, TX"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addLocation()
                }
              }}
            />
          </div>
          <Button onClick={addLocation} disabled={!canAdd} className="gap-1.5">
            <Plus className="h-4 w-4" aria-hidden />
            Add location
          </Button>
          {locations.length > 0 && (
            <Button variant="outline" onClick={() => setLocations([])}>
              Clear all
            </Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Tip: paste a full address for the best Google Maps match.
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" aria-hidden />
          {locationRows.length ? `${locationRows.length} saved location${locationRows.length === 1 ? "" : "s"}` : "No locations yet"}
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-2">Address</th>
                <th className="px-4 py-2">Maps lookup</th>
                <th className="px-4 py-2">Radius (miles)</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {locationRows.length ? (
                locationRows.map((loc) => {
                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`
                  return (
                    <tr key={loc.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-medium">{loc.address}</div>
                        <div className="text-xs text-muted-foreground">
                          {loc.radiusMiles ? `${loc.radiusMiles} mi radius set` : "Radius not set"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Button asChild variant="outline" size="sm" className="gap-1.5">
                          <a href={mapsUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" aria-hidden />
                            Open maps
                          </a>
                        </Button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Input
                            className="w-24"
                            placeholder="10"
                            value={loc.radiusInput}
                            onChange={(e) => updateRadiusInput(loc.id, e.target.value)}
                            inputMode="decimal"
                          />
                          <Button size="sm" variant="outline" onClick={() => commitRadius(loc.id)}>
                            Set radius
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeLocation(loc.id)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={4}>
                    Add a location to start mapping.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
