import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
// Fonts are bundled with the site (no Google request at build or page load, and no visitor IPs go to Google).
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/noto-sans-tamil/tamil-400.css";
import "@fontsource/noto-sans-tamil/tamil-500.css";
import "@fontsource/noto-sans-tamil/tamil-600.css";
import "@fontsource/noto-sans-tamil/tamil-700.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://hr.balasanka.in"),
  title: "Balasanka HR Portal",
  description: "Recruitment and onboarding portal for Balasanka Group of Companies",
  // Square icons: Google shows a favicon beside search results only if it is square (a multiple of 48px).
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/icon-192.png", sizes: "192x192" },
  },
  applicationName: "Balasanka Group",
  openGraph: { siteName: "Balasanka Group" },
  // Codes from Google Search Console and Bing Webmaster Tools ("HTML tag" method), set in Vercel.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="min-h-screen antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
