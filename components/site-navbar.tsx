"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { getSystemHealth } from "@/lib/api/client"

function ApiStatusDot() {
  const [status, setStatus] = useState<"checking" | "ok" | "offline">("checking")

  useEffect(() => {
    const load = async () => {
      try {
        const h = await getSystemHealth()
        setStatus((h.status === "ok" || h.status === "operational") ? "ok" : "offline")
      } catch {
        setStatus("offline")
      }
    }
    load()
  }, [])

  const color = status === "ok" ? "bg-green-500" : status === "offline" ? "bg-red-500" : "bg-gray-400"
  const label = status === "ok" ? "API ok" : status === "offline" ? "API offline" : "API checking"
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden />
      {label}
    </span>
  )
}

export function SiteNavbar() {
  const pathname = usePathname()

  const linkCls = (href: string) => (
    `rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-muted ${pathname === href ? "bg-muted font-medium" : "text-foreground"}`
  )

  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold tracking-tight">Auto Pricing</Link>
          <div className="hidden md:flex items-center gap-1">
            <Link href="/url-dumps" className={linkCls("/url-dumps")}>URL Discovery</Link>
            <Link href="/raw-scrapes" className={linkCls("/raw-scrapes")}>Raw Scrapes</Link>
            <Link href="/runs" className={linkCls("/runs")}>Pipeline Runs</Link>
            <Link href="/pricing" className={linkCls("/pricing")}>Pricing</Link>
            <Link href="/pricing-schemas" className={linkCls("/pricing-schemas")}>Pricing Schema</Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ApiStatusDot />
        </div>
      </div>
      <div className="mx-auto block max-w-7xl px-4 pb-3 md:hidden">
        <div className="flex items-center gap-2 overflow-x-auto">
          <Link href="/url-dumps" className={linkCls("/url-dumps")}>URL Discovery</Link>
          <Link href="/raw-scrapes" className={linkCls("/raw-scrapes")}>Raw Scrapes</Link>
          <Link href="/runs" className={linkCls("/runs")}>Pipeline Runs</Link>
          <Link href="/pricing" className={linkCls("/pricing")}>Pricing</Link>
          <Link href="/pricing-schemas" className={linkCls("/pricing-schemas")}>Pricing Schema</Link>
        </div>
      </div>
    </nav>
  )
}


