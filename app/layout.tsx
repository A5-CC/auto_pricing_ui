'use client';

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteNavbar } from "@/components/site-navbar";
import { AuthProvider, useAuth } from "@/components/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Auto Pricing UI",
  description: "Competitive pricing intelligence for self-storage",
};

// ✅ AuthGate component handles redirect + conditional nav display
function AuthGate({ children }: { children: React.ReactNode }) {
  const { authenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // redirect to /login if not authenticated and not already there
  useEffect(() => {
    if (!authenticated && pathname !== "/login") {
      router.push("/login");
    }
  }, [authenticated, pathname, router]);

  // prevent flicker while redirecting
  if (!authenticated && pathname !== "/login") {
    return null;
  }

  const showNavbar = pathname !== "/login";

  return (
    <>
      {showNavbar && <SiteNavbar />}
      {children}
    </>
  );
}

// ✅ Wrap everything in AuthProvider
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
