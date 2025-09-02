"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Activity, Link2, FileText, Table, ArrowRight, ChevronRight, BarChart3 } from "lucide-react"
import { Footer } from "@/components/analytics/footer-actions"

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl p-6 space-y-10">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Competitive pricing intelligence for self‑storage. Monitor your pipeline, inspect discovered URLs and raw scrapes, and keep your data flowing.
        </p>
      </header>

      <section className="space-y-6">
        <Link
          href="/pricing"
          aria-label="Open Competitor Pricing Analysis dashboard"
          className="block group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card className="rounded-xl transition-all duration-200 border bg-card hover:border-foreground/20 hover:bg-muted/40 shadow-sm hover:shadow-md">
            <CardContent className="p-8">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-3 text-primary ring-1 ring-primary/20">
                    <BarChart3 className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Competitor Pricing Analysis</h2>
                    <p className="text-muted-foreground mt-1">Interactive data grid with real-time competitor pricing intelligence</p>
                  </div>
                </div>
              </div>
              <p className="text-muted-foreground mt-6 leading-relaxed">
                Explore comprehensive competitor pricing data through our interactive dashboard. Filter by location, competitor, unit size, and more.
                Export custom views, analyze historical snapshots, and discover pricing trends that give you the competitive edge.
              </p>
              <div className="mt-6 inline-flex items-center text-primary font-medium">
                <span>Open pricing dashboard</span>
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </section>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <FeatureCard
          icon={<Link2 className="h-4 w-4" />}
          title="URL discovery"
          description="Browse discovered competitor URLs that feed the pipeline."
          href="/url-dumps"
          cta="Open URLs"
        />
        <FeatureCard
          icon={<FileText className="h-4 w-4" />}
          title="Raw scrapes"
          description="Inspect raw markdown scrapes to validate content."
          href="/raw-scrapes"
          cta="Open scrapes"
        />
        <FeatureCard
          icon={<Activity className="h-4 w-4" />}
          title="Pipeline runs"
          description="Track execution status, and trigger new runs on demand."
          href="/runs"
          cta="Open runs"
        />
        <FeatureCard
          icon={<Table className="h-4 w-4" />}
          title="Pricing schema"
          description="Browse the spine and canonical wide schemas."
          href="/pricing-schemas"
          cta="Open schema"
        />
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
