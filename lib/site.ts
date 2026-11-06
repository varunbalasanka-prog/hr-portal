/**
 * The balasanka.in content model: what varun can edit on the Website page, and the checks it must pass.
 * No server or database code here, so the editor in the browser and the public pages share one set of rules.
 * Where the words come from (database or the defaults in lib/site-defaults.ts) is lib/site-data.ts.
 */

/** The three showroom businesses. Each has its own page, tint and drawing, so new ones need code, not the editor. */
export const BUSINESS_KEYS = ["vehicles", "jewellery", "watches"] as const;
export type BusinessKey = (typeof BUSINESS_KEYS)[number];
/** Page addresses stay fixed: search engines and printed links know them. */
export const BUSINESS_SLUGS: Record<BusinessKey, string> = { vehicles: "two-wheelers", jewellery: "jewellery", watches: "watches-and-eyewear" };
export const FOODS_KEY = "foods";
export const FOODS_SLUG = "dhal-and-tamarind";

export type Showroom = { id?: string; business: BusinessKey; brand: string; town: string; company: string; street: string; pin: string; phone?: string | null; sort?: number };
export type ShowroomGroup = { key: BusinessKey; slug: string; title: string; tamil: string; blurb: string; showrooms: Showroom[] };
export type BusinessText = { title: string; tamil: string; blurb: string };
export type BrandChip = { name: string; note: string; logo?: string };
export type StoryItem = { year: string; title: string; text: string };
export type ValueItem = { title: string; text: string };
/** The factory outlet families can visit. Empty fields are simply not shown. */
export type Outlet = { street: string; pin: string; hours: string; phone: string };
export type Foods = { title: string; tamil: string; blurb: string; products: string[]; brands: { name: string; note: string }[]; outlet: Outlet };

/** Everything on the site that is words, one entry per site_content key. */
export type SiteContent = {
  businesses: Record<BusinessKey, BusinessText>;
  brand_notes: Record<string, string>;
  brand_strip: BrandChip[];
  home: { intro: string; careers: string };
  about: { intro: string[]; story: StoryItem[]; values: ValueItem[] };
  contact: { email: string; write: string; visit: string; jobs: string };
  foods: Foods;
};
export type ContentKey = keyof SiteContent;
export const CONTENT_KEYS: ContentKey[] = ["businesses", "brand_notes", "brand_strip", "home", "about", "contact", "foods"];

export type Site = SiteContent & {
  showrooms: Showroom[];
  groups: ShowroomGroup[];
  all: Showroom[];
  towns: string[];
  companies: string[];
};

export const townSlug = (town: string) => town.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const listOf = (xs: string[]) => xs.join(", ").replace(/, ([^,]*)$/, " and $1");

/** The site as pages use it: showrooms grouped by business (in business order), towns and companies worked out. */
export function buildSite(content: SiteContent, showrooms: Showroom[]): Site {
  const sorted = [...showrooms].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const groups = BUSINESS_KEYS.map((key): ShowroomGroup => ({
    key, slug: BUSINESS_SLUGS[key], ...content.businesses[key], showrooms: sorted.filter((s) => s.business === key),
  }));
  const all = groups.flatMap((g) => g.showrooms);
  return {
    ...content,
    showrooms: sorted,
    groups,
    all,
    towns: [...new Set(all.map((s) => s.town))].sort(),
    companies: [...new Set(all.map((s) => s.company).filter(Boolean))].sort(),
  };
}

/** Words in the editor can say {showrooms}, {towns} or {town list}; the page fills in today's numbers. */
export const PLACEHOLDERS = ["{showrooms}", "{towns}", "{town list}"] as const;
export function fill(text: string, site: Pick<Site, "all" | "towns">) {
  return text
    .replaceAll("{showrooms}", String(site.all.length))
    .replaceAll("{towns}", String(site.towns.length))
    .replaceAll("{town list}", listOf(site.towns));
}

/**
 * A stored value laid over the default, so a missing or half-filled entry never breaks a page:
 * objects keep any field the stored one lacks, a list must be a list, words must be words.
 */
export function mergeContent(defaults: SiteContent, rows: { key: string; value: unknown }[]): SiteContent {
  const out = structuredClone(defaults) as Record<string, unknown>;
  for (const { key, value } of rows) {
    if (!(CONTENT_KEYS as string[]).includes(key)) continue;
    out[key] = overlay((defaults as Record<string, unknown>)[key], value);
  }
  return out as SiteContent;
}

