'use client';

import { ReactNode } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
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

  if (!authenticated && pathname !== "/login") return null;

  const showNav = pathname !== "/login";

  return (
    <>
      {showNav && <SiteNavbar />}
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
