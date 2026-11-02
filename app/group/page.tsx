import type { Metadata } from "next";
import { ALL_SHOWROOMS, CAREERS_SITE, GROUP_SITE, SHOWROOM_GROUPS, TOWNS, brandsOf, groupHref, groupSchema, townSlug } from "@/lib/group";
import { BusinessArt } from "./art";
import { BrandStrip, CHAPTER, LINK, NEUTRAL, WRAP } from "./ui";

const DESCRIPTION = `Balasanka Group of Companies runs ${ALL_SHOWROOMS.length} jewellery, watch, eyewear and two-wheeler showrooms in ${TOWNS.length} towns of South Tamil Nadu.`;

export const metadata: Metadata = {
  title: "Balasanka Group of Companies | பாலசங்கா குழுமம்",
  description: DESCRIPTION,
  alternates: { canonical: `${GROUP_SITE}/` },
  openGraph: { title: "Balasanka Group of Companies", description: DESCRIPTION, url: `${GROUP_SITE}/` },
};

const townsOf = (g: (typeof SHOWROOM_GROUPS)[number], brand: string) => [...new Set(g.showrooms.filter((s) => s.brand === brand).map((s) => s.town))];

/** Company homepage, served at balasanka.in. Every section uses the same two columns: words on the left, picture on the right. */
export default function GroupHome() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(groupSchema()).replace(/</g, "\\u003c") }} />

      <section className={`${WRAP} py-14 sm:py-20`}>
        <div className="grid items-center gap-10 md:grid-cols-12">
          <div className="md:col-span-7">
            <h1 className="text-4xl font-semibold leading-tight text-[#2b2177] sm:text-5xl">Balasanka Group of Companies</h1>
            <p lang="ta" className="mt-2 text-2xl font-semibold text-[#d9261c]">பாலசங்கா குழுமம்</p>
            <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-[#4a4666] sm:text-xl">
              Two-wheelers, jewellery, watches and eyewear at {ALL_SHOWROOMS.length} showrooms in {TOWNS.length} towns of South Tamil Nadu, from Theni to Tirunelveli. A Theni family business since 1966.
            </p>
            <a href={groupHref("/showrooms")} className="mt-8 inline-flex h-12 items-center rounded-md bg-[#d9261c] px-6 font-semibold text-white hover:bg-[#b81f17]">Find a showroom near you</a>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/balasanka_logo.png" alt="" className="mx-auto hidden w-full max-w-[18rem] md:col-span-5 md:block" />
        </div>
      </section>

      <BrandStrip />
      <div aria-hidden className="g-border" />

      {SHOWROOM_GROUPS.map((g) => {
        const c = CHAPTER[g.key];
        return (
          <section key={g.key} aria-labelledby={`h-${g.key}`} className={`${c.field} ${WRAP} py-14 sm:py-20`}>
            <div className="grid items-center gap-10 md:grid-cols-12">
              <div data-reveal className="md:col-span-7">
                <h2 id={`h-${g.key}`} className="text-3xl font-semibold sm:text-4xl">{g.title}</h2>
                <p lang="ta" className="mt-1 text-lg text-[#4a4666]">{g.tamil}</p>
                <p className="mt-4 max-w-[48ch] text-lg leading-relaxed text-[#4a4666]">{g.blurb}</p>
                <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {brandsOf(g).map((b) => (
                    <li key={b}>
                      <p className="text-lg font-semibold">{b}</p>
                      <p className="text-[15px] text-[#4a4666]">{townsOf(g, b).join(", ")}</p>
                    </li>
                  ))}
                </ul>
                <a href={groupHref(`/${g.slug}`)} className={`mt-7 inline-block font-semibold ${LINK}`}>See all {g.showrooms.length} {g.title.toLowerCase()} showrooms</a>
              </div>
              <div className="flex justify-center md:col-span-5">
                <BusinessArt k={g.key} />
              </div>
            </div>
          </section>
        );
      })}

      <section aria-labelledby="h-towns" className={`${WRAP} py-14 sm:py-20`}>
        <h2 data-reveal id="h-towns" className="text-3xl font-semibold sm:text-4xl">Find us in {TOWNS.length} towns</h2>
        <p className="mt-3 max-w-[48ch] text-lg leading-relaxed text-[#4a4666]">Choose your town for the address of every showroom there.</p>
        <ul data-reveal className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {TOWNS.map((t) => {
            const n = ALL_SHOWROOMS.filter((s) => s.town === t).length;
            return (
              <li key={t}>
                <a href={groupHref(`/showrooms/${townSlug(t)}`)} className={`block rounded-lg ${NEUTRAL} px-4 py-4 transition-colors hover:bg-[#e9e9ef]`}>
                  <span className="block text-lg font-semibold">{t}</span>
                  <span className="block text-[15px] text-[#4a4666]">{n} {n === 1 ? "showroom" : "showrooms"}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="h-careers" className={`${WRAP} pb-14 sm:pb-20`}>
        <div data-reveal className="flex flex-col gap-6 rounded-xl bg-[#f4f4f6] p-8 sm:p-10 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="h-careers" className="text-3xl font-semibold sm:text-4xl">Work with us</h2>
            <p className="mt-3 max-w-[50ch] text-lg leading-relaxed text-[#4a4666]">
              We hire for sales, service, accounts and customer care at our showrooms, and freshers are welcome. Apply online in about five minutes.
            </p>
          </div>
          <a href={`${CAREERS_SITE}/careers`} className="inline-flex h-12 shrink-0 items-center justify-center rounded-md bg-[#2b2177] px-6 font-semibold text-white hover:bg-[#1e1758]">See open jobs</a>
        </div>
      </section>
    </>
  );
}
