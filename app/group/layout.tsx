import type { Metadata } from "next";
import "@fontsource/hind-madurai/latin-400.css";
import "@fontsource/hind-madurai/latin-600.css";
import "@fontsource/hind-madurai/tamil-400.css";
import "@fontsource/hind-madurai/tamil-600.css";
import "./group.css";
import { GROUP_SITE } from "@/lib/group";
import { getSite } from "@/lib/site-data";
import { ScrollReveal } from "./scroll-reveal";
import { SiteFooter, SiteHeader } from "./ui";

export const metadata: Metadata = {
  metadataBase: new URL(GROUP_SITE),
  openGraph: { images: ["/balasanka_logo.png"], locale: "en_IN", siteName: "Balasanka Group" },
  // balasanka.in's own Search Console / Bing codes ("HTML tag" method), set in Vercel. Not needed if the domain is verified by a DNS record.
  ...(process.env.GROUP_GOOGLE_SITE_VERIFICATION || process.env.GROUP_BING_SITE_VERIFICATION
    ? {
        verification: {
          google: process.env.GROUP_GOOGLE_SITE_VERIFICATION || undefined,
          other: process.env.GROUP_BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.GROUP_BING_SITE_VERIFICATION } : undefined,
        },
      }
    : {}),
};

/**
 * Runs before the page paints: shows the logo intro only on the first page of a visit (never on Data Saver),
 * and clears the old "Pause animations" choice (the switch was removed on varun's request, 6 Nov 2026).
 */
const BOOT = `try{var d=document.documentElement;localStorage.removeItem("bs-motion");var sd=navigator.connection&&navigator.connection.saveData;if(!sd&&!sessionStorage.getItem("bs-intro")){d.dataset.intro="on";sessionStorage.setItem("bs-intro","1");setTimeout(function(){d.dataset.intro="done"},1600)}}catch(e){}`;

/** The balasanka.in company site: one typeface (Hind Madurai, drawn for Tamil and Latin) in two weights, the logo's indigo and red. */
// Edits on the Website page refresh pages at once; this hourly refresh is only a safety net.
export const revalidate = 3600;

export default async function GroupLayout({ children }: { children: React.ReactNode }) {
  const site = await getSite();
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      <div aria-hidden className="g-intro">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/balasanka_logo.png" alt="" fetchPriority="high" decoding="sync" />
      </div>
      <div className="g-site min-h-screen bg-white font-['Hind_Madurai',ui-sans-serif,system-ui,sans-serif] text-[17px] text-[#1b1640] antialiased">
        <div aria-hidden className="g-progress" />
        <SiteHeader site={site} />
        <main>{children}</main>
        <SiteFooter site={site} />
        <ScrollReveal />
      </div>
    </>
  );
}
