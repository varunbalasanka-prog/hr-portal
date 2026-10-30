import type { Metadata } from "next";
import "@fontsource/fraunces/latin-400.css";
import "@fontsource/fraunces/latin-500.css";
import "@fontsource/fraunces/latin-600.css";
import "@fontsource/fraunces/latin-400-italic.css";
import { ALL_SHOWROOMS, CAREERS_SITE, COMPANIES, CONTACT_EMAIL, GROUP_SITE, SHOWROOM_GROUPS, TOWNS, brandsOf, groupSchema } from "@/lib/group";
import { ShowroomFinder } from "./showroom-finder";

const DESCRIPTION = `Balasanka Group of Companies runs ${ALL_SHOWROOMS.length} jewellery, watch, eyewear and two-wheeler showrooms in ${TOWNS.length} towns of South Tamil Nadu.`;
const CAREERS = `${CAREERS_SITE}/careers`;

export const metadata: Metadata = {
  metadataBase: new URL(GROUP_SITE),
  title: "Balasanka Group of Companies · பாலசங்கா குழுமம்",
  description: DESCRIPTION,
  alternates: { canonical: `${GROUP_SITE}/` },
  openGraph: { title: "Balasanka Group of Companies", description: DESCRIPTION, url: `${GROUP_SITE}/`, images: ["/balasanka_logo.png"], locale: "en_IN", siteName: "Balasanka Group" },
};

const SERIF = "font-['Fraunces',Georgia,serif]";
const GOLD = "text-[#c9a96e]";
const INK = "bg-[#120e2e]";

const ICONS: Record<string, React.ReactNode> = {
  jewellery: <path d="M6 3h12l3 6-9 12L3 9l3-6Zm-3 6h18M9 3l3 6 3-6M12 9v12" />,
  watches: <><circle cx="12" cy="12" r="6" /><path d="M12 9v3l2 2M9 3h6l1 3H8l1-3Zm0 18h6l1-3H8l1 3Z" /></>,
  vehicles: <><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="M9 17h6l-3-7h4l2 7M12 10l-2-4H7" /></>,
};
const Icon = ({ k }: { k: string }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[k]}</svg>
);

/** A fine diamond lattice, drawn in CSS so the hero has texture without photos. */
const LATTICE = "[background-image:linear-gradient(45deg,rgba(201,169,110,.07)_1px,transparent_1px),linear-gradient(-45deg,rgba(201,169,110,.07)_1px,transparent_1px)] [background-size:44px_44px]";

