"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Link2, FileText, Table } from "lucide-react"
import { Footer } from "@/components/analytics/footer-actions"

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl p-6 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Auto Pricing</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Competitive pricing intelligence for self‑storage. Monitor your pipeline, inspect discovered URLs and raw scrapes, and keep your data flowing.
        </p>
      </header>

      <section className="grid gap-6 sm:grid-cols-2">
        <FeatureCard
          icon={<Link2 className="h-5 w-5" />}
          title="URL discovery"
          description="Browse discovered competitor URLs that feed the pipeline."
          href="/url-dumps"
          cta="Open URLs"
        />
        <FeatureCard
          icon={<FileText className="h-5 w-5" />}
          title="Raw scrapes"
          description="Inspect raw markdown scrapes to validate content before normalization."
          href="/raw-scrapes"
          cta="Open scrapes"
        />
      </section>

      <section>
        <Card className="transition-colors hover:border-foreground/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="rounded-md border p-2 text-muted-foreground"><Activity className="h-5 w-5" /></div>
              <Badge variant="outline">Coming Soon</Badge>
            </div>
            <div className="mt-4 space-y-2">
              <h3 className="text-base font-semibold">Pipeline runs</h3>
              <p className="text-sm text-muted-foreground">Track execution status, durations and failures. Trigger new runs on demand.</p>
            </div>
            <div className="mt-4">
              <Link href="/runs"><Button variant="outline" size="sm">Open runs</Button></Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="transition-colors hover:border-foreground/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="rounded-md border p-2 text-muted-foreground"><Table className="h-5 w-5" /></div>
            </div>
            <div className="mt-4 space-y-2">
              <h3 className="text-base font-semibold">Pricing schema</h3>
              <p className="text-sm text-muted-foreground">Browse the spine and canonical wide schemas that structure competitor pricing data.</p>
            </div>
            <div className="mt-4">
              <Link href="/pricing-schemas"><Button variant="outline" size="sm">Open schema</Button></Link>
            </div>
          </CardContent>
        </Card>
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
    <Card className="transition-colors hover:border-foreground/30">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="rounded-md border p-2 text-muted-foreground">{icon}</div>
        </div>
        <div className="mt-4 space-y-2">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="mt-4">
          <Link href={href}><Button variant="outline" size="sm">{cta}</Button></Link>
        </div>
      </CardContent>
    </Card>
  )
}
