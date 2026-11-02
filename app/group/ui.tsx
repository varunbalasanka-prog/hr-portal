import { MotionToggle } from "./motion-toggle";
import { ALL_SHOWROOMS, BRAND_STRIP, CAREERS_SITE, COMPANIES, CONTACT_EMAIL, SHOWROOM_GROUPS, TOWNS, groupHref, type Showroom, type ShowroomGroup, fullAddress, mapLink } from "@/lib/group";

/** Each business has its own muted tint, told apart by warmth: cool grey-indigo, warm cream, soft neutral. */
export const CHAPTER: Record<string, { field: string; ink: string; soft: string; link: string }> = {
  vehicles: { field: "bg-[#eff0f5]", ink: "text-[#1b1640]", soft: "text-[#4a4666]", link: "text-[#1b1640]" },
  jewellery: { field: "bg-[#f8f3e8]", ink: "text-[#1b1640]", soft: "text-[#4a4666]", link: "text-[#1b1640]" },
  watches: { field: "bg-[#f3f3f0]", ink: "text-[#1b1640]", soft: "text-[#4a4666]", link: "text-[#1b1640]" },
};
/** The plain tint for anything that is not one business (town cards, alternating rows). */
export const NEUTRAL = "bg-[#f4f4f6]";

// One content column for the whole site: backgrounds run full width, content always starts on the same left edge.
export const WRAP = "px-[max(1.25rem,calc((100%-70rem)/2))]";
const LINK = "underline decoration-[0.08em] underline-offset-[0.2em] hover:decoration-[0.16em]";
export { LINK };

const NAV: [string, string][] = [
  ...SHOWROOM_GROUPS.map((g) => [g.title.replace(" and cycles", ""), groupHref(`/${g.slug}`)] as [string, string]),
  ["Showrooms", groupHref("/showrooms")],
  ["About", groupHref("/about")],
  ["Contact", groupHref("/contact")],
];

export function SiteHeader() {
  return (
    <header className={`${WRAP} pt-[max(0.75rem,env(safe-area-inset-top))] sticky top-0 z-40 flex items-center justify-between gap-6 bg-white pb-3 shadow-[0_1px_0_rgba(27,22,64,0.06)]`}>
      <a href={groupHref("/")} aria-label="Balasanka Group home" className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/balasanka_logo.png" alt="Balasanka" className="h-11 w-auto sm:h-12" />
      </a>
      <nav aria-label="Main" className="hidden items-center gap-7 text-[16px] font-normal text-[#1b1640] lg:flex">
        {NAV.map(([label, href]) => <a key={href} href={href} className="hover:underline">{label}</a>)}
        <a href={`${CAREERS_SITE}/careers`} className="rounded-md bg-[#d9261c] px-4 py-2 font-semibold text-white hover:bg-[#b81f17]">Careers</a>
      </nav>
      <details className="group lg:hidden">
        <summary className="cursor-pointer list-none rounded-md bg-[#1b1640] px-4 py-2 font-semibold text-white [&::-webkit-details-marker]:hidden">Menu</summary>
        <nav aria-label="Main" className="absolute inset-x-0 top-full bg-white px-5 pb-6 pt-2 shadow-lg">
          <ul className="text-2xl font-semibold text-[#1b1640]">
            {NAV.map(([label, href]) => <li key={href}><a href={href} className="block py-2.5">{label}</a></li>)}
            <li><a href={`${CAREERS_SITE}/careers`} className="block py-2.5 text-[#d9261c]">Careers</a></li>
          </ul>
        </nav>
      </details>
    </header>
  );
}

