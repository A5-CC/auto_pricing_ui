"use client";

import { useAuth } from "@/components/AuthContext"; // ✅ import your auth hook
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BarChart3, Settings, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";


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
        {/* Left side: nav links */}
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Auto Pricing
          </Link>
          <Link href="/pricing" className={`${linkCls("/pricing")} gap-1.5`}>
            <BarChart3 className="h-3.5 w-3.5" aria-hidden />
            Competitor Pricing
          </Link>
          <Link
            href="/pipelines"
            className={`${primaryLinkCls("/pipelines")} gap-1.5`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            Pricing Pipelines
          </Link>
          <span aria-hidden className="mx-1 h-6 w-px bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Settings className="h-3.5 w-3.5" aria-hidden />
                Settings
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/pricing-schemas">Pricing Schema</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/locations">Locations</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/url-dumps">URL Discovery</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/raw-scrapes">Raw Scrapes</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/runs">Scraping Runs</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>

  );
}
