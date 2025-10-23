'use client';

import { ReactNode, useEffect } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { SiteNavbar } from "./site-navbar";

function AuthGate({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Redirect to login if not authenticated and not already on /login
  useEffect(() => {
    if (!authenticated && pathname !== "/login") {
      router.push("/login");
    }
  }, [authenticated, pathname, router]);

  const showNavbar = pathname !== "/login";

  // Always render login page
  if (pathname === "/login") return <>{children}</>;

  // On other pages, only render if authenticated
  if (!authenticated) return null;

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
