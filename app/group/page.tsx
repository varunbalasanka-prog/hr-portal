import type { Metadata } from "next";
import { ALL_SHOWROOMS, CAREERS_SITE, CONTACT_EMAIL, GROUP_SITE, SHOWROOM_GROUPS, TOWNS, fullAddress, groupSchema, mapLink } from "@/lib/group";

const DESCRIPTION = `Balasanka Group of Companies runs ${ALL_SHOWROOMS.length} jewellery, watch, eyewear and two-wheeler showrooms in ${TOWNS.length} towns of South Tamil Nadu.`;

export const metadata: Metadata = {
  metadataBase: new URL(GROUP_SITE),
  title: "Balasanka Group of Companies · பாலசங்கா குழுமம்",
  description: DESCRIPTION,
  alternates: { canonical: `${GROUP_SITE}/` },
  openGraph: { title: "Balasanka Group of Companies", description: DESCRIPTION, url: `${GROUP_SITE}/`, images: ["/balasanka_logo.png"], locale: "en_IN", siteName: "Balasanka Group" },
};

/** Company homepage, served at balasanka.in (middleware rewrites "/" there to this page). */
export default function GroupHome() {
  const brands = new Set(ALL_SHOWROOMS.map((s) => s.brand)).size;
  return (
    <main className="min-h-screen bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(groupSchema()).replace(/</g, "\\u003c") }} />

      <header className="bg-brand text-white">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/balasanka_logo.png" alt="" className="h-14 w-auto rounded bg-white p-1" />
            <div>
              <h1 className="font-serif text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">Balasanka Group</h1>
              <p className="text-sm text-slate-200">பாலசங்கா குழுமம் · Balasanka Group of Companies</p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-100">
            Jewellery, watch, eyewear and two-wheeler showrooms across South Tamil Nadu.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={`${CAREERS_SITE}/careers`} className="inline-flex min-h-11 items-center rounded-lg bg-white px-5 text-sm font-bold text-brand shadow-sm hover:bg-slate-100">
              Careers · வேலைவாய்ப்பு
            </a>
            <a href="#showrooms" className="inline-flex min-h-11 items-center rounded-lg border border-white/40 px-5 text-sm font-semibold text-white hover:bg-white/10">
              Find a showroom
            </a>
          </div>
          <dl className="mt-8 grid max-w-md grid-cols-3 gap-4 text-center">
            {[[ALL_SHOWROOMS.length, "Showrooms"], [TOWNS.length, "Towns"], [brands, "Brands"]].map(([n, label]) => (
              <div key={label} className="rounded-lg bg-white/10 py-3">
                <dt className="text-xs text-slate-200">{label}</dt>
                <dd className="text-2xl font-extrabold">{n}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div id="showrooms" className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        <p className="text-sm text-slate-600">Our towns: {TOWNS.join(", ")}.</p>
        {SHOWROOM_GROUPS.map((g) => (
          <section key={g.key} aria-labelledby={`h-${g.key}`}>
            <h2 id={`h-${g.key}`} className="mb-3 text-xl font-bold text-brand">
              {g.title} <span className="text-base font-semibold text-slate-500">· {g.tamil}</span>
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.showrooms.map((s) => (
                <li key={`${s.brand}-${s.town}`} className="card flex flex-col p-4">
                  <h3 className="font-bold">{s.brand}</h3>
                  <p className="text-sm font-semibold text-slate-600">{s.town}</p>
                  <address className="mt-2 text-sm not-italic leading-relaxed text-slate-600">{fullAddress(s)}</address>
                  <p className="mt-1 text-xs text-slate-400">{s.company}</p>
                  <a href={mapLink(s)} target="_blank" rel="noopener" className="mt-3 self-start text-sm font-semibold text-sky-800 underline">Open in Google Maps</a>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="rounded-lg bg-brand px-5 py-8 text-center text-white">
          <h2 className="text-xl font-bold">Work with us · எங்களுடன் பணியாற்றுங்கள்</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-200">
            We hire for sales, service, accounts and more at our showrooms. See the open jobs and apply online in about 5 minutes.
          </p>
          <a href={`${CAREERS_SITE}/careers`} className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-white px-5 text-sm font-bold text-brand hover:bg-slate-100">
            See open jobs
          </a>
        </section>
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-2 px-4 py-6 text-sm text-slate-600">
          <p>© {new Date().getFullYear()} Balasanka Group of Companies</p>
          <p>
            <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            {" · "}<a className="underline" href={`${CAREERS_SITE}/careers`}>Careers</a>
            {" · "}<a className="underline" href={`${CAREERS_SITE}/privacy`}>Privacy</a>
          </p>
        </div>
      </footer>
    </main>
  );
}
