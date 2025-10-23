'use client';

import { ReactNode, useEffect } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { SiteNavbar } from "./site-navbar";

function AuthGate({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!authenticated && pathname !== "/login") {
      router.push("/login");
    }
  }, [authenticated, pathname, router]);

  // Show navbar only if logged in
  const showNavbar = authenticated;

  // Show login page if not authenticated
  if (!authenticated && pathname === "/login") return <>{children}</>;

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