function overlay(base: unknown, v: unknown): unknown {
  if (Array.isArray(base)) return Array.isArray(v) ? v : base;
  if (base && typeof base === "object") {
    if (!v || typeof v !== "object" || Array.isArray(v)) return base;
    const o: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, x] of Object.entries(v)) o[k] = k in o ? overlay(o[k], x) : x;
    return o;
  }
  if (typeof base === "string") return typeof v === "string" ? v : base;
  return v ?? base;
}

// ---- Checks (the same on both sides: the editor shows them, the server action enforces them) -------------

const PIN = /^[1-9][0-9]{5}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const POST_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const clean = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");

/**
 * An Indian phone number as its 10 digits (mobile, or landline with its STD code), or null if it isn't one.
 * Accepts the ways people write it: "98765 43210", "+91 98765-43210", "04546 252525", "091 4546 252525".
 */
export function phoneDigits(raw: unknown): string | null {
  let d = typeof raw === "string" ? raw.replace(/\D/g, "") : "";
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 13 && d.startsWith("091")) d = d.slice(3);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[2-9]\d{9}$/.test(d) ? d : null;
}
/** The number for a tap-to-call link and for Google: +91 and the 10 digits. */
export const telHref = (raw: string) => { const d = phoneDigits(raw); return d ? `tel:+91${d}` : null; };
/** A number written the usual way: mobiles as "98765 43210", landlines as typed (their STD code length varies). */
export function phoneText(raw: string) {
  const d = phoneDigits(raw);
  return d && /^[6-9]/.test(d) ? `${d.slice(0, 5)} ${d.slice(5)}` : clean(raw);
}

