"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Activity, Link2, FileText, ArrowRight, ChevronRight, BarChart3, SlidersHorizontal, Settings } from "lucide-react"
import { Footer } from "@/components/analytics/footer-actions"

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl p-6 space-y-12">
      <header className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          Competitive pricing intelligence
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Price with confidence.
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl">
            Monitor competitors, model pricing strategies, and push optimized rates from a single, modern dashboard built for self‑storage operators.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/pipelines">
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Pricing Pipelines
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href="/pricing">
              <BarChart3 className="h-4 w-4" aria-hidden />
              Competitor Pricing
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-xl border bg-card/80 shadow-sm">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3 text-primary ring-1 ring-primary/20">
                <SlidersHorizontal className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Pricing Pipelines</h2>
                <p className="text-sm text-muted-foreground">Design the strategy, iterate fast.</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Combine filters with competitive, function, and temporal adjusters. Compare outcomes instantly and publish new rates with confidence.
            </p>
            <Link href="/pipelines" className="inline-flex items-center text-sm font-medium text-primary">
              Open pipelines
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
        <Card className="rounded-xl border bg-card/80 shadow-sm">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3 text-primary ring-1 ring-primary/20">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Competitor Pricing</h2>
                <p className="text-sm text-muted-foreground">Track the market in real time.</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Explore normalized competitor pricing data, trends, and snapshots to stay ahead of local market moves.
            </p>
            <Link href="/pricing" className="inline-flex items-center text-sm font-medium text-primary">
              Open pricing
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Settings className="h-3.5 w-3.5" aria-hidden />
          Settings
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <FeatureCard
            icon={<BarChart3 className="h-4 w-4" />}
            title="Pricing schema"
            description="Review the canonical schema powering pricing analytics."
            href="/pricing-schemas"
            cta="Open schema"
          />
          <FeatureCard
            icon={<Activity className="h-4 w-4" />}
            title="Scraping runs"
            description="Audit run status and trigger updates."
            href="/runs"
            cta="Open runs"
          />
          <FeatureCard
            icon={<FileText className="h-4 w-4" />}
            title="Raw scrapes"
            description="Inspect raw markdown scrapes for validation."
            href="/raw-scrapes"
            cta="Open scrapes"
          />
          <FeatureCard
            icon={<Link2 className="h-4 w-4" />}
            title="URL discovery"
            description="Review discovered competitor URLs."
            href="/url-dumps"
            cta="Open URLs"
          />
          <FeatureCard
            icon={<ChevronRight className="h-4 w-4" />}
            title="Locations"
            description="Manage target facility locations."
            href="/locations"
            cta="Open locations"
          />
        </div>
      </section>

      <Footer />
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  href,
  cta,
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  cta: string
}) {
  return (
    <Link
      href={href}
      aria-label={`${title} — ${cta}`}
      className="group block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="h-full transition-colors border hover:border-foreground/20 bg-card hover:bg-muted/30 rounded-lg">
        <CardContent className="p-5 flex flex-col h-full">
          <div className="flex items-start justify-between">
            <div className="rounded-md border bg-background p-2 text-muted-foreground transition-colors group-hover:text-foreground">{icon}</div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </div>
          <div className="mt-4 space-y-1.5 flex-grow">
            <h3 className="text-base font-medium">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="mt-4 inline-flex items-center text-sm font-medium text-primary">
            <span>{cta}</span>
            <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
