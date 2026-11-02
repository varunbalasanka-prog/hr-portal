import type { Metadata } from "next";
import "@fontsource/hind-madurai/latin-400.css";
import "@fontsource/hind-madurai/latin-600.css";
import "@fontsource/hind-madurai/tamil-400.css";
import "@fontsource/hind-madurai/tamil-600.css";
import "./group.css";
import { GROUP_SITE } from "@/lib/group";
import { ScrollReveal } from "./scroll-reveal";
import { SiteFooter, SiteHeader } from "./ui";

export const metadata: Metadata = {
  metadataBase: new URL(GROUP_SITE),
  openGraph: { images: ["/balasanka_logo.png"], locale: "en_IN", siteName: "Balasanka Group" },
};

/**
 * Runs before the page paints: applies the visitor's "Pause animations" choice, and shows the logo intro
 * only on the first page of a visit (never when animations are paused).
 */
const BOOT = `try{var d=document.documentElement,m=localStorage.getItem("bs-motion");if(m==="calm")d.dataset.motion="calm";var sd=navigator.connection&&navigator.connection.saveData;if(m!=="calm"&&!sd&&!sessionStorage.getItem("bs-intro")){d.dataset.intro="on";sessionStorage.setItem("bs-intro","1");setTimeout(function(){d.dataset.intro="done"},1600)}}catch(e){}`;

/** The balasanka.in company site: one typeface (Hind Madurai, drawn for Tamil and Latin) in two weights, the logo's indigo and red. */
export default function GroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      <div aria-hidden className="g-intro">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/balasanka_logo.png" alt="" fetchPriority="high" decoding="sync" />
      </div>
      <div className="g-site min-h-screen bg-white font-['Hind_Madurai',ui-sans-serif,system-ui,sans-serif] text-[17px] text-[#1b1640] antialiased">
        <div aria-hidden className="g-progress" />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <ScrollReveal />
      </div>
    </>
  );
}
