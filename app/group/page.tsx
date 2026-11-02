import type { Metadata } from "next";
import "@fontsource/hind-madurai/latin-400.css";
import "@fontsource/hind-madurai/latin-500.css";
import "@fontsource/hind-madurai/latin-600.css";
import "@fontsource/hind-madurai/tamil-400.css";
import "@fontsource/hind-madurai/tamil-600.css";
import "@fontsource/noto-serif-tamil/tamil-700.css";
import { ALL_SHOWROOMS, CAREERS_SITE, COMPANIES, CONTACT_EMAIL, GROUP_SITE, SHOWROOM_GROUPS, TOWNS, brandsOf, fullAddress, groupSchema, mapLink } from "@/lib/group";

const DESCRIPTION = `Balasanka Group of Companies runs ${ALL_SHOWROOMS.length} jewellery, watch, eyewear and two-wheeler showrooms in ${TOWNS.length} towns of South Tamil Nadu.`;
const CAREERS = `${CAREERS_SITE}/careers`;

export const metadata: Metadata = {
  metadataBase: new URL(GROUP_SITE),
  title: "Balasanka Group of Companies | பாலசங்கா குழுமம்",
  description: DESCRIPTION,
  alternates: { canonical: `${GROUP_SITE}/` },
  openGraph: { title: "Balasanka Group of Companies", description: DESCRIPTION, url: `${GROUP_SITE}/`, images: ["/balasanka_logo.png"], locale: "en_IN", siteName: "Balasanka Group" },
};

// Logo indigo and red, on white. One sans family (Hind Madurai, made for Tamil and Latin) plus a Tamil serif for the name.
const SANS = "font-['Hind_Madurai',ui-sans-serif,system-ui,sans-serif]";
const TAMIL_SERIF = "font-['Noto_Serif_Tamil',serif]";
const INDIGO = "#2b2177";
const RED = "#d9261c";
const TINT = "#f2f1f8";

const slug = (town: string) => `town-${town.toLowerCase()}`;

/** Approximate town centres, so the map shows where the showrooms really are. */
const TOWN_POINTS: Record<string, { lat: number; lon: number; label: "left" | "right" | "above" | "below" }> = {
  Madurai: { lat: 9.925, lon: 78.12, label: "left" },
  Theni: { lat: 10.01, lon: 77.477, label: "right" },
  Srivilliputhur: { lat: 9.512, lon: 77.633, label: "above" },
  Rajapalayam: { lat: 9.452, lon: 77.553, label: "left" },
  Sivakasi: { lat: 9.453, lon: 77.799, label: "below" },
  Virudhunagar: { lat: 9.585, lon: 77.958, label: "right" },
  Tenkasi: { lat: 8.959, lon: 77.315, label: "right" },
  Tirunelveli: { lat: 8.714, lon: 77.757, label: "right" },
};
const project = (lat: number, lon: number) => ({ x: 40 + (lon - 77.3) * 330, y: 40 + (10.05 - lat) * 330 });

function TownMap() {
  return (
    <svg viewBox="0 0 400 520" role="img" aria-labelledby="map-title" className="h-auto w-full">
      <title id="map-title">Map of our {TOWNS.length} towns in South Tamil Nadu</title>
      {TOWNS.map((t) => {
        const p = TOWN_POINTS[t];
        if (!p) return null;
        const { x, y } = project(p.lat, p.lon);
        const n = ALL_SHOWROOMS.filter((s) => s.town === t).length;
        const r = 5 + n * 1.6;
        const pos = {
          left: { x: x - r - 8, y: y + 5, anchor: "end" as const },
          right: { x: x + r + 8, y: y + 5, anchor: "start" as const },
          above: { x, y: y - r - 10, anchor: "middle" as const },
          below: { x, y: y + r + 20, anchor: "middle" as const },
        }[p.label];
        return (
          <a key={t} href={`#${slug(t)}`} className="group focus:outline-none">
            <circle cx={x} cy={y} r={r + 7} fill={RED} opacity={0.12} className="transition group-hover:opacity-25 group-focus-visible:opacity-25" />
            <circle cx={x} cy={y} r={r} fill={RED} />
            <text x={pos.x} y={pos.y} textAnchor={pos.anchor} fill={INDIGO} className="text-[17px] font-semibold group-hover:underline group-focus-visible:underline">
              {t} <tspan fill="#6b6788" fontWeight={400}>{n}</tspan>
            </text>
          </a>
        );
      })}
    </svg>
  );
}

