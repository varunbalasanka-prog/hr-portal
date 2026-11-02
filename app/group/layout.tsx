import type { Metadata } from "next";
import "@fontsource/hind-madurai/latin-400.css";
import "@fontsource/hind-madurai/latin-500.css";
import "@fontsource/hind-madurai/latin-600.css";
import "@fontsource/hind-madurai/latin-700.css";
import "@fontsource/hind-madurai/tamil-400.css";
import "@fontsource/hind-madurai/tamil-600.css";
import { GROUP_SITE } from "@/lib/group";
import { ScrollReveal } from "./scroll-reveal";
import { SiteFooter, SiteHeader } from "./ui";

export const metadata: Metadata = {
  metadataBase: new URL(GROUP_SITE),
  openGraph: { images: ["/balasanka_logo.png"], locale: "en_IN", siteName: "Balasanka Group" },
};

/** The balasanka.in company site: one typeface (Hind Madurai, drawn for Tamil and Latin), the logo's indigo and red. */
export default function GroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white font-['Hind_Madurai',ui-sans-serif,system-ui,sans-serif] text-[17px] text-[#1b1640] antialiased">
      <div aria-hidden className="g-progress" />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <ScrollReveal />
    </div>
  );
}
