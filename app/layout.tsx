import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Tamil } from "next/font/google";
import "./globals.css";

// Served from this site, so pages don't wait on Google's servers (and no visitor IPs go to Google).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const tamil = Noto_Sans_Tamil({ subsets: ["tamil"], weight: ["400", "500", "600", "700"], variable: "--font-tamil", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://hr.balasanka.in"),
  title: "Balasanka HR Portal",
  description: "Recruitment and onboarding portal for Balasanka Group of Companies",
  icons: { icon: "/balasanka_logo.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${tamil.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
