import "./globals.css";
import { AuthProviderWrapper } from "@/components/AuthProviderWrapper";
import ProtectedLayout from "@/components/ProtectedLayout";
import { Roboto } from "next/font/google";

const robotoLight = Roboto({
  subsets: ["latin"],
  weight: "300", // Roboto Light
  variable: "--font-roboto-light",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${robotoLight.variable} font-sans antialiased`}>
        <AuthProviderWrapper>
          <ProtectedLayout>{children}</ProtectedLayout>
        </AuthProviderWrapper>
      </body>
    </html>
  );
}
