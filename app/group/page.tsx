import type { Metadata } from "next";
import Image from "next/image";
import { ALL_SHOWROOMS, CAREERS_SITE, COMPANIES, CONTACT_EMAIL, GROUP_SITE, HERO_PHOTO, SHOWROOM_GROUPS, TOWNS, brandsOf, groupSchema } from "@/lib/group";
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

const ICONS: Record<string, React.ReactNode> = {
  jewellery: <path d="M6 3h12l3 6-9 12L3 9l3-6Zm-3 6h18M9 3l3 6 3-6M12 9v12" />,
  watches: <><circle cx="12" cy="12" r="6" /><path d="M12 9v3l2 2M9 3h6l1 3H8l1-3Zm0 18h6l1-3H8l1 3Z" /></>,
  vehicles: <><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="M9 17h6l-3-7h4l2 7M12 10l-2-4H7" /></>,
};
const Icon = ({ k }: { k: string }) => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[k]}</svg>
);

/** Company homepage, served at balasanka.in (middleware rewrites "/" there to this page). */
export default function GroupHome() {
  const brands = [...new Set(ALL_SHOWROOMS.map((s) => s.brand))];
  const stats: [number, string, string][] = [
    [ALL_SHOWROOMS.length, "Showrooms", "ஷோரூம்கள்"], [TOWNS.length, "Towns", "நகரங்கள்"], [brands.length, "Brands", "பிராண்டுகள்"], [SHOWROOM_GROUPS.length, "Businesses", "தொழில்கள்"],
  ];
  return (
    <div className="min-h-screen bg-[#faf8f5] text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(groupSchema()).replace(/</g, "\\u003c") }} />

      <nav className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <a href="#top" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/balasanka_logo.png" alt="" className="h-9 w-auto" />
            <span className="font-serif text-lg font-bold tracking-wide text-brand">BALASANKA <span className="font-normal">GROUP</span></span>
          </a>
          <div className="flex items-center gap-1 text-sm font-semibold sm:gap-5">
            <a href="#businesses" className="hidden text-slate-600 hover:text-brand sm:inline">Businesses</a>
            <a href="#showrooms" className="hidden text-slate-600 hover:text-brand sm:inline">Showrooms</a>
            <a href="#contact" className="hidden text-slate-600 hover:text-brand md:inline">Contact</a>
            <a href={CAREERS} className="rounded-full bg-brand px-4 py-2 text-white hover:bg-brand-dark">Careers</a>
          </div>
        </div>
      </nav>

      <header id="top" className="relative overflow-hidden bg-brand text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(60rem_30rem_at_85%_-10%,#6b5fd6,transparent),radial-gradient(40rem_25rem_at_-10%_110%,#d9261c,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:pb-20 sm:pt-20 lg:grid-cols-[1.15fr_1fr]">
          <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f5c2be]">Balasanka Group of Companies · பாலசங்கா குழுமம்</p>
          <h1 className="mt-4 font-serif text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl">
            Jewellery, watches and two-wheelers for South Tamil Nadu.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-200">
            {ALL_SHOWROOMS.length} showrooms across {TOWNS.length} towns, from Madurai to Tirunelveli, run by one family of companies.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#showrooms" className="inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-bold text-brand shadow-lg hover:bg-slate-100">Find a showroom near you</a>
            <a href={CAREERS} className="inline-flex h-12 items-center rounded-full border border-white/40 px-6 text-sm font-bold text-white hover:bg-white/10">Join our team · வேலைவாய்ப்பு</a>
          </div>
          </div>
          <figure className="relative">
            <div aria-hidden className="absolute -inset-3 rotate-2 rounded-[2rem] bg-[#d9261c]/40" />
            <Image src={HERO_PHOTO.src} alt={HERO_PHOTO.alt} width={1000} height={1250} priority sizes="(min-width: 1024px) 480px, 100vw"
              className="relative aspect-[4/5] w-full rounded-[2rem] object-cover shadow-2xl sm:aspect-[4/3] lg:aspect-[4/5]" />
          </figure>
        </div>
        <div className="relative border-t border-white/15 bg-black/10">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 px-4 sm:grid-cols-4">
            {stats.map(([n, label, ta], i) => (
              <div key={label} className={`py-6 sm:py-8 ${i % 2 ? "pl-6" : ""} ${i > 0 ? "sm:border-l sm:border-white/15 sm:pl-8" : ""}`}>
                <dd className="font-serif text-4xl font-bold sm:text-5xl">{n}</dd>
                <dt className="mt-1 text-sm text-slate-300">{label} · {ta}</dt>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <main>
        <section id="businesses" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d9261c]">Our businesses</p>
          <h2 className="mt-2 max-w-2xl font-serif text-3xl font-bold text-brand sm:text-4xl">Three businesses, one promise of service.</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {SHOWROOM_GROUPS.map((g) => (
              <article key={g.key} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image src={g.photo.src} alt={g.photo.alt} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute bottom-0 left-6 flex h-14 w-14 translate-y-1/2 items-center justify-center rounded-xl bg-white text-brand shadow-md ring-1 ring-brand/10"><Icon k={g.key} /></div>
                </div>
                <div className="flex flex-1 flex-col p-7 pt-10">
                <h3 className="text-xl font-bold">{g.title}</h3>
                <p className="text-sm font-semibold text-slate-500">{g.tamil}</p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{g.blurb}</p>
                <ul className="mt-5 flex flex-wrap gap-1.5">
                  {brandsOf(g).map((b) => <li key={b} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{b}</li>)}
                </ul>
                <p className="mt-5 border-t border-slate-100 pt-4 text-sm font-semibold text-brand">{g.showrooms.length} showrooms</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-label="Our brands" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Brands at our showrooms</p>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {brands.map((b) => <li key={b} className="font-serif text-xl font-bold text-slate-400 sm:text-2xl">{b}</li>)}
            </ul>
          </div>
        </section>

        <section id="showrooms" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d9261c]">Visit us</p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-brand sm:text-4xl">Find a showroom</h2>
          <p className="mt-3 max-w-2xl text-slate-600">Pick your town to see the showrooms near you, with directions on Google Maps.</p>
          <div className="mt-8"><ShowroomFinder groups={SHOWROOM_GROUPS} towns={TOWNS} /></div>
        </section>

        <section className="px-4 pb-16 sm:pb-24">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand px-6 py-12 text-white sm:px-12 sm:py-16">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(30rem_20rem_at_100%_0%,#d9261c,transparent)]" />
            <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f5c2be]">Careers · வேலைவாய்ப்பு</p>
                <h2 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">Build your career with us.</h2>
                <p className="mt-3 max-w-xl text-slate-200">We hire for sales, service, accounts, customer care and more, freshers included. See the open jobs at each showroom and apply online in about 5 minutes.</p>
              </div>
              <a href={CAREERS} className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-bold text-brand hover:bg-slate-100">See open jobs →</a>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="bg-[#14102e] text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/balasanka_logo.png" alt="" className="h-10 w-auto rounded bg-white p-1" />
              <span className="font-serif text-lg font-bold tracking-wide text-white">BALASANKA GROUP</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed">{DESCRIPTION}</p>
            <p className="mt-4 text-sm">Email: <a className="font-semibold text-white hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Group companies</h2>
            <ul className="mt-4 space-y-2 text-sm">{COMPANIES.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Quick links</h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li><a className="hover:text-white" href="#businesses">Our businesses</a></li>
              <li><a className="hover:text-white" href="#showrooms">Find a showroom</a></li>
              <li><a className="hover:text-white" href={CAREERS}>Careers</a></li>
              <li><a className="hover:text-white" href={`${CAREERS_SITE}/privacy`}>Privacy</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-slate-400">© {new Date().getFullYear()} Balasanka Group of Companies. Brand names belong to their owners. Photos: {[HERO_PHOTO, ...SHOWROOM_GROUPS.map((g) => g.photo)].map((p) => p.credit).join(", ")}.</p>
        </div>
      </footer>
    </div>
  );
}
