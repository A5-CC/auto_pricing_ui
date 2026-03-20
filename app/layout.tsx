import { AuthProviderWrapper } from "@/components/AuthProviderWrapper";
import { NavbarWrapper } from "@/components/NavbarWrapper";
import { NavigationProgress } from "@/components/navigation-progress";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
