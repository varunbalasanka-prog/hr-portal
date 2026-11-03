import type { Metadata } from "next";
import { brandsOf, listOf, pageMeta } from "@/lib/group";
import { fill } from "@/lib/site";
import { getSite } from "@/lib/site-data";
import { BusinessLinks, WRAP } from "../ui";

export const metadata: Metadata = pageMeta(
  "About | Balasanka Group",
  "Balasanka Group began in Theni in 1966 as a tamarind processing unit. Today it runs two-wheeler dealerships, jewellery houses and lifestyle stores across South Tamil Nadu, and still makes dhal and tamarind in Theni.",
  "/about",
);

const list = listOf;

/** The group's story, values and companies. The words are edited on the Website page (About page). */
export default async function AboutPage() {
  const site = await getSite();
  const { story: STORY, values: VALUES } = site.about;
  const brands = new Set(site.groups.flatMap(brandsOf));
  const facts: [string, string][] = [
    ["1966", "the year we began"],
    [String(site.all.length), "showrooms today"],
    [String(site.towns.length), "towns"],
    [String(brands.size), "brands"],
  ];

  return (
    <>
      <section className={`${WRAP} pb-12 pt-10 sm:pb-16 sm:pt-14`}>
        <div className="grid gap-10 md:grid-cols-12 md:items-center">
          <div className="md:col-span-7">
            <h1 className="text-4xl font-semibold leading-tight text-[#2b2177] sm:text-5xl">
              About the group
            </h1>
            <p lang="ta" className="mt-2 text-2xl font-semibold text-[#d9261c]">
              பாலசங்கா குழுமம்
            </p>
            <div className="mt-6 space-y-4 text-lg leading-relaxed text-[#4a4666]">
              {site.about.intro.map((t, i) => <p key={i} className="max-w-[48ch]">{fill(t, site)}</p>)}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-6 rounded-xl bg-[#f4f4f6] p-6 sm:p-8 md:col-span-5">
            {facts.map(([n, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="text-4xl font-semibold text-[#2b2177]">{n}</dd>
                <dd className="mt-1 text-[#4a4666]">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section
        aria-labelledby="h-story"
        className={`${WRAP} bg-[#f8f3e8] py-14 sm:py-20`}
      >
        <h2
          data-reveal
          id="h-story"
          className="text-3xl font-semibold sm:text-4xl"
        >
          Our story
        </h2>
        <ol className="mt-12 border-l-2 border-[#d8d3c4]">
          {STORY.map((s) => (
            <li
              key={`${s.year}-${s.title}`}
              data-reveal
              className="relative pb-10 pl-8 last:pb-0 md:grid md:grid-cols-[7.5rem_1fr] md:gap-6"
            >
              <span
                aria-hidden
                className="absolute -left-[7px] top-2 h-3 w-3 rounded-full bg-[#d9261c]"
              />
              <p className="text-xl font-semibold text-[#d9261c]">
                {s.year}
              </p>
              <div>
                <h3 className="text-xl font-semibold text-[#1b1640]">
                  {s.title}
                </h3>
                <p className="mt-2 max-w-[60ch] text-lg leading-relaxed text-[#4a4666]">
                  {s.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="h-values" className={`${WRAP} py-14 sm:py-20`}>
        <h2
          data-reveal
          id="h-values"
          className="text-3xl font-semibold sm:text-4xl"
        >
          What we stand for
        </h2>
        <ul data-reveal className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-3">
          {VALUES.map((v) => (
            <li key={v.title}>
              <h3 className="text-xl font-semibold text-[#1b1640]">
                {v.title}
              </h3>
              <p className="mt-2 text-lg leading-relaxed text-[#4a4666]">
                {v.text}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="h-companies"
        className={`${WRAP} bg-[#f4f4f6] py-14 sm:py-20`}
      >
        <h2
          data-reveal
          id="h-companies"
          className="text-3xl font-semibold sm:text-4xl"
        >
          Our companies
        </h2>
        <ul className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {site.companies.map((c) => {
            const rooms = site.all.filter((s) => s.company === c);
            const kinds = site.groups.filter((g) =>
              g.showrooms.some((s) => s.company === c),
            ).map((g) => g.title.toLowerCase());
            return (
              <li key={c}>
                <h3 className="text-xl font-semibold">{c}</h3>
                <p className="mt-2 max-w-[48ch] text-lg leading-relaxed text-[#4a4666]">
                  Runs {rooms.length}{" "}
                  {rooms.length === 1 ? "showroom" : "showrooms"} ({list(kinds)}
                  ):{" "}
                  {list([
                    ...new Set(rooms.map((s) => `${s.brand} in ${s.town}`)),
                  ])}
                  .
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <BusinessLinks site={site} />
    </>
  );
}