/** A showroom from the form, tidied, or what is wrong with it. */
export function checkShowroom(x: Partial<Showroom>): { ok: true; value: Showroom } | { ok: false; message: string } {
  const value: Showroom = {
    business: x.business as BusinessKey,
    brand: clean(x.brand), town: clean(x.town), company: clean(x.company), street: clean(x.street), pin: clean(x.pin).replace(/\s/g, ""),
    phone: clean(x.phone) || null,
    sort: Number.isFinite(x.sort) ? Math.round(x.sort!) : 0,
  };
  if (!BUSINESS_KEYS.includes(value.business)) return { ok: false, message: "Choose the business." };
  if (!value.brand) return { ok: false, message: "Brand is needed." };
  if (!value.town) return { ok: false, message: "Town is needed." };
  if (!/^[A-Za-z][A-Za-z .'-]*$/.test(value.town)) return { ok: false, message: "Write the town in English letters, like Theni." };
  if (!value.street) return { ok: false, message: "Street address is needed." };
  if (!PIN.test(value.pin)) return { ok: false, message: "PIN code must be 6 digits." };
  if (value.phone && (!phoneDigits(value.phone) || value.phone.length > 20)) return { ok: false, message: "Phone must be a 10-digit mobile, or a landline with its STD code (like 04546 252525)." };
  if (value.brand.length > 80 || value.town.length > 60 || value.company.length > 120 || value.street.length > 200) return { ok: false, message: "One of the fields is too long." };
  return { ok: true, value };
}

export const POST_CATEGORIES = {
  vehicles: "Two-wheelers",
  jewellery: "Jewellery",
  watches: "Watches and eyewear",
  foods: "Dhal and tamarind",
  story: "Our story",
  careers: "Careers",
} as const;
export type PostCategory = keyof typeof POST_CATEGORIES;
export type PostRow = {
  id?: string; slug: string; title: string; description: string; category: PostCategory; body: string;
  published_on: string; checked_on: string | null; status: "draft" | "published"; updated_at?: string;
};

/** "How to check a hallmark?" -> "how-to-check-a-hallmark" */
export const slugFromTitle = (t: string) => t.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");

export function checkPost(x: Partial<PostRow>): { ok: true; value: PostRow } | { ok: false; message: string } {
  const value: PostRow = {
    slug: clean(x.slug).toLowerCase(), title: clean(x.title), description: clean(x.description),
    category: x.category as PostCategory, body: typeof x.body === "string" ? x.body.replace(/\r\n/g, "\n").trim() : "",
    published_on: clean(x.published_on), checked_on: clean(x.checked_on) || null, status: x.status === "published" ? "published" : "draft",
  };
  if (!value.title) return { ok: false, message: "Title is needed." };
  if (value.title.length > 150) return { ok: false, message: "Title is too long (150 letters at most)." };
  if (!value.description) return { ok: false, message: "The one-line summary is needed. Google shows it under the title." };
  if (value.description.length > 300) return { ok: false, message: "Summary is too long (300 letters at most)." };
  if (!POST_SLUG.test(value.slug) || value.slug.length > 90) return { ok: false, message: "Web address must be small English letters and numbers joined by hyphens." };
  if (!(value.category in POST_CATEGORIES)) return { ok: false, message: "Choose a category." };
  if (!DATE.test(value.published_on)) return { ok: false, message: "Choose the post date." };
  if (value.checked_on && !DATE.test(value.checked_on)) return { ok: false, message: "The 'last checked' date is not a date." };
  if (value.status === "published" && value.body.split(/\s+/).filter(Boolean).length < 30) return { ok: false, message: "The post is too short to publish (30 words at least)." };
  if (value.body.length > 60000) return { ok: false, message: "The post is too long." };
  return { ok: true, value };
}

/** Checks one part of the site's words before it is saved. Returns a message for the first problem, or null. */
export function checkContent<K extends ContentKey>(key: K, v: SiteContent[K]): string | null {
  const words = (s: unknown, what: string, max = 600) => (typeof s !== "string" || !s.trim() ? `${what} is empty.` : s.length > max ? `${what} is too long.` : null);
  switch (key) {
    case "businesses": {
      const b = v as SiteContent["businesses"];
      for (const k of BUSINESS_KEYS) {
        const e = words(b[k]?.title, "A business title", 60) ?? words(b[k]?.blurb, "A business description", 400) ?? (typeof b[k]?.tamil === "string" ? null : "Tamil name is missing.");
        if (e) return e;
      }
      return null;
    }
    case "brand_notes": {
      for (const [brand, note] of Object.entries(v as Record<string, string>)) if (typeof note !== "string" || note.length > 300) return `The line for ${brand} is too long.`;
      return null;
    }
    case "brand_strip": {
      const list = v as BrandChip[];
      if (!Array.isArray(list) || list.length > 40) return "The brand strip can hold up to 40 brands.";
      for (const b of list) {
        const e = words(b.name, "A brand name", 40) ?? (typeof b.note === "string" && b.note.length <= 60 ? null : `The note under ${b.name} is too long.`);
        if (e) return e;
        if (b.logo && !/^https:\/\/[^\s"'<>]+$/.test(b.logo) && !/^\/[\w./-]+$/.test(b.logo)) return `The logo for ${b.name} is not a web address.`;
      }
      return null;
    }
    case "home": {
      const h = v as SiteContent["home"];
      return words(h.intro, "The homepage introduction") ?? words(h.careers, "The jobs box text");
    }
    case "about": {
      const a = v as SiteContent["about"];
      if (!a.intro?.length || a.intro.some((p) => words(p, "An introduction paragraph", 1000))) return "Each introduction paragraph needs words (1000 letters at most).";
      for (const s of a.story ?? []) { const e = words(s.year, "A story year", 20) ?? words(s.title, "A story title", 80) ?? words(s.text, "A story line", 600); if (e) return e; }
      for (const s of a.values ?? []) { const e = words(s.title, "A value title", 80) ?? words(s.text, "A value line", 600); if (e) return e; }
      return null;
    }
    case "contact": {
      const c = v as SiteContent["contact"];
      if (!EMAIL.test(c.email ?? "")) return "Email address is not valid.";
      return words(c.write, "The 'Write to us' line") ?? words(c.visit, "The 'Visit a showroom' line") ?? words(c.jobs, "The 'Find a job' line");
    }
    case "foods": {
      const f = v as SiteContent["foods"];
      const e = words(f.title, "The food business title", 60) ?? words(f.blurb, "The food business description", 400);
      if (e) return e;
      if (!f.products?.length || f.products.some((p) => !p.trim() || p.length > 60)) return "List at least one product (60 letters each at most).";
      for (const b of f.brands ?? []) { const x = words(b.name, "A food brand name", 40) ?? (b.note.length <= 200 ? null : `The line for ${b.name} is too long.`); if (x) return x; }
      const o = f.outlet;
      if (o) {
        if (o.street.length > 200 || o.hours.length > 120) return "The outlet address or hours are too long.";
        if (o.pin && !PIN.test(o.pin.trim())) return "Outlet PIN code must be 6 digits.";
        if (o.phone && !phoneDigits(o.phone)) return "Outlet phone must be a 10-digit mobile, or a landline with its STD code.";
      }
      return null;
    }
  }
  return null;
}
