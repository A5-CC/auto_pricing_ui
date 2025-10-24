"use client";

import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { SiteNavbar } from "./site-navbar";

export function NavbarWrapper({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // Make sure component is mounted before redirecting
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !authenticated && pathname !== "/login") {
      router.push("/login");
    }
  }, [authenticated, mounted, pathname, router]);

  // Show navbar only if logged in
  if (!authenticated) return <>{children}</>; // allow /login page to render

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNavbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
