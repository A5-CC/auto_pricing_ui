"use client";

import { useAuth } from "@/components/AuthContext";
import { MenuDrawer } from "@/components/navigation/menu-drawer";

export function SiteNavbar() {
  const { authenticated } = useAuth();

  // Hide navbar if not logged in
  if (!authenticated) return null;

  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Left side: empty space (logo removed) */}
        <div className="w-8" />

        {/* Right side: menu drawer toggle */}
        <MenuDrawer />
      </div>
    </nav>
  );
}
