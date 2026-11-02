/**
 * The company homepage (balasanka.in). Showroom list copied from the branches table on 29 Oct 2026;
 * update it here when a showroom opens, closes or moves.
 */
export const GROUP_SITE = "https://balasanka.in";
export const CAREERS_SITE = "https://hr.balasanka.in";
export const CONTACT_EMAIL = "support@balasanka.in";

export type Showroom = { brand: string; town: string; company: string; street: string; pin: string };
export type ShowroomGroup = { key: string; slug: string; title: string; tamil: string; blurb: string; showrooms: Showroom[] };

/**
 * Pages live under /group on the HR site (and its previews); on balasanka.in the middleware serves them from the root,
 * so links drop the prefix in production.
 */
export const GROUP_BASE = process.env.VERCEL_ENV === "production" ? "" : "/group";
export const groupHref = (path: string) => (path === "/" ? GROUP_BASE || "/" : `${GROUP_BASE}${path}`);
export const townSlug = (town: string) => town.toLowerCase();

/** One plain line per brand, shown on the business pages. Facts only: nothing here is a claim about quality or size. */
export const BRAND_NOTES: Record<string, string> = {
  "Akshaya Velli": "Our own jewellery house. Velli is the Tamil word for silver.",
  Zora: "Zora by Akshaya Velli, our newer jewellery label.",
  Tanishq: "Tanishq gold and diamond jewellery, a Titan Company brand, in a franchise showroom run by us.",
  "Mia by Tanishq": "Light, everyday jewellery from Tanishq.",
  CaratLane: "Diamond and gold jewellery from CaratLane, a Titan Company brand.",
  Titan: "Titan watches, in a franchise store run by us.",
  "Titan Eye+": "Spectacles, sunglasses and eye tests from Titan Eye+.",
  Fastrack: "Fastrack watches, bags and accessories.",
  "Balasanka TVS": "TVS motorcycles and scooters, with service and genuine spares.",
  "Shri Murugesan TVS": "TVS motorcycles and scooters, with service and genuine spares.",
  "Yasotha Motors": "Two-wheeler sales and service in Theni.",
  "Mukesh Honda": "Honda motorcycles and scooters, with service and genuine spares.",
  "Balasanka Cycle Bazar": "Bicycles and cycle accessories.",
};


/**
 * The brands sold at our showrooms, in the homepage's moving strip, in business order.
 * Shown as plain names until the official logo files from each brand's dealer kit are added (logo: "/brands/<file>").
 * Partner logos must be used as supplied: never recoloured or redrawn.
 */
export const BRAND_STRIP: { name: string; note: string; logo?: string }[] = [
  { name: "TVS", note: "Authorised dealer" },
  { name: "Honda", note: "Authorised dealer" },
  { name: "Balasanka Cycle Bazar", note: "Our own store" },
  { name: "Akshaya Velli", note: "Our own jewellery house" },
  { name: "Zora", note: "Our own label" },
  { name: "Tanishq", note: "Franchise store" },
  { name: "Mia by Tanishq", note: "Franchise store" },
  { name: "CaratLane", note: "Franchise store" },
  { name: "Titan", note: "Franchise store" },
  { name: "Fastrack", note: "Franchise store" },
  { name: "Titan Eye+", note: "Franchise store" },
];

