import { ALL_SHOWROOMS, CAREERS_SITE, COMPANIES, CONTACT_EMAIL, SHOWROOM_GROUPS, TOWNS, groupHref, type Showroom, type ShowroomGroup, fullAddress, mapLink } from "@/lib/group";

/** Each business is a chapter with its own flat colour, taken from what it sells: silver, the logo's indigo, the logo's red. */
export const CHAPTER: Record<string, { field: string; ink: string; soft: string; link: string }> = {
  jewellery: { field: "bg-[#e6e5ec]", ink: "text-[#1b1640]", soft: "text-[#3e3a5c]", link: "text-[#1b1640]" },
  watches: { field: "bg-[#2b2177]", ink: "text-white", soft: "text-[#d9d6ef]", link: "text-white" },
  vehicles: { field: "bg-[#c4211a]", ink: "text-white", soft: "text-[#fde3e1]", link: "text-white" },
};

export const WRAP = "px-[clamp(1rem,3vw,2.5rem)]";
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
    <header className={`${WRAP} relative z-10 flex items-center justify-between gap-6 bg-white py-4`}>
      <a href={groupHref("/")} aria-label="Balasanka Group home" className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/balasanka_logo.png" alt="Balasanka" className="h-11 w-auto sm:h-12" />
      </a>
      <nav aria-label="Main" className="hidden items-center gap-7 text-[16px] font-medium text-[#1b1640] lg:flex">
        {NAV.map(([label, href]) => <a key={href} href={href} className="hover:underline">{label}</a>)}
        <a href={`${CAREERS_SITE}/careers`} className="rounded-md bg-[#d9261c] px-4 py-2 font-semibold text-white hover:bg-[#b81f17]">Careers</a>
      </nav>
      <details className="group lg:hidden">
        <summary className="cursor-pointer list-none rounded-md bg-[#1b1640] px-4 py-2 font-semibold text-white [&::-webkit-details-marker]:hidden">Menu</summary>
        <nav aria-label="Main" className="absolute inset-x-0 top-full bg-white px-[clamp(1rem,3vw,2.5rem)] pb-6 pt-2 shadow-lg">
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
    <footer className={`${WRAP} bg-[#f3f2f7] pb-10 pt-16 text-[16px] text-[#1b1640]`}>
      <div className="grid gap-10 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="text-3xl font-semibold tracking-tight">Balasanka Group of Companies</p>
          <p lang="ta" className="mt-1 text-lg">பாலசங்கா குழுமம்</p>
          <p className="mt-5 max-w-[42ch] leading-relaxed">
            {ALL_SHOWROOMS.length} showrooms in {TOWNS.join(", ").replace(/, ([^,]*)$/, " and $1")}.
          </p>
          <p className="mt-4">Write to us at <a className={`font-semibold ${LINK}`} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        </div>
        <div className="md:col-span-4">
          <h2 className="font-semibold">Group companies</h2>
          <ul className="mt-3 space-y-1.5">{COMPANIES.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
        <div className="md:col-span-3">
          <h2 className="font-semibold">Pages</h2>
          <ul className="mt-3 space-y-1.5">
            {NAV.map(([label, href]) => <li key={href}><a className="hover:underline" href={href}>{label}</a></li>)}
            <li><a className="hover:underline" href={`${CAREERS_SITE}/careers`}>Careers</a></li>
            <li><a className="hover:underline" href={`${CAREERS_SITE}/privacy`}>Privacy</a></li>
          </ul>
        </div>
      </div>
      <p className="mt-14 text-sm text-[#55516f]">© {new Date().getFullYear()} Balasanka Group of Companies. Tanishq, CaratLane, Titan, TVS, Honda and other brand names belong to their owners.</p>
    </footer>
  );
}

/** One showroom as a row: the brand, its address and a directions link. */
export function ShowroomRow({ s, showTown = false, tone = "light" }: { s: Showroom; showTown?: boolean; tone?: "light" | "dark" }) {
  const soft = tone === "dark" ? "opacity-85" : "text-[#3e3a5c]";
  return (
    <li className="py-3.5">
      <p className="text-lg font-semibold">{showTown ? s.town : s.brand}</p>
      <address className={`mt-0.5 max-w-[52ch] not-italic leading-relaxed ${soft}`}>{fullAddress(s)}</address>
      <a href={mapLink(s)} target="_blank" rel="noopener" className={`mt-1 inline-block font-medium ${LINK}`}>Directions on Google Maps</a>
    </li>
  );
}

/** The three businesses as linked colour blocks, used at the foot of pages to move between them. */
export function BusinessLinks({ except }: { except?: string }) {
  const list = SHOWROOM_GROUPS.filter((g) => g.key !== except);
  return (
    <nav aria-label="Our businesses" className={`grid ${list.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
      {list.map((g) => <BusinessBlock key={g.key} g={g} />)}
    </nav>
  );
}

function BusinessBlock({ g }: { g: ShowroomGroup }) {
  const c = CHAPTER[g.key];
  return (
    <a href={groupHref(`/${g.slug}`)} className={`${c.field} ${c.ink} ${WRAP} group block py-12 transition-[filter] hover:brightness-95`}>
      <span className="block text-3xl font-semibold tracking-tight group-hover:underline sm:text-4xl">{g.title}</span>
      <span className={`mt-2 block text-lg ${c.soft}`}>{g.showrooms.length} showrooms</span>
    </a>
  );
}
