"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, Table, SlidersHorizontal } from "lucide-react";
import { usePathname } from "next/navigation";
import { getSystemHealth } from "@/lib/api/client/system";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthContext"; // ✅ import your auth hook

function ApiStatusDot() {
  const [status, setStatus] = useState<"checking" | "ok" | "offline">("checking");

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const h = await getSystemHealth();
        setStatus(
          h.status === "ok" || h.status === "operational" ? "ok" : "offline"
        );
      } catch {
        setStatus("offline");
      }
    };

    checkHealth();
    // Poll every 30 seconds to recover from initial failures (e.g., API cold start)
    const interval = setInterval(checkHealth, 30 * 1000);

    return () => clearInterval(interval);
  }, []);

  const color =
    status === "ok"
      ? "bg-green-500"
      : status === "offline"
      ? "bg-red-500"
      : "bg-gray-400";
  const label =
    status === "ok"
      ? "API ok"
      : status === "offline"
      ? "API offline"
      : "API checking";

  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden />
      {label}
    </span>
  );
}

export function SiteNavbar() {
  const pathname = usePathname();
  const { authenticated } = useAuth(); // ✅ correct property name

  // 🔒 Hide navbar if not logged in
  if (!authenticated) return null;

  const isActive = (href: string) => pathname === href;

  const baseLink =
    "inline-flex items-center rounded-md px-2.5 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  const linkCls = (href: string) =>
    `${baseLink} ${
      isActive(href)
        ? "bg-muted font-medium text-foreground"
        : "text-foreground/90 hover:bg-muted"
    }`;

  const primaryLinkCls = (href: string) =>
    `${baseLink} ${
      isActive(href)
        ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/30"
        : "text-primary bg-primary/5 hover:bg-primary/10 ring-1 ring-primary/20"
    }`;

  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold tracking-tight"></Link>
          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/pipelines"
              className={`${primaryLinkCls("/pipelines")} gap-1.5`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              Pricing Pipelines
            </Link>
            <Link href="/pricing" className={`${linkCls("/pricing")} gap-1.5`}>
              <BarChart3 className="h-3.5 w-3.5" aria-hidden />
              Competitor Pricing
            </Link>
            <span aria-hidden className="mx-2 h-6 w-px bg-border" />
            <Link href="/runs" className={linkCls("/runs")}>
              Scraping Runs
            </Link>
            <Link href="/raw-scrapes" className={linkCls("/raw-scrapes")}>
              Raw Scrapes
            </Link>
            <Link href="/url-dumps" className={linkCls("/url-dumps")}>
              URL Discovery
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="default"
            size="sm"
            className="rounded-full gap-1.5 ring-1 ring-primary/30 shadow-sm"
          >
            <Link href="/pricing-schemas">
              <Table className="h-3.5 w-3.5" aria-hidden />
              <span>Pricing Schema</span>
            </Link>
          </Button>
          <ApiStatusDot />
        </div>
      </div>
    </nav>
  );
}
