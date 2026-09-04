import { AuthProviderWrapper } from "@/components/AuthProviderWrapper";
import { NavbarWrapper } from "@/components/NavbarWrapper";
import { NavigationProgress } from "@/components/navigation-progress";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Origin of the competitor-pricing API, resolved at build time from
// NEXT_PUBLIC_API_URL. Emitting <link rel="preconnect"> lets the browser do the
// DNS + TLS handshake to that host while the app JS is still parsing, so the
// first data request doesn't pay for it (the API is a raw IP behind sslip.io,
// where the TLS setup is not cheap).
const API_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "").origin;
  } catch {
    return null;
  }
})();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {API_ORIGIN && (
          <>
            <link rel="preconnect" href={API_ORIGIN} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={API_ORIGIN} />
          </>
        )}
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <AuthProviderWrapper>
            <NavigationProgress />
            <NavbarWrapper>{children}</NavbarWrapper>
          </AuthProviderWrapper>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
