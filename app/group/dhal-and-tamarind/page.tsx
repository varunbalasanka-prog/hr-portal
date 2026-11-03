import type { Metadata } from "next";
import { FOODS_PAGE, GROUP_SITE, breadcrumbSchema, ldJson, pageMeta } from "@/lib/group";
import { getSite } from "@/lib/site-data";
import { BusinessArt } from "../art";
import { EmailLink } from "../email-link";
import { BusinessLinks, CHAPTER, WRAP } from "../ui";

export async function generateMetadata(): Promise<Metadata> {
  const f = (await getSite()).foods;
  const description = `${f.brands.map((b) => b.name).join(", ")}: ${f.products.join(", ").toLowerCase()} from the Balasanka Group factories in Theni, Tamil Nadu. Wholesale and factory outlet.`;
  return pageMeta(`${f.title} | Balasanka Group`, description, `/${FOODS_PAGE.slug}`);
}

/** The food business: what we make, our brands, and how to buy. Same layout as the showroom business pages. */
export default async function FoodsPage() {
  const site = await getSite();
  const FOODS = { ...site.foods, ...FOODS_PAGE };
  const CONTACT_EMAIL = site.contact.email;
  const c = CHAPTER[FOODS.key];
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Balasanka Group dhal and tamarind",
      url: `${GROUP_SITE}/${FOODS.slug}`,
      parentOrganization: { "@id": `${GROUP_SITE}/#org` },
      brand: FOODS.brands.map((b) => ({ "@type": "Brand", name: b.name })),
      address: { "@type": "PostalAddress", addressLocality: "Theni", addressRegion: "Tamil Nadu", addressCountry: "IN" },
      email: CONTACT_EMAIL,
      makesOffer: FOODS.products.map((p) => ({ "@type": "Offer", itemOffered: { "@type": "Product", name: p } })),
    },
    breadcrumbSchema([[FOODS.title, `/${FOODS.slug}`]]),
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(schema) }} />
      <section className={`${c.field} ${WRAP} py-10 sm:py-16`}>
        <div className="grid items-center gap-10 md:grid-cols-12">
          <div className="md:col-span-7">
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{FOODS.title}</h1>
            <p lang="ta" className="mt-2 text-xl text-[#4a4666]">{FOODS.tamil}</p>
            <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-[#4a4666]">
              {FOODS.blurb} The group began with tamarind in Theni in 1966, and the family still runs the factories today.
            </p>
          </div>
          <div className="flex md:col-span-5 md:justify-center">
            <BusinessArt k={FOODS.key} />
          </div>
        </div>
      </section>

      <div className={`${WRAP} pt-14 sm:pt-20`}>
        <section aria-labelledby="f-what" className="grid gap-6 md:grid-cols-12">
          <div data-reveal className="md:col-span-5">
            <h2 id="f-what" className="text-3xl font-semibold sm:text-4xl">What we make</h2>
            <p className="mt-3 max-w-[34ch] text-lg leading-relaxed text-[#4a4666]">From our factories in Theni.</p>
          </div>
          <ul data-reveal className="grid gap-x-10 gap-y-1 sm:grid-cols-2 md:col-span-7">
            {FOODS.products.map((p) => <li key={p} className="py-3 text-lg font-semibold">{p}</li>)}
          </ul>
        </section>

        <section aria-labelledby="f-brands" className="mt-14 grid gap-6 sm:mt-16 md:grid-cols-12">
          <div data-reveal className="md:col-span-5">
            <h2 id="f-brands" className="text-3xl font-semibold sm:text-4xl">{FOODS.brands.length === 1 ? "Our brand" : "Our brands"}</h2>
          </div>
          <ul data-reveal className="grid gap-x-10 sm:grid-cols-2 md:col-span-7">
            {FOODS.brands.map((b) => (
              <li key={b.name} className="py-3.5">
                <p className="text-lg font-semibold">{b.name}</p>
                <p className="mt-0.5 text-[#4a4666]">{b.note}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="f-buy" className="mt-14 grid gap-6 sm:mt-16 md:grid-cols-12">
          <div data-reveal className="md:col-span-5">
            <h2 id="f-buy" className="text-3xl font-semibold sm:text-4xl">How to buy</h2>
          </div>
          <div data-reveal className="space-y-4 text-lg leading-relaxed text-[#4a4666] md:col-span-7">
            <p><span className="font-semibold text-[#1b1640]">Shops and traders:</span> we sell wholesale. Write to us for prices and orders.</p>
            <p><span className="font-semibold text-[#1b1640]">Families:</span> buy at our factory outlet in Theni.</p>
            <p>Write to <EmailLink email={CONTACT_EMAIL} className="inline-block py-1 font-semibold text-[#1b1640]" /></p>
          </div>
        </section>
      </div>

      <BusinessLinks site={site} except={FOODS.key} />
    </>
  );
}
