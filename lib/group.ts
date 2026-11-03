/**
 * The company website (balasanka.in): addresses, links and search-engine details. The showrooms and words
 * themselves are edited on the Website page (lib/site.ts, lib/site-data.ts), so nothing here needs a code change.
 */
import { FOODS_KEY, FOODS_SLUG, townSlug, type Showroom, type ShowroomGroup, type Site } from "./site";
export { townSlug, listOf, type Showroom, type ShowroomGroup, type Site } from "./site";
export const GROUP_SITE = "https://balasanka.in";
export const CAREERS_SITE = "https://hr.balasanka.in";


/**
 * Pages live under /group on the HR site (and its previews); on balasanka.in the middleware serves them from the root,
 * so links drop the prefix in production.
 */
export const GROUP_BASE = process.env.VERCEL_ENV === "production" ? "" : "/group";
export const groupHref = (path: string) => (path === "/" ? GROUP_BASE || "/" : `${GROUP_BASE}${path}`);
/** The food business has its own page (no showrooms). */
export const FOODS_PAGE = { key: FOODS_KEY, slug: FOODS_SLUG };

/** Brands in a business, in the order shown. */
export const brandsOf = (g: ShowroomGroup) => [...new Set(g.showrooms.map((s) => s.brand))];

export const fullAddress = (s: Showroom) => `${s.street}, ${s.town}, Tamil Nadu ${s.pin}`;
export const mapLink = (s: Showroom) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.brand} ${fullAddress(s)}`)}`;

const ORG_ID = `${GROUP_SITE}/#org`;
/** The closest schema.org shop type for each business, so search engines know what each showroom sells. */
const storeType = (s: Showroom) =>
  /cycle/i.test(s.brand) ? "BikeStore" : ({ vehicles: "MotorcycleDealer", jewellery: "JewelryStore" } as Record<string, string>)[s.business] ?? "Store";

/** One showroom as a schema.org shop with its address, linked to its town page and to the group. */
export function storeSchema(s: Showroom) {
  return {
    "@type": storeType(s),
    name: `${s.brand}, ${s.town}`,
    brand: s.brand,
    url: `${GROUP_SITE}/showrooms/${townSlug(s.town)}`,
    image: `${GROUP_SITE}/balasanka_logo.png`,
    address: { "@type": "PostalAddress", streetAddress: s.street, addressLocality: s.town, addressRegion: "Tamil Nadu", postalCode: s.pin, addressCountry: "IN" },
    hasMap: mapLink(s),
    parentOrganization: { "@id": ORG_ID },
  };
}

/** schema.org WebSite + Organization (founding facts confirmed by varun on 2 Nov 2026), with each showroom as a department. */
export function groupSchema(site: Site) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${GROUP_SITE}/#site`,
      name: "Balasanka Group",
      alternateName: ["Balasanka Group of Companies", "பாலசங்கா குழுமம்"],
      url: `${GROUP_SITE}/`,
      inLanguage: "en-IN",
      publisher: { "@id": ORG_ID },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": ORG_ID,
      name: "Balasanka Group of Companies",
      alternateName: ["Balasanka Group", "பாலசங்கா குழுமம்"],
      url: `${GROUP_SITE}/`,
      logo: `${GROUP_SITE}/balasanka_logo.png`,
      email: site.contact.email,
      foundingDate: "1966",
      foundingLocation: { "@type": "Place", name: "Theni, Tamil Nadu" },
      founder: { "@type": "Person", name: "S. Thirupathi Nadar" },
      areaServed: site.towns.map((t) => ({ "@type": "City", name: t })),
      department: site.all.map(storeSchema),
    },
  ];
}

/** Breadcrumbs (Home > ... > this page) so search results show where a page sits. */
export function breadcrumbSchema(trail: [string, string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [["Home", "/"] as [string, string], ...trail].map(([name, path], i) => ({
      "@type": "ListItem", position: i + 1, name, item: `${GROUP_SITE}${path === "/" ? "/" : path}`,
    })),
  };
}

/** Shop details for a set of showrooms (a town or a business), with the page's breadcrumbs. */
export const pageSchema = (rooms: Showroom[], trail: [string, string][]) => [
  { "@context": "https://schema.org", "@graph": rooms.map(storeSchema) },
  breadcrumbSchema(trail),
];

/** JSON for a <script type="application/ld+json">, safe inside HTML. */
export const ldJson = (x: unknown) => JSON.stringify(x).replace(/</g, "\\u003c");

/** Title, description, canonical address and share preview for one page of balasanka.in. */
export function pageMeta(title: string, description: string, path: string) {
  const url = `${GROUP_SITE}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website" as const, title, description, url, siteName: "Balasanka Group", locale: "en_IN", images: ["/balasanka_logo.png"] },
    twitter: { card: "summary" as const, title, description },
  };
}
