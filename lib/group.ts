/**
 * The company homepage (balasanka.in). Showroom list copied from the branches table on 29 Oct 2026;
 * update it here when a showroom opens, closes or moves.
 */
export const GROUP_SITE = "https://balasanka.in";
export const CAREERS_SITE = "https://hr.balasanka.in";
export const CONTACT_EMAIL = "support@balasanka.in";

export type Showroom = { brand: string; town: string; company: string; street: string; pin: string };
export type Photo = { src: string; alt: string; credit: string };
export type ShowroomGroup = { key: string; title: string; tamil: string; blurb: string; photo: Photo; showrooms: Showroom[] };

/** Unsplash License photos (free for commercial use). Swap for our own showroom photos when we have them. */
const unsplash = (id: string, w: number) => `https://images.unsplash.com/${id}?auto=format&fit=crop&q=70&w=${w}`;
export const HERO_PHOTO: Photo = { src: unsplash("photo-1600685890506-593fdf55949b", 1400), alt: "A bride in traditional red attire wearing ornate gold jewellery", credit: "Aayush Rawat / Unsplash" };

export const SHOWROOM_GROUPS: ShowroomGroup[] = [
  {
    key: "jewellery", title: "Jewellery", tamil: "நகைகள்",
    photo: { src: unsplash("photo-1721807644561-9efcabee5c42", 800), alt: "Gold jewellery laid out on a table", credit: "Prahant Studio / Unsplash" },
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
    key: "watches", title: "Watches and eyewear", tamil: "கடிகாரங்கள், கண்ணாடிகள்",
    photo: { src: unsplash("photo-1772638904164-eed7c6b1e57e", 800), alt: "A wristwatch on a dark background", credit: "Puneet Kaul / Unsplash" },
    blurb: "Titan, Fastrack and Titan Eye+ stores for watches, accessories and eye care.",
    showrooms: [
      { brand: "Titan", town: "Tenkasi", company: "Balasanka Jewellery LLP", street: "154/21 Railway Road", pin: "627811" },
      { brand: "Titan Eye+", town: "Tenkasi", company: "Balasanka Jewellery LLP", street: "154/21 Railway Road", pin: "627811" },
      { brand: "Fastrack", town: "Madurai", company: "Balasanka Jewellery LLP", street: "11 Anna Salai 80 ft Road, Bye Pass Main Road, KK Nagar", pin: "625020" },
    ],
  },
  {
    key: "vehicles", title: "Two-wheelers and cycles", tamil: "இருசக்கர வாகனங்கள்",
    photo: { src: unsplash("photo-1790919358336-d20ad9808553", 800), alt: "Honda motorcycles in a showroom", credit: "Shubham Rohilla / Unsplash" },
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
];

export const ALL_SHOWROOMS = SHOWROOM_GROUPS.flatMap((g) => g.showrooms);
export const TOWNS = [...new Set(ALL_SHOWROOMS.map((s) => s.town))].sort();

/** Brands in each business, in the order shown. */
export const brandsOf = (g: ShowroomGroup) => [...new Set(g.showrooms.map((s) => s.brand))];
/** The group's companies, named on store addresses. */
export const COMPANIES = [...new Set(ALL_SHOWROOMS.map((s) => s.company))].sort();

export const fullAddress = (s: Showroom) => `${s.street}, ${s.town}, Tamil Nadu ${s.pin}`;
export const mapLink = (s: Showroom) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.brand} ${fullAddress(s)}`)}`;

/** schema.org Organization with each showroom as a Store, so search engines can show the group and its addresses. */
export function groupSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Balasanka Group of Companies",
    alternateName: ["Balasanka Group", "பாலசங்கா குழுமம்"],
    url: `${GROUP_SITE}/`,
    logo: `${GROUP_SITE}/balasanka_logo.png`,
    email: CONTACT_EMAIL,
    department: ALL_SHOWROOMS.map((s) => ({
      "@type": "Store",
      name: `${s.brand}, ${s.town}`,
      address: { "@type": "PostalAddress", streetAddress: s.street, addressLocality: s.town, addressRegion: "Tamil Nadu", postalCode: s.pin, addressCountry: "IN" },
    })),
  };
}