export const SHOWROOM_GROUPS: ShowroomGroup[] = [
  {
    key: "vehicles", slug: "two-wheelers", title: "Two-wheelers and cycles", tamil: "இருசக்கர வாகனங்கள்",
    blurb: "TVS and Honda dealerships with sales, service and spares, and a cycle showroom in Theni.",
    showrooms: [
      { brand: "Balasanka TVS", town: "Sivakasi", company: "Balasanka Motor Private Ltd", street: "No 441 Virudhunagar Road", pin: "626123" },
      { brand: "Balasanka TVS", town: "Virudhunagar", company: "Balasanka Motor Private Ltd", street: "97/2 Katcheri Road", pin: "626001" },
      { brand: "Balasanka TVS", town: "Tenkasi", company: "Balasanka Automobiles LLP", street: "No 18 Housing Board Colony, Madurai Road", pin: "627811" },
      { brand: "Shri Murugesan TVS", town: "Theni", company: "Shri Murugesan Motor LLP", street: "W8/158 Rathinam Nagar, Periyakulam Road", pin: "625531" },
      { brand: "Yasotha Motors", town: "Theni", company: "Yasotha Motors", street: "336/2 Periyakulam Road, Unjampatti", pin: "625531" },
      { brand: "Mukesh Honda", town: "Rajapalayam", company: "Mukesh Motor", street: "1064/A Tenkasi Road, Near Cotton Market", pin: "626117" },
      { brand: "Mukesh Honda", town: "Sivakasi", company: "Mukesh Motor", street: "462/1 Virudhunagar Road, Thiruthangal", pin: "626130" },
      { brand: "Mukesh Honda", town: "Srivilliputhur", company: "Mukesh Motor", street: "61/2 61/3 61/4 Madurai Main Road, Ramakrishnapuram", pin: "626135" },
      { brand: "Balasanka Cycle Bazar", town: "Theni", company: "Balasanka Cycle Bazar", street: "No 339 Rathnam Nagar, Periyakulam Road", pin: "625531" },
    ],
  },
  {
    key: "jewellery", slug: "jewellery", title: "Jewellery", tamil: "நகைகள்",
    blurb: "Our own Akshaya Velli and Zora showrooms, and Tanishq, Mia by Tanishq and CaratLane stores.",
    showrooms: [
      { brand: "Akshaya Velli", town: "Theni", company: "Balasanka Akshaya Velli LLP", street: "No 441/2A Balasanka Plaza, Periyakulam Road", pin: "625531" },
      { brand: "Akshaya Velli", town: "Rajapalayam", company: "Balasanka Akshaya Velli LLP", street: "Madurai Road, Cotton Market", pin: "626117" },
      { brand: "Akshaya Velli", town: "Sivakasi", company: "Balasanka Akshaya Velli LLP", street: "200 B Tiruthangal Road", pin: "626123" },
      { brand: "Akshaya Velli", town: "Tenkasi", company: "Balasanka Akshaya Velli LLP", street: "No 154/42/20 Railway Road", pin: "627811" },
      { brand: "Akshaya Velli", town: "Tirunelveli", company: "Balasanka Akshaya Velli LLP", street: "167 Trivandrum Road, Murugankuruchi, Palayamkottai", pin: "627002" },
      { brand: "Zora", town: "Theni", company: "Balasanka Akshaya Velli LLP", street: "1396 Nehruji Road, Periyakulam Main Road", pin: "625531" },
      { brand: "Tanishq", town: "Theni", company: "Balasanka Jewellery LLP", street: "No 554/3 And 1693/2C Periyakulam Road", pin: "625531" },
      { brand: "Mia by Tanishq", town: "Madurai", company: "Balasanka Jewellery LLP", street: "11 Anna Salai 80 ft Road, Bye Pass Main Road, KK Nagar", pin: "625020" },
      { brand: "CaratLane", town: "Theni", company: "Balasanka Jewellery LLP", street: "No 1539/2 Nehruji Road, Periyakulam Main Road, opposite Municipal Office", pin: "625531" },
      { brand: "CaratLane", town: "Sivakasi", company: "Balasanka Jewellery LLP", street: "200 A Thiruthangal Main Road", pin: "626123" },
      { brand: "CaratLane", town: "Tirunelveli", company: "Balasanka Jewellery LLP", street: "166 Trivandrum Road, Palayamkottai, Murugankuruchi", pin: "627002" },
    ],
  },
  {
    key: "watches", slug: "watches-and-eyewear", title: "Watches and eyewear", tamil: "கடிகாரங்கள், கண்ணாடிகள்",
    blurb: "Titan, Fastrack and Titan Eye+ stores for watches, accessories and eye care.",
    showrooms: [
      { brand: "Titan", town: "Tenkasi", company: "Balasanka Jewellery LLP", street: "154/21 Railway Road", pin: "627811" },
      { brand: "Titan Eye+", town: "Tenkasi", company: "Balasanka Jewellery LLP", street: "154/21 Railway Road", pin: "627811" },
      { brand: "Fastrack", town: "Madurai", company: "Balasanka Jewellery LLP", street: "11 Anna Salai 80 ft Road, Bye Pass Main Road, KK Nagar", pin: "625020" },
    ],
  },
];

export const ALL_SHOWROOMS = SHOWROOM_GROUPS.flatMap((g) => g.showrooms);
export const TOWNS = [...new Set(ALL_SHOWROOMS.map((s) => s.town))].sort();

/** Brands in each business, in the order shown. */
export const brandsOf = (g: ShowroomGroup) => [...new Set(g.showrooms.map((s) => s.brand))];
/** The group's companies, named on store addresses. */
export const COMPANIES = [...new Set(ALL_SHOWROOMS.map((s) => s.company))].sort();

export const fullAddress = (s: Showroom) => `${s.street}, ${s.town}, Tamil Nadu ${s.pin}`;
export const mapLink = (s: Showroom) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.brand} ${fullAddress(s)}`)}`;

const ORG_ID = `${GROUP_SITE}/#org`;
const groupOf = (s: Showroom) => SHOWROOM_GROUPS.find((g) => g.showrooms.includes(s))!;
/** The closest schema.org shop type for each business, so search engines know what each showroom sells. */
const storeType = (s: Showroom) =>
  s.brand === "Balasanka Cycle Bazar" ? "BikeStore" : ({ vehicles: "MotorcycleDealer", jewellery: "JewelryStore" } as Record<string, string>)[groupOf(s).key] ?? "Store";

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
export function groupSchema() {
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
      email: CONTACT_EMAIL,
      foundingDate: "1966",
      foundingLocation: { "@type": "Place", name: "Theni, Tamil Nadu" },
      founder: { "@type": "Person", name: "S. Thirupathi Nadar" },
      areaServed: TOWNS.map((t) => ({ "@type": "City", name: t })),
      department: ALL_SHOWROOMS.map(storeSchema),
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
