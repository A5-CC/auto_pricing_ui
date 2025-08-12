"use client"

import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

type Crumb = { href?: string; label: string }

export function PageBreadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  if (!crumbs?.length) return null

  const lastIndex = crumbs.length - 1

  return (
    <div className="mb-2">
      <Breadcrumb>
        <BreadcrumbList className="text-xs text-muted-foreground">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {crumbs.map((c, idx) => (
            <span key={`${c.label}-${idx}`} className="inline-flex items-center">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {idx === lastIndex || !c.href ? (
                  <BreadcrumbPage className="text-foreground">{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={c.href}>{c.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}


