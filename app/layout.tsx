import "./globals.css";
import { AuthProviderWrapper } from "@/components/AuthProviderWrapper";
import NavbarWrapper from "@/components/NavbarWrapper";
import { Roboto } from "next/font/google";

const robotoLight = Roboto({
  subsets: ["latin"],
  weight: "300",
  variable: "--font-roboto-light",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${robotoLight.variable} font-sans antialiased`}>
        <AuthProviderWrapper>
          <NavbarWrapper />
          {children}
        </AuthProviderWrapper>
      </body>
    </html>
  );
}
