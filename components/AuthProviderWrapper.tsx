'use client';

import { ReactNode, useEffect } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { SiteNavbar } from "./site-navbar";

function AuthGate({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Only redirect if not logged in and not already on /login
  useEffect(() => {
    if (!authenticated && pathname !== "/login") {
      router.push("/login");
    }
  }, [authenticated, pathname, router]);

  // hide navbar on login page
  const showNavbar = pathname !== "/login";

  // render children immediately on /login page
  if (!authenticated && pathname !== "/login") return null;

  return (
    <>
      {showNavbar && <SiteNavbar />}
      {children}
    </>
  );
}

export function AuthProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
