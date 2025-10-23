// import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProviderWrapper } from "@/components/AuthProviderWrapper";

// const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
// const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

import { Roboto } from "next/font/google";

const robotoLight = Roboto({
  subsets: ["latin"],
  weight: "300",   // 300 is Roboto Light
  variable: "--font-roboto-light",
});


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${robotoLight.variable} font-sans antialiased`}>
        <AuthProviderWrapper>
          {children}
        </AuthProviderWrapper>
      </body>
    </html>
  );
}
