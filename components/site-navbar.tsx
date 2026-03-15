"use client";

import { useAuth } from "@/components/AuthContext";
import { MenuDrawer } from "@/components/navigation/menu-drawer";
import Link from "next/link";

export function SiteNavbar() {
  const { authenticated } = useAuth();

  // Hide navbar if not logged in
  if (!authenticated) return null;

  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Left side: minimal logo/icon */}
        <Link href="/" className="flex items-center">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <div className="h-4 w-4 rounded bg-primary" />
          </div>
        </Link>

        {/* Right side: menu drawer toggle */}
        <MenuDrawer />
      </div>
    </nav>
  );
}
