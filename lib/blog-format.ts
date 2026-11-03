/**
 * The balasanka.in blog's format, shared by the public pages and the editor on the Website page (so no file or
 * database code here). A post's body is a small, safe subset of Markdown, see parseBody.
 */

export const BLOG_CATEGORIES = {
  vehicles: { label: "Two-wheelers", business: "two-wheelers" },
  jewellery: { label: "Jewellery", business: "jewellery" },
  watches: { label: "Watches and eyewear", business: "watches-and-eyewear" },
  story: { label: "Our story", business: null },
  careers: { label: "Careers", business: null },
} as const;
export type BlogCategory = keyof typeof BLOG_CATEGORIES;

/** Inline text: plain words, **bold** or a [link](href). */
export type Inline = { t: "text"; v: string } | { t: "bold"; v: string } | { t: "link"; v: string; href: string };
export type Block =
  | { t: "h2" | "h3"; text: string; id: string }
  | { t: "p" | "note"; parts: Inline[] }
  | { t: "ul" | "ol"; items: Inline[][] };

export type Post = {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  category: BlogCategory;
  blocks: Block[];
  minutes: number;
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const idOf = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** **bold** and [text](href) inside a line. Anything else stays as written. */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const m of line.matchAll(re)) {
    if (m.index! > last) out.push({ t: "text", v: line.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: "bold", v: m[1] });
    else out.push({ t: "link", v: m[2], href: m[3] });
    last = m.index! + m[0].length;
  }
  if (last < line.length) out.push({ t: "text", v: line.slice(last) });
  return out;
}

/** Blocks are separated by blank lines: "## " and "### " headings, "- " or "1. " lists, "> " notes, else a paragraph. */
export function parseBody(body: string): Block[] {
  return body
    .trim()
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): Block => {
      const lines = chunk.split("\n").map((l) => l.trim());
      const h = /^(#{2,3}) (.+)$/.exec(chunk);
      if (h && lines.length === 1) return { t: h[1].length === 2 ? "h2" : "h3", text: h[2], id: idOf(h[2]) };
      if (lines.every((l) => l.startsWith("- "))) return { t: "ul", items: lines.map((l) => parseInline(l.slice(2))) };
      if (lines.every((l) => /^\d+\. /.test(l))) return { t: "ol", items: lines.map((l) => parseInline(l.replace(/^\d+\. /, ""))) };
      if (lines.every((l) => l.startsWith(">"))) return { t: "note", parts: parseInline(lines.map((l) => l.replace(/^>\s?/, "")).join(" ")) };
      return { t: "p", parts: parseInline(lines.join(" ")) };
    });
}

/** One file's text into a post. Throws on a missing or wrong field so a broken post fails the build instead of going live. */
export function parsePost(slug: string, source: string): Post {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source.replace(/\r\n/g, "\n"));
  if (!m) throw new Error(`blog/${slug}.md: missing front matter`);
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].replace(/^"(.*)"$/, "$1");
  }
  const need = (k: string) => {
    if (!meta[k]) throw new Error(`blog/${slug}.md: missing ${k}`);
    return meta[k];
  };
  if (!SLUG.test(slug)) throw new Error(`blog/${slug}.md: file name must be lowercase words joined by hyphens`);
  const date = need("date");
  if (!DATE.test(date) || (meta.updated && !DATE.test(meta.updated))) throw new Error(`blog/${slug}.md: dates must be YYYY-MM-DD`);
  const category = need("category");
  if (!(category in BLOG_CATEGORIES)) throw new Error(`blog/${slug}.md: unknown category ${category}`);
  const words = m[2].split(/\s+/).filter(Boolean).length;
  return {
    slug,
    title: need("title"),
    description: need("description"),
    date,
    updated: meta.updated || undefined,
    category: category as BlogCategory,
    blocks: parseBody(m[2]),
    minutes: Math.max(1, Math.round(words / 200)),
  };
}

/** "3 November 2026" */
export const showDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** A link in a post may go to our own pages, a web page, an email or a phone number; anything else becomes plain text. */
export const safeHref = (href: string) => (/^(\/(?!\/)|https?:\/\/|mailto:|tel:)/i.test(href) ? href : null);

/** A row from the site_posts table as a post. */
export function postFromRow(r: { slug: string; title: string; description: string; category: string; body: string; published_on: string; checked_on?: string | null }): Post {
  const words = r.body.split(/\s+/).filter(Boolean).length;
  return {
    slug: r.slug,
    title: r.title,
    description: r.description,
    date: r.published_on,
    updated: r.checked_on || undefined,
    category: (r.category in BLOG_CATEGORIES ? r.category : "story") as BlogCategory,
    blocks: parseBody(r.body),
    minutes: Math.max(1, Math.round(words / 200)),
  };
}

/** Newest first, then by title. */
export const byDate = (a: Post, b: Post) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
