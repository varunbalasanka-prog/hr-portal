import type { Showroom, SiteContent } from "./site";

/**
 * balasanka.in as it was on 3 Nov 2026, before the Website editor. The site shows these words until 0029 has been
 * run (it seeds the database with the same values), and fills any part the database is missing from here.
 * Edit the live site on the Website page, not here.
 */

/** Showroom list copied from the branches table on 29 Oct 2026, in business order. */
export const DEFAULT_SHOWROOMS: Showroom[] = [
  { business: "vehicles", brand: "Balasanka TVS", town: "Sivakasi", company: "Balasanka Motor Private Ltd", street: "No 441 Virudhunagar Road", pin: "626123" },
  { business: "vehicles", brand: "Balasanka TVS", town: "Virudhunagar", company: "Balasanka Motor Private Ltd", street: "97/2 Katcheri Road", pin: "626001" },
  { business: "vehicles", brand: "Balasanka TVS", town: "Tenkasi", company: "Balasanka Automobiles LLP", street: "No 18 Housing Board Colony, Madurai Road", pin: "627811" },
  { business: "vehicles", brand: "Shri Murugesan TVS", town: "Theni", company: "Shri Murugesan Motor LLP", street: "W8/158 Rathinam Nagar, Periyakulam Road", pin: "625531" },
  { business: "vehicles", brand: "Yasotha Motors", town: "Theni", company: "Yasotha Motors", street: "336/2 Periyakulam Road, Unjampatti", pin: "625531" },
  { business: "vehicles", brand: "Mukesh Honda", town: "Rajapalayam", company: "Mukesh Motor", street: "1064/A Tenkasi Road, Near Cotton Market", pin: "626117" },
  { business: "vehicles", brand: "Mukesh Honda", town: "Sivakasi", company: "Mukesh Motor", street: "462/1 Virudhunagar Road, Thiruthangal", pin: "626130" },
  { business: "vehicles", brand: "Mukesh Honda", town: "Srivilliputhur", company: "Mukesh Motor", street: "61/2 61/3 61/4 Madurai Main Road, Ramakrishnapuram", pin: "626135" },
  { business: "vehicles", brand: "Balasanka Cycle Bazar", town: "Theni", company: "Balasanka Cycle Bazar", street: "No 339 Rathnam Nagar, Periyakulam Road", pin: "625531" },
  { business: "jewellery", brand: "Akshaya Velli", town: "Theni", company: "Balasanka Akshaya Velli LLP", street: "No 441/2A Balasanka Plaza, Periyakulam Road", pin: "625531" },
  { business: "jewellery", brand: "Akshaya Velli", town: "Rajapalayam", company: "Balasanka Akshaya Velli LLP", street: "Madurai Road, Cotton Market", pin: "626117" },
  { business: "jewellery", brand: "Akshaya Velli", town: "Sivakasi", company: "Balasanka Akshaya Velli LLP", street: "200 B Tiruthangal Road", pin: "626123" },
  { business: "jewellery", brand: "Akshaya Velli", town: "Tenkasi", company: "Balasanka Akshaya Velli LLP", street: "No 154/42/20 Railway Road", pin: "627811" },
  { business: "jewellery", brand: "Akshaya Velli", town: "Tirunelveli", company: "Balasanka Akshaya Velli LLP", street: "167 Trivandrum Road, Murugankuruchi, Palayamkottai", pin: "627002" },
  { business: "jewellery", brand: "Zora", town: "Theni", company: "Balasanka Akshaya Velli LLP", street: "1396 Nehruji Road, Periyakulam Main Road", pin: "625531" },
  { business: "jewellery", brand: "Tanishq", town: "Theni", company: "Balasanka Jewellery LLP", street: "No 554/3 And 1693/2C Periyakulam Road", pin: "625531" },
  { business: "jewellery", brand: "Mia by Tanishq", town: "Madurai", company: "Balasanka Jewellery LLP", street: "11 Anna Salai 80 ft Road, Bye Pass Main Road, KK Nagar", pin: "625020" },
  { business: "jewellery", brand: "CaratLane", town: "Theni", company: "Balasanka Jewellery LLP", street: "No 1539/2 Nehruji Road, Periyakulam Main Road, opposite Municipal Office", pin: "625531" },
  { business: "jewellery", brand: "CaratLane", town: "Sivakasi", company: "Balasanka Jewellery LLP", street: "200 A Thiruthangal Main Road", pin: "626123" },
  { business: "jewellery", brand: "CaratLane", town: "Tirunelveli", company: "Balasanka Jewellery LLP", street: "166 Trivandrum Road, Palayamkottai, Murugankuruchi", pin: "627002" },
  { business: "watches", brand: "Titan", town: "Tenkasi", company: "Balasanka Jewellery LLP", street: "154/21 Railway Road", pin: "627811" },
  { business: "watches", brand: "Titan Eye+", town: "Tenkasi", company: "Balasanka Jewellery LLP", street: "154/21 Railway Road", pin: "627811" },
  { business: "watches", brand: "Fastrack", town: "Madurai", company: "Balasanka Jewellery LLP", street: "11 Anna Salai 80 ft Road, Bye Pass Main Road, KK Nagar", pin: "625020" },
].map((s, i) => ({ ...s, business: s.business as Showroom["business"], sort: (i + 1) * 10 }));