/** Company homepage, served at balasanka.in (middleware rewrites "/" there to this page). */
export default function GroupHome() {
  const byTown = TOWNS.map((t) => ({
    town: t,
    rows: SHOWROOM_GROUPS.flatMap((g) => g.showrooms.filter((s) => s.town === t).map((s) => ({ ...s, kind: g.title }))).sort((a, b) => a.brand.localeCompare(b.brand)),
  }));
  const link = "underline decoration-1 underline-offset-4 hover:decoration-2";
  return (
    <div className={`${SANS} min-h-screen bg-white text-[#2a2745] antialiased`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(groupSchema()).replace(/</g, "\\u003c") }} />

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <a href="#top" aria-label="Balasanka Group home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/balasanka_logo.png" alt="Balasanka" className="h-12 w-auto sm:h-14" />
        </a>
        <nav className="flex items-center gap-6 text-[15px] font-medium">
          <a href="#businesses" className="hidden text-[#2b2177] hover:underline sm:inline">What we sell</a>
          <a href="#showrooms" className="hidden text-[#2b2177] hover:underline sm:inline">Showrooms</a>
          <a href={CAREERS} className="rounded-md bg-[#2b2177] px-4 py-2 text-white hover:bg-[#1e1758]">Careers</a>
        </nav>
      </header>

      <main id="top">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pb-24 lg:pt-12">
          <div>
            <p lang="ta" className={`${TAMIL_SERIF} text-[3.25rem] leading-[1.25] text-[#2b2177] sm:text-7xl lg:text-[5.5rem]`}>பாலசங்கா</p>
            <h1 className="mt-3 text-2xl font-semibold text-[#2b2177] sm:text-3xl">Balasanka Group of Companies</h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-[#4b4868] sm:text-xl">
              Jewellery, watches, eyewear and two-wheelers, sold and serviced at {ALL_SHOWROOMS.length} showrooms
              across Madurai, Theni, Virudhunagar, Tenkasi and Tirunelveli districts.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#showrooms" className="inline-flex h-12 items-center rounded-md bg-[#d9261c] px-6 font-semibold text-white hover:bg-[#b81f17]">Find a showroom near you</a>
            </div>
          </div>
          <figure className="rounded-2xl p-4 sm:p-8" style={{ background: TINT }}>
            <div className="mx-auto max-w-[360px]"><TownMap /></div>
            <figcaption className="mt-2 text-center text-sm text-[#6b6788]">Showrooms in each town. Tap a town to see its addresses.</figcaption>
          </figure>
        </section>

        <section id="businesses" className="scroll-mt-4 border-t border-[#e4e2ef]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 className="max-w-xl text-3xl font-semibold leading-snug text-[#2b2177] sm:text-4xl">What we sell</h2>
            <p className="mt-3 max-w-xl text-lg text-[#4b4868]">Our own jewellery houses, and authorised showrooms for brands people across India already trust.</p>
            <div className="mt-12 grid gap-12 md:grid-cols-3 md:gap-10">
              {SHOWROOM_GROUPS.map((g) => (
                <article key={g.key} className="border-t-[3px] border-[#2b2177] pt-6">
                  <h3 className="text-xl font-semibold text-[#2b2177]">{g.title}</h3>
                  <p lang="ta" className="text-[15px] text-[#6b6788]">{g.tamil}</p>
                  <p className="mt-4 leading-relaxed text-[#4b4868]">{g.blurb}</p>
                  <ul className="mt-6 space-y-2 text-[15px]">
                    {brandsOf(g).map((b) => {
                      const towns = [...new Set(g.showrooms.filter((s) => s.brand === b).map((s) => s.town))];
                      return (
                        <li key={b}>
                          <span className="font-semibold text-[#2a2745]">{b}</span>
                          <span className="text-[#6b6788]"> in {towns.join(", ")}</span>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="showrooms" className="scroll-mt-4" style={{ background: TINT }}>
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 className="text-3xl font-semibold text-[#2b2177] sm:text-4xl">Visit a showroom</h2>
            <p className="mt-3 max-w-xl text-lg text-[#4b4868]">Every showroom, by town, with directions on Google Maps.</p>
            <nav aria-label="Jump to a town" className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[15px] font-medium text-[#2b2177]">
              {TOWNS.map((t) => <a key={t} href={`#${slug(t)}`} className={link}>{t}</a>)}
            </nav>
            <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-2">
              {byTown.map(({ town, rows }) => (
                <section key={town} id={slug(town)} aria-labelledby={`${slug(town)}-h`} className="scroll-mt-4">
                  <h3 id={`${slug(town)}-h`} className="border-b border-[#d6d3e6] pb-2 text-xl font-semibold text-[#2b2177]">{town}</h3>
                  <ul>
                    {rows.map((s) => (
                      <li key={`${s.brand}-${s.street}`} className="grid gap-x-6 gap-y-1 border-b border-[#e4e2ef] py-4 sm:grid-cols-[1fr_auto]">
                        <div>
                          <p className="font-semibold text-[#2a2745]">{s.brand} <span className="font-normal text-[#6b6788]">({s.kind.toLowerCase()})</span></p>
                          <address className="mt-0.5 text-[15px] not-italic leading-relaxed text-[#4b4868]">{fullAddress(s)}</address>
                        </div>
                        <a href={mapLink(s)} target="_blank" rel="noopener" className={`self-center text-[15px] font-medium text-[#d9261c] ${link}`}>Directions</a>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#2b2177] text-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between lg:py-20">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold sm:text-4xl">Work with us</h2>
              <p lang="ta" className="mt-1 text-lg text-white/75">வேலைவாய்ப்பு</p>
              <p className="mt-4 text-lg leading-relaxed text-white/85">
                We hire for sales, service, accounts and customer care at every showroom, and freshers are welcome.
                Pick a job and apply online in about five minutes.
              </p>
            </div>
            <a href={CAREERS} className="inline-flex h-12 shrink-0 items-center justify-center rounded-md bg-white px-7 font-semibold text-[#2b2177] hover:bg-[#f2f1f8]">See open jobs</a>
          </div>
        </section>
      </main>

      <footer className="mx-auto grid max-w-6xl gap-10 px-4 py-14 text-[15px] text-[#4b4868] sm:grid-cols-2 sm:px-6 lg:grid-cols-[2fr_1.5fr_1fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/balasanka_logo.png" alt="Balasanka" className="h-12 w-auto" />
          <p className="mt-5 max-w-sm leading-relaxed">{DESCRIPTION}</p>
          <p className="mt-4">Write to us at <a className={`font-medium text-[#2b2177] ${link}`} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        </div>
        <div>
          <h2 className="font-semibold text-[#2b2177]">Group companies</h2>
          <ul className="mt-3 space-y-1.5">{COMPANIES.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
        <div>
          <h2 className="font-semibold text-[#2b2177]">Links</h2>
          <ul className="mt-3 space-y-1.5">
            <li><a className="hover:underline" href="#businesses">What we sell</a></li>
            <li><a className="hover:underline" href="#showrooms">Showrooms</a></li>
            <li><a className="hover:underline" href={CAREERS}>Careers</a></li>
            <li><a className="hover:underline" href={`${CAREERS_SITE}/privacy`}>Privacy</a></li>
          </ul>
        </div>
        <p className="text-sm text-[#6b6788] sm:col-span-2 lg:col-span-3">© {new Date().getFullYear()} Balasanka Group of Companies. Tanishq, CaratLane, Titan, TVS, Honda and other brand names belong to their owners.</p>
      </footer>
    </div>
  );
}