export function SiteFooter() {
  return (
    <>
    <div aria-hidden className="g-border" />
    <footer className={`${WRAP} bg-[#f4f4f6] pb-10 pt-16 text-[16px] text-[#1b1640]`}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-12">
        <div className="col-span-2 md:col-span-5">
          <p className="text-3xl font-semibold">Balasanka Group of Companies</p>
          <p lang="ta" className="mt-1 text-lg">பாலசங்கா குழுமம்</p>
          <p className="mt-5 max-w-[42ch] leading-relaxed">
            {ALL_SHOWROOMS.length} showrooms in {TOWNS.join(", ").replace(/, ([^,]*)$/, " and $1")}.
          </p>
          <p className="mt-4">Write to us at <a className={`inline-block py-1 font-semibold ${LINK}`} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        </div>
        <div className="md:col-span-4">
          <h2 className="font-semibold">Group companies</h2>
          <ul className="mt-3 space-y-2 text-[15px] leading-snug sm:text-[16px]">{COMPANIES.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
        <div className="md:col-span-3">
          <h2 className="font-semibold">Pages</h2>
          <ul className="mt-1.5">
            {NAV.map(([label, href]) => <li key={href}><a className="inline-block py-2 hover:underline md:py-1" href={href}>{label}</a></li>)}
            <li><a className="inline-block py-2 hover:underline md:py-1" href={`${CAREERS_SITE}/careers`}>Careers</a></li>
            <li><a className="inline-block py-2 hover:underline md:py-1" href={`${CAREERS_SITE}/privacy`}>Privacy</a></li>
            <li className="py-2 md:py-1"><MotionToggle /></li>
          </ul>
        </div>
      </div>
      <p className="mt-14 text-sm text-[#55516f]">© {new Date().getFullYear()} Balasanka Group of Companies. Tanishq, Mia, CaratLane, Titan, Fastrack, Titan Eye+, TVS, Honda and other brand names and logos belong to their owners and are used here only to show the brands our showrooms sell.</p>
    </footer>
    </>
  );
}

/** One showroom as a row: the brand, its address and a directions link. */
export function ShowroomRow({ s, showTown = false, tone = "light" }: { s: Showroom; showTown?: boolean; tone?: "light" | "dark" }) {
  const soft = tone === "dark" ? "opacity-85" : "text-[#4a4666]";
  return (
    <li className="py-3.5">
      <p className="text-lg font-semibold">{showTown ? s.town : s.brand}</p>
      <address className={`mt-0.5 max-w-[52ch] not-italic leading-relaxed ${soft}`}>{fullAddress(s)}</address>
      <a href={mapLink(s)} target="_blank" rel="noopener" className={`mt-0.5 inline-block py-2 font-normal ${LINK}`}>Directions on Google Maps</a>
    </li>
  );
}

/** The businesses as linked tinted cards, each with its drawing, used at the foot of pages to move between them. */
export function BusinessLinks({ except }: { except?: string }) {
  const list = SHOWROOM_GROUPS.filter((g) => g.key !== except);
  return (
    <section aria-labelledby="h-our-businesses" className={`${WRAP} py-14 sm:py-20`}>
      <h2 data-reveal id="h-our-businesses" className="text-2xl font-semibold sm:text-3xl">{except ? "Our other businesses" : "Our businesses"}</h2>
      <nav data-reveal aria-labelledby="h-our-businesses" className={`mt-8 grid gap-4 ${list.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {list.map((g) => <BusinessBlock key={g.key} g={g} />)}
      </nav>
    </section>
  );
}

function BusinessBlock({ g }: { g: ShowroomGroup }) {
  const c = CHAPTER[g.key];
  return (
    <a href={groupHref(`/${g.slug}`)} className={`${c.field} ${c.ink} group flex items-center justify-between gap-4 rounded-xl px-6 py-5 hover:brightness-[0.97]`}>
      <span>
        <span className="block text-xl font-semibold group-hover:underline">{g.title}</span>
        <span className={`mt-1 block ${c.soft}`}>{g.showrooms.length} showrooms</span>
      </span>
      <span aria-hidden className="text-2xl text-[#d9261c] transition-transform group-hover:translate-x-1">→</span>
    </a>
  );
}

/**
 * The brands our showrooms sell, drifting slowly sideways (it rests only while off screen
 * and becomes a still list when animations are paused). The second copy only closes the loop.
 */
export function BrandStrip() {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {BRAND_STRIP.map((b) => (
        <li key={b.name} className="flex items-center gap-10 px-5 sm:px-7">
          <span className="block text-center">
            {b.logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={b.logo} alt={b.name} className="mx-auto h-9 w-auto" />
              : <span className="block whitespace-nowrap text-2xl font-semibold text-[#3d3866]">{b.name}</span>}
            <span className="mt-0.5 block whitespace-nowrap text-sm text-[#6a6688]">{b.note}</span>
          </span>
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[#d9261c]/60" />
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-labelledby="h-brands" className="py-8 sm:py-12">
      <h2 id="h-brands" className={`${WRAP} text-lg font-semibold text-[#4a4666]`}>Brands at our showrooms</h2>
      <div data-live className="g-strip mt-6 overflow-hidden">
        <div className="g-marquee">{row(false)}{row(true)}</div>
      </div>
    </section>
  );
}
