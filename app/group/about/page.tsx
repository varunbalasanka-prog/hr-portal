import type { Metadata } from "next";
import {
  ALL_SHOWROOMS,
  COMPANIES,
  pageMeta,
  SHOWROOM_GROUPS,
  TOWNS,
  brandsOf,
} from "@/lib/group";
import { BusinessLinks, WRAP } from "../ui";

export const metadata: Metadata = pageMeta(
  "About | Balasanka Group",
  "Balasanka Group began in Theni in 1966 as a tamarind processing unit. Today it runs two-wheeler dealerships, jewellery houses and lifestyle stores across South Tamil Nadu, and still makes dhal and tamarind in Theni.",
  "/about",
);

const list = (xs: string[]) => xs.join(", ").replace(/, ([^,]*)$/, " and $1");

/**
 * The group's story: a short pick from varun's own timeline (2 Nov 2026), which wins over the research PDF.
 * Left out on purpose: Bombay Dyeing, turnover, leadership names and businesses outside the showroom list.
 */
const STORY: { year: string; title: string; text: string }[] = [
  {
    year: "1966",
    title: "SGT",
    text: "Mr. S. Thirupathi Nadar starts SGT, a small tamarind business in Theni. Honest weight and fair grading become the family's way of doing business.",
  },
  {
    year: "1991",
    title: "Balasanka Dhal",
    text: "The family opens its first pulses factory, Balasanka Dhal, and sets up Asia's first solar dryer for pulses. A second factory, Sanka Dhal, follows in 1995, and in 2016 the Akshaya Dhal brand, which now carries all our dhal and seedless tamarind.",
  },
  {
    year: "1997",
    title: "Shri Murugesan Motors",
    text: "Our first two-wheeler dealership opens in Theni.",
  },
  {
    year: "2001",
    title: "Sri Balasanka Mills",
    text: "A mill in Theni turned tamarind seeds, once thrown away, into starch for textile printing and husk for fuel.",
  },
  {
    year: "2004–2017",
    title: "Two-wheelers across the south",
    text: "Balasanka TVS, Mukesh Motors (Honda), Yasotha Motors and Tenkasi TVS take our dealerships to six towns.",
  },
  {
    year: "2019",
    title: "Tanishq",
    text: "Our first jewellery store, Tanishq, opens in Theni. Titan, Titan Eye+, Mia and CaratLane stores follow.",
  },
  {
    year: "2021",
    title: "Akshaya Velli",
    text: "Our own silver jewellery house opens in Theni, then in Tenkasi, Tirunelveli and Sivakasi.",
  },
  {
    year: "2025",
    title: "Zora",
    text: "Zora by Akshaya Velli, its more luxurious line, opens in Theni for silver jewellery, silver gifts and pooja articles.",
  },
];

const VALUES: { title: string; text: string }[] = [
  {
    title: "Purity you can check",
    text: "Hallmarked silver and gold, graded produce and genuine spares. What we sell is what the label says.",
  },
  {
    title: "A family business",
    text: "The same family has run the group for three generations, and the people you meet in our showrooms are from your town.",
  },
  {
    title: "Close to home",
    text: `Every showroom is in South Tamil Nadu, within a few hours of Theni, where the group began.`,
  },
];

export default function AboutPage() {
  const brands = new Set(SHOWROOM_GROUPS.flatMap(brandsOf));
  const facts: [string, string][] = [
    ["1966", "the year we began"],
    [String(ALL_SHOWROOMS.length), "showrooms today"],
    [String(TOWNS.length), "towns"],
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
              <p className="max-w-[48ch]">
                Balasanka Group began in Theni in 1966 as a small tamarind
                processing unit. Sixty years later, the same family runs
                two-wheeler dealerships, jewellery houses and lifestyle stores
                across {list(TOWNS)}, and still makes dhal and seedless
                tamarind at its factories in Theni.
              </p>
              <p className="max-w-[48ch]">
                Our own brands are Akshaya Dhal, for dhal and seedless tamarind,
                and the jewellery house Akshaya Velli with its luxury line Zora. We run them
                alongside dealerships and franchise stores for TVS, Honda,
                Tanishq, Mia by Tanishq, CaratLane, Titan, Titan Eye+ and
                Fastrack.
              </p>
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
              key={s.year}
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
          {COMPANIES.map((c) => {
            const rooms = ALL_SHOWROOMS.filter((s) => s.company === c);
            const kinds = SHOWROOM_GROUPS.filter((g) =>
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

      <BusinessLinks />
    </>
  );
}
