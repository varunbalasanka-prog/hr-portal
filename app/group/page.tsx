import type { Metadata } from "next";
import { ALL_SHOWROOMS, CAREERS_SITE, GROUP_SITE, SHOWROOM_GROUPS, TOWNS, brandsOf, groupHref, groupSchema, townSlug } from "@/lib/group";
import { BusinessArt } from "./art";
import { CHAPTER, LINK, WRAP } from "./ui";

const DESCRIPTION = `Balasanka Group of Companies runs ${ALL_SHOWROOMS.length} jewellery, watch, eyewear and two-wheeler showrooms in ${TOWNS.length} towns of South Tamil Nadu.`;

export const metadata: Metadata = {
  title: "Balasanka Group of Companies | பாலசங்கா குழுமம்",
  description: DESCRIPTION,
  alternates: { canonical: `${GROUP_SITE}/` },
  openGraph: { title: "Balasanka Group of Companies", description: DESCRIPTION, url: `${GROUP_SITE}/` },
};

const townsOf = (g: (typeof SHOWROOM_GROUPS)[number], brand: string) => [...new Set(g.showrooms.filter((s) => s.brand === brand).map((s) => s.town))];

/** Company homepage, served at balasanka.in. The name is the headline; each business follows as its own colour chapter. */
export default function GroupHome() {
  const [jewellery, watches, vehicles] = SHOWROOM_GROUPS;
  const jc = CHAPTER.jewellery, wc = CHAPTER.watches, vc = CHAPTER.vehicles;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(groupSchema()).replace(/</g, "\\u003c") }} />

      <section className={`${WRAP} pb-20 pt-10 sm:pt-16 lg:pb-28`}>
        <h1 className="sr-only">Balasanka Group of Companies</h1>
        <p aria-hidden className="-ml-[0.04em] text-[clamp(4.2rem,17.5vw,17rem)] font-bold leading-[0.9] tracking-[-0.045em] text-[#2b2177]">Balasanka</p>
        <div className="mt-10 grid gap-8 md:grid-cols-12 md:items-end">
          <p lang="ta" className="text-3xl font-semibold text-[#d9261c] sm:text-4xl md:col-span-5">பாலசங்கா குழுமம்</p>
          <div className="md:col-span-7 lg:col-span-6 lg:col-start-7">
            <p className="max-w-[40ch] text-xl leading-relaxed sm:text-2xl sm:leading-snug">
              Jewellery, watches, eyewear and two-wheelers at {ALL_SHOWROOMS.length} showrooms in {TOWNS.length} towns of South Tamil Nadu.
            </p>
            <a href={groupHref("/showrooms")} className="mt-7 inline-flex h-13 items-center rounded-md bg-[#d9261c] px-7 text-lg font-semibold text-white hover:bg-[#b81f17]">Find a showroom near you</a>
          </div>
        </div>
      </section>

      {/* Jewellery: heading left, the brands set large on the right. */}
      <section aria-labelledby="h-jewellery" className={`${jc.field} ${jc.ink} ${WRAP} py-20 lg:py-28`}>
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 id="h-jewellery" className="text-5xl font-bold tracking-tight sm:text-6xl">Jewellery</h2>
            <p className={`mt-5 max-w-[34ch] text-lg leading-relaxed ${jc.soft}`}>{jewellery.blurb}</p>
            <a href={groupHref(`/${jewellery.slug}`)} className={`mt-6 inline-block text-lg font-semibold ${LINK}`}>Our {jewellery.showrooms.length} jewellery showrooms</a>
          </div>
          <BusinessArt k="jewellery" className="mx-auto w-40 sm:w-48 md:col-span-3 md:w-full md:max-w-[15rem] md:self-center" />
          <ul className="space-y-6 md:col-span-5">
            {brandsOf(jewellery).map((b) => (
              <li key={b}>
                <p className="text-4xl font-semibold tracking-tight sm:text-5xl">{b}</p>
                <p className={`mt-1 text-lg ${jc.soft}`}>{townsOf(jewellery, b).join(", ")}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Watches and eyewear: three brand names across the width, the words under them. */}
      <section aria-labelledby="h-watches" className={`${wc.field} ${wc.ink} ${WRAP} py-20 lg:py-28`}>
        <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
          <h2 id="h-watches" className="text-5xl font-bold tracking-tight sm:text-6xl">Watches and eyewear</h2>
          <BusinessArt k="watches" className="w-full max-w-[26rem]" />
        </div>
        <ul className="mt-12 grid gap-8 sm:grid-cols-3">
          {brandsOf(watches).map((b) => (
            <li key={b}>
              <p className="text-4xl font-semibold tracking-tight lg:text-6xl">{b}</p>
              <p className={`mt-2 text-lg ${wc.soft}`}>{townsOf(watches, b).join(", ")}</p>
            </li>
          ))}
        </ul>
        <div className="mt-14 flex flex-wrap items-baseline justify-between gap-6">
          <p className={`max-w-[44ch] text-lg leading-relaxed ${wc.soft}`}>{watches.blurb}</p>
          <a href={groupHref(`/${watches.slug}`)} className={`text-lg font-semibold ${LINK}`}>Our watch and eyewear stores</a>
        </div>
      </section>

      {/* Two-wheelers: the brands as one long sentence of names. */}
      <section aria-labelledby="h-vehicles" className={`${vc.field} ${vc.ink} ${WRAP} py-20 lg:py-28`}>
        <div className="grid gap-10 md:grid-cols-12">
          <h2 id="h-vehicles" className="text-5xl font-bold tracking-tight sm:text-6xl md:col-span-12">Two-wheelers and cycles</h2>
          <p className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl sm:leading-[1.1] md:col-span-9">
            {brandsOf(vehicles).join(", ").replace(/, ([^,]*)$/, " and $1")}.
          </p>
          <div className="md:col-span-6">
            <p className={`max-w-[44ch] text-lg leading-relaxed ${vc.soft}`}>{vehicles.blurb}</p>
            <a href={groupHref(`/${vehicles.slug}`)} className={`mt-6 inline-block text-lg font-semibold ${LINK}`}>Our {vehicles.showrooms.length} two-wheeler and cycle showrooms</a>
          </div>
          <BusinessArt k="vehicles" className="md:col-span-6" />
        </div>
      </section>

      <section aria-labelledby="h-towns" className={`${WRAP} py-20 lg:py-28`}>
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 id="h-towns" className="text-4xl font-bold tracking-tight sm:text-5xl">Find us in {TOWNS.length} towns</h2>
            <p className="mt-4 max-w-[30ch] text-lg leading-relaxed">Choose your town for the address of every showroom there.</p>
          </div>
          <ul className="grid grid-cols-1 gap-x-10 gap-y-2 sm:grid-cols-2 md:col-span-8">
            {TOWNS.map((t) => {
              const n = ALL_SHOWROOMS.filter((s) => s.town === t).length;
              return (
                <li key={t}>
                  <a href={groupHref(`/showrooms/${townSlug(t)}`)} className="group flex items-baseline justify-between gap-4 rounded-md px-3 py-3 -mx-3 hover:bg-[#f3f2f7]">
                    <span className="text-3xl font-semibold tracking-tight group-hover:underline">{t}</span>
                    <span className="text-lg text-[#3e3a5c]">{n} {n === 1 ? "showroom" : "showrooms"}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="h-careers" className={`${WRAP} bg-[#1b1640] py-20 text-white lg:py-24`}>
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <h2 id="h-careers" className="text-4xl font-bold tracking-tight sm:text-5xl">Work with us</h2>
            <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-[#d9d6ef]">
              We hire for sales, service, accounts and customer care at our showrooms, and freshers are welcome. Apply online in about five minutes.
            </p>
          </div>
          <div className="md:col-span-5 md:text-right">
            <a href={`${CAREERS_SITE}/careers`} className="inline-flex h-13 items-center rounded-md bg-white px-7 text-lg font-semibold text-[#1b1640] hover:bg-[#e6e5ec]">See open jobs</a>
          </div>
        </div>
      </section>
    </>
  );
}
