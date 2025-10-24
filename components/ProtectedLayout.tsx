"use client";

import { useAuth } from "@/components/AuthContext";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { authenticated } = useAuth();

  if (!authenticated) {
    // Not logged in → hide everything except the login page
    return <>{children}</>;
  }

  // Logged in → show navbar + page content
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">{children}</main>
    </div>
  );
}
