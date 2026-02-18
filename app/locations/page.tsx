"use client"

import { ContextChips } from "@/components/context-chips"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useContextChips } from "@/hooks/useContextChips"
import { saveLocations } from "@/lib/api/client/locations"
import { ExternalLink, MapPin, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

interface LocationEntry {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  radiusMiles: number | null
  radiusInput: string
}

export default function LocationsPage() {
  const { createChips } = useContextChips()
  const [nameInput, setNameInput] = useState("")
  const [addressInput, setAddressInput] = useState("")
  const [cityInput, setCityInput] = useState("")
  const [stateInput, setStateInput] = useState("")
  const [zipInput, setZipInput] = useState("")
  const [locations, setLocations] = useState<LocationEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const canAdd =
    nameInput.trim().length > 0 &&
    addressInput.trim().length > 0 &&
    cityInput.trim().length > 0 &&
    stateInput.trim().length > 0 &&
    zipInput.trim().length > 0

  const addLocation = () => {
    const name = nameInput.trim()
    const address = addressInput.trim()
    const city = cityInput.trim()
    const state = stateInput.trim()
    const zip = zipInput.trim()
    if (!name || !address || !city || !state || !zip) return
    const entry: LocationEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      address,
      city,
      state,
      zip,
      radiusMiles: null,
      radiusInput: "",
    }
    setLocations((prev) => [entry, ...prev])
    setNameInput("")
    setAddressInput("")
    setCityInput("")
    setStateInput("")
    setZipInput("")
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

  const handleSave = async () => {
    if (!locations.length) return
    try {
      setSaving(true)
      setSaveMessage(null)
      await saveLocations(
        locations.map((loc) => ({
          name: loc.name,
          address: loc.address,
          city: loc.city,
          state: loc.state,
          zip: loc.zip,
          radius_miles: loc.radiusMiles,
        }))
      )
      setSaveMessage("Saved to backend.")
    } catch {
      setSaveMessage("Failed to save locations.")
    } finally {
      setSaving(false)
    }
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
          <div className="min-w-[220px]">
            <label className="text-xs text-muted-foreground">Location name</label>
            <Input
              placeholder="modSTORAGE Airport Way"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
          </div>
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
          <div className="min-w-[160px]">
            <label className="text-xs text-muted-foreground">City</label>
            <Input
              placeholder="Monterey"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
            />
          </div>
          <div className="min-w-[120px]">
            <label className="text-xs text-muted-foreground">State</label>
            <Input
              placeholder="CA"
              value={stateInput}
              onChange={(e) => setStateInput(e.target.value)}
            />
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs text-muted-foreground">ZIP</label>
            <Input
              placeholder="93940"
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
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
          <Button variant="default" onClick={handleSave} disabled={!locations.length || saving}>
            {saving ? "Saving..." : "Save locations"}
          </Button>
        </div>
        {saveMessage && (
          <div className="text-xs text-muted-foreground">{saveMessage}</div>
        )}
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
                <th className="px-4 py-2">Name</th>
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
                        <div className="font-medium">{loc.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {loc.city}, {loc.state} {loc.zip}
                        </div>
                      </td>
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
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>
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