const STORY: SiteContent["about"]["story"] = [
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

const VALUES: SiteContent["about"]["values"] = [
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
    text: "Every showroom is in South Tamil Nadu, within a few hours of Theni, where the group began.",
  },
];

export const DEFAULT_CONTENT: SiteContent = {
  businesses: {
    vehicles: { title: "Two-wheelers and cycles", tamil: "இருசக்கர வாகனங்கள்", blurb: "TVS and Honda dealerships with sales, service and spares, and a cycle showroom in Theni." },
    jewellery: { title: "Jewellery", tamil: "நகைகள்", blurb: "Our own Akshaya Velli showrooms and its luxury line Zora, and Tanishq, Mia by Tanishq and CaratLane stores." },
    watches: { title: "Watches and eyewear", tamil: "கடிகாரங்கள், கண்ணாடிகள்", blurb: "Titan, Fastrack and Titan Eye+ stores for watches, accessories and eye care." },
  },
  /** One plain line per brand, shown on the business pages. Facts only: nothing here is a claim about quality or size. */
  brand_notes: {
  "Akshaya Velli": "Our own jewellery house. Velli is the Tamil word for silver.",
  Zora: "Zora by Akshaya Velli, its more luxurious line: silver jewellery, silver gifts and pooja articles.",
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
},
  /**
   * The homepage's moving strip, in business order. Shown as plain names until the official logo files from each
   * brand's dealer kit are uploaded. Partner logos must be used as supplied: never recoloured or redrawn.
   */
  brand_strip: [
  { name: "TVS", note: "Authorised dealer" },
  { name: "Honda", note: "Authorised dealer" },
  { name: "Balasanka Cycle Bazar", note: "Our own store" },
  { name: "Akshaya Velli", note: "Our own jewellery house" },
  { name: "Zora", note: "Akshaya Velli's luxury line" },
  { name: "Tanishq", note: "Franchise store" },
  { name: "Mia by Tanishq", note: "Franchise store" },
  { name: "CaratLane", note: "Franchise store" },
  { name: "Titan", note: "Franchise store" },
  { name: "Fastrack", note: "Franchise store" },
  { name: "Titan Eye+", note: "Franchise store" },
  { name: "Akshaya Dhal", note: "Our own brand" },
],
  home: {
    intro: "Two-wheelers, jewellery, watches and eyewear at {showrooms} showrooms in {towns} towns of South Tamil Nadu, from Theni to Tirunelveli, and Akshaya Dhal dhal and seedless tamarind from our factories in Theni. A Theni family business since 1966.",
    careers: "We hire for sales, service, accounts and customer care at our showrooms, and freshers are welcome. Apply online in about five minutes.",
  },
  /**
   * The group's story: a short pick from varun's own timeline (2 Nov 2026), which wins over the research PDF.
   * Left out on purpose: Bombay Dyeing, turnover, leadership names and businesses outside the showroom list.
   */
  about: {
    intro: [
      "Balasanka Group began in Theni in 1966 as a small tamarind processing unit. Sixty years later, the same family runs two-wheeler dealerships, jewellery houses and lifestyle stores across {town list}, and still makes dhal and seedless tamarind at its factories in Theni.",
      "Our own brands are Akshaya Dhal, for dhal and seedless tamarind, and the jewellery house Akshaya Velli with its luxury line Zora. We run them alongside dealerships and franchise stores for TVS, Honda, Tanishq, Mia by Tanishq, CaratLane, Titan, Titan Eye+ and Fastrack.",
    ],
    story: STORY,
    values: VALUES,
  },
  contact: {
    email: "support@balasanka.in",
    write: "For questions about the group, our companies or working with us as a brand partner.",
    visit: "For a purchase, an order or a service booking, the showroom near you can help directly.",
    jobs: "Every open job at our showrooms, with an online application that takes about five minutes.",
  },
  /**
   * The food business (varun, 3 Nov 2026): dhal and seedless tamarind from the group's factory in Theni,
   * sold wholesale to shops and traders and at the factory outlet. Sri Balasanka Mills is no longer running.
   * No chana dhal and no plain (with-seed) tamarind.
   */
  foods: {
  title: "Dhal and tamarind",
  tamil: "பருப்பு, புளி",
  blurb: "Akshaya Dhal toor, urad and moong dhal and seedless tamarind, made at our factories in Theni for shops, traders and families.",
  products: ["Toor dhal", "Urad dhal", "Moong dhal", "Seedless tamarind"],
  brands: [
    { name: "Akshaya Dhal", note: "Our brand for every dhal and our seedless tamarind." },
    { name: "Balasanka Dhal", note: "Our first pulses factory in Theni, since 1991." },
    { name: "Sanka Dhal", note: "Our second factory in Theni, since 1995." },
  ],
},
};