const Eyebrow = ({ children, light = false }: { children: React.ReactNode; light?: boolean }) => (
  <p className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] ${light ? GOLD : "text-[#9a7a45]"}`}>
    <span aria-hidden className="h-px w-8 bg-current" />{children}
  </p>
);

/** Company homepage, served at balasanka.in (middleware rewrites "/" there to this page). */
export default function GroupHome() {
  const brands = [...new Set(ALL_SHOWROOMS.map((s) => s.brand))];
  const stats: [number, string][] = [[ALL_SHOWROOMS.length, "Showrooms"], [TOWNS.length, "Towns"], [brands.length, "Brands"], [SHOWROOM_GROUPS.length, "Businesses"]];
  const perTown = TOWNS.map((t) => [t, ALL_SHOWROOMS.filter((s) => s.town === t).length] as const);
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f3ec] text-[#1d1a2e]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(groupSchema()).replace(/</g, "\\u003c") }} />

      <header id="top" className={`relative ${INK} text-white`}>
        <div aria-hidden className={`pointer-events-none absolute inset-0 ${LATTICE}`} />
        <div aria-hidden className="pointer-events-none absolute inset-0 [background:radial-gradient(50rem_28rem_at_80%_0%,rgba(73,58,170,.55),transparent_70%),radial-gradient(36rem_24rem_at_0%_100%,rgba(201,169,110,.16),transparent_70%)]" />

        <nav className="relative z-10 mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-4">
          <a href="#top" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/balasanka_logo.png" alt="" className="h-10 w-10 rounded-full bg-white object-contain p-1" />
            <span className="leading-tight">
              <span className={`${SERIF} block text-lg tracking-[0.12em]`}>BALASANKA</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.32em] text-white/60">Group of Companies</span>
            </span>
          </a>
          <div className="flex items-center gap-7 text-sm">
            <a href="#businesses" className="hidden text-white/70 transition hover:text-white md:inline">Businesses</a>
            <a href="#showrooms" className="hidden text-white/70 transition hover:text-white md:inline">Showrooms</a>
            <a href="#contact" className="hidden text-white/70 transition hover:text-white md:inline">Contact</a>
            <a href={CAREERS} className="rounded-full border border-[#c9a96e]/60 px-5 py-2 font-medium text-[#e6d3ad] transition hover:bg-[#c9a96e] hover:text-[#120e2e]">Careers</a>
          </div>
        </nav>

        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-14 sm:pb-28 sm:pt-24">
          <Eyebrow light>பாலசங்கா குழுமம் · South Tamil Nadu</Eyebrow>
          <h1 className={`${SERIF} mt-7 max-w-4xl text-[2.6rem] font-normal leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl`}>
            Jewellery, watches and two-wheelers, <em className="font-normal italic text-[#e6d3ad]">close to home.</em>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-white/70">
            {ALL_SHOWROOMS.length} showrooms across {TOWNS.length} towns, from Madurai to Tirunelveli, run by one family of companies.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href="#showrooms" className="inline-flex h-12 items-center rounded-full bg-[#c9a96e] px-7 text-sm font-semibold text-[#120e2e] transition hover:bg-[#e6d3ad]">Find a showroom</a>
            <a href={CAREERS} className="inline-flex h-12 items-center rounded-full border border-white/25 px-7 text-sm font-semibold text-white transition hover:border-white/60">Join our team <span aria-hidden className="ml-2">→</span></a>
          </div>

          <dl className="mt-20 grid grid-cols-2 border-t border-white/10 sm:grid-cols-4">
            {stats.map(([n, label], i) => (
              <div key={label} className={`pt-8 ${i % 2 ? "pl-6" : ""} ${i > 0 ? "sm:border-l sm:border-white/10 sm:pl-8" : ""} ${i > 1 ? "mt-6 sm:mt-0" : ""}`}>
                <dd className={`${SERIF} text-5xl font-normal text-white sm:text-6xl`}>{n}</dd>
                <dt className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">{label}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div aria-label="Brands at our showrooms" className="relative overflow-hidden border-t border-white/10 py-5">
          <div className="flex w-max animate-[marquee_45s_linear_infinite] motion-reduce:animate-none">
            {[0, 1].map((k) => (
              <ul key={k} aria-hidden={k === 1} className="flex shrink-0 items-center">
                {brands.map((b) => (
                  <li key={b} className={`${SERIF} flex items-center whitespace-nowrap text-xl text-white/60`}>
                    <span className="px-8">{b}</span><span aria-hidden className={`${GOLD} text-xs`}>◆</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:py-28 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <div>
            <Eyebrow>About the group</Eyebrow>
            <h2 className={`${SERIF} mt-5 text-3xl font-normal leading-tight text-[#120e2e] sm:text-[2.6rem]`}>One group, many trusted names.</h2>
          </div>
          <div className="space-y-5 text-lg leading-relaxed text-[#4a4560]">
            <p>
              Balasanka Group brings together our own jewellery houses, Akshaya Velli and Zora, with authorised showrooms for
              Tanishq, CaratLane, Titan, TVS and Honda.
            </p>
            <p>
              Whether you are choosing a wedding necklace, a first watch or a new scooter, you will find a Balasanka showroom
              in {TOWNS.slice(0, -1).join(", ")} or {TOWNS[TOWNS.length - 1]}.
            </p>
          </div>
        </section>

        <section id="businesses" className="scroll-mt-8 border-t border-[#1d1a2e]/10">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
            <Eyebrow>Our businesses</Eyebrow>
            <h2 className={`${SERIF} mt-5 max-w-2xl text-3xl font-normal leading-tight text-[#120e2e] sm:text-[2.6rem]`}>Three businesses, one standard of service.</h2>
            <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-[#1d1a2e]/10 bg-[#1d1a2e]/10 md:grid-cols-3">
              {SHOWROOM_GROUPS.map((g, i) => (
                <article key={g.key} className="group relative flex flex-col bg-[#fbf8f2] p-8 transition hover:bg-white sm:p-10">
                  <div className="flex items-start justify-between">
                    <span className={`${SERIF} text-6xl font-normal text-[#c9a96e]/50 transition group-hover:text-[#c9a96e]`}>0{i + 1}</span>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#c9a96e]/50 text-[#9a7a45]"><Icon k={g.key} /></span>
                  </div>
                  <h3 className={`${SERIF} mt-10 text-2xl font-medium text-[#120e2e]`}>{g.title}</h3>
                  <p className="mt-1 text-sm text-[#9a7a45]">{g.tamil}</p>
                  <p className="mt-5 flex-1 leading-relaxed text-[#4a4560]">{g.blurb}</p>
                  <ul className="mt-8 divide-y divide-[#1d1a2e]/10 border-y border-[#1d1a2e]/10 text-sm">
                    {brandsOf(g).map((b) => (
                      <li key={b} className="flex items-center justify-between py-2.5">
                        <span className="font-medium text-[#1d1a2e]">{b}</span>
                        <span className="text-[#8a8499]">{g.showrooms.filter((s) => s.brand === b).length}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#120e2e]">{g.showrooms.length} showrooms</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-label="Where we are" className={`relative ${INK} text-white`}>
          <div aria-hidden className={`pointer-events-none absolute inset-0 ${LATTICE}`} />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-24">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <Eyebrow light>Where we are</Eyebrow>
                <h2 className={`${SERIF} mt-5 text-3xl font-normal leading-tight sm:text-[2.6rem]`}>{TOWNS.length} towns across South Tamil Nadu.</h2>
              </div>
              <a href="#showrooms" className="text-sm font-medium text-[#e6d3ad] underline-offset-4 hover:underline">See every address →</a>
            </div>
            <ul className="mt-12 grid grid-cols-2 border-l border-t border-white/10 sm:grid-cols-4">
              {perTown.map(([t, n]) => (
                <li key={t} className="border-b border-r border-white/10 p-6 sm:p-8">
                  <p className={`${SERIF} text-xl sm:text-2xl`}>{t}</p>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">{n} {n === 1 ? "showroom" : "showrooms"}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="showrooms" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-20 sm:py-28">
          <Eyebrow>Visit us</Eyebrow>
          <h2 className={`${SERIF} mt-5 text-3xl font-normal leading-tight text-[#120e2e] sm:text-[2.6rem]`}>Find a showroom</h2>
          <p className="mt-4 max-w-xl text-lg text-[#4a4560]">Pick your town to see the showrooms near you, with directions on Google Maps.</p>
          <div className="mt-10"><ShowroomFinder groups={SHOWROOM_GROUPS} towns={TOWNS} /></div>
        </section>

        <section className="px-4 pb-20 sm:pb-28">
          <div className={`relative mx-auto max-w-6xl overflow-hidden rounded-3xl ${INK} px-6 py-14 text-white sm:px-14 sm:py-20`}>
            <div aria-hidden className={`pointer-events-none absolute inset-0 ${LATTICE}`} />
            <div aria-hidden className="pointer-events-none absolute inset-3 rounded-[1.25rem] border border-[#c9a96e]/30" />
            <div className="relative grid items-center gap-10 md:grid-cols-[1fr_auto]">
              <div>
                <Eyebrow light>Careers · வேலைவாய்ப்பு</Eyebrow>
                <h2 className={`${SERIF} mt-5 text-3xl font-normal leading-tight sm:text-5xl`}>Build your career <em className="italic text-[#e6d3ad]">with us.</em></h2>
                <p className="mt-5 max-w-xl text-white/70">We hire for sales, service, accounts, customer care and more, freshers included. See the open jobs at each showroom and apply online in about 5 minutes.</p>
              </div>
              <a href={CAREERS} className="inline-flex h-12 items-center justify-center rounded-full bg-[#c9a96e] px-8 text-sm font-semibold text-[#120e2e] transition hover:bg-[#e6d3ad]">See open jobs →</a>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className={`${INK} text-white/60`}>
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <p className={`${SERIF} text-2xl tracking-[0.12em] text-white`}>BALASANKA</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/50">Group of Companies</p>
            <p className="mt-6 max-w-sm text-sm leading-relaxed">{DESCRIPTION}</p>
            <p className="mt-6 text-sm">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">Write to us</span>
              <a className="mt-1 inline-block text-white hover:text-[#e6d3ad]" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          </div>
          <div>
            <h2 className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${GOLD}`}>Group companies</h2>
            <ul className="mt-5 space-y-2.5 text-sm">{COMPANIES.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
          <div>
            <h2 className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${GOLD}`}>Explore</h2>
            <ul className="mt-5 space-y-2.5 text-sm">
              <li><a className="hover:text-white" href="#businesses">Our businesses</a></li>
              <li><a className="hover:text-white" href="#showrooms">Find a showroom</a></li>
              <li><a className="hover:text-white" href={CAREERS}>Careers</a></li>
              <li><a className="hover:text-white" href={`${CAREERS_SITE}/privacy`}>Privacy</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-white/40">© {new Date().getFullYear()} Balasanka Group of Companies. Brand names belong to their owners.</p>
        </div>
      </footer>
    </div>
  );
}
