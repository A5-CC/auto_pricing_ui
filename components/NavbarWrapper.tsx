"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { SidebarLayout } from "./layout/sidebar-layout";

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

  // Show sidebar layout only if logged in
  if (!authenticated) return <>{children}</>; // allow /login page to render

  return (
    <SidebarLayout>
      {children}
    </SidebarLayout>
  );
}
