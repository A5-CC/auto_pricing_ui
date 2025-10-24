import "./globals.css";
import { AuthProviderWrapper } from "@/components/AuthProviderWrapper";
import { SiteNavbar } from "@/components/site-navbar";
import { Roboto } from "next/font/google";

const robotoLight = Roboto({
  subsets: ["latin"],
  weight: "300",
  variable: "--font-roboto-light",
});

export default function RootLayout({ children, params }: { children: React.ReactNode; params: any }) {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  const hideNavbar = pathname === "/login";

  return (
    <html lang="en">
      <body className={`${robotoLight.variable} font-sans antialiased`}>
        <AuthProviderWrapper>
          {!hideNavbar && <SiteNavbar />}
          {children}
        </AuthProviderWrapper>
      </body>
    </html>
  );
}
