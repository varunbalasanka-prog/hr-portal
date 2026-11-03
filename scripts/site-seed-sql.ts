/**
 * Writes the "starting content" part of supabase/migrations/0029_website_content.sql from today's site
 * (lib/site-defaults.ts and content/blog/*.md), so the database starts exactly where the code was.
 * Run: npx tsx scripts/site-seed-sql.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_CONTENT, DEFAULT_SHOWROOMS } from "../lib/site-defaults";
import { parsePost } from "../lib/blog-format";

// Dollar quoting with a tag the text never contains, so nothing needs escaping.
const q = (s: string | null | undefined) => {
  if (s == null) return "null";
  let tag = "s";
  while (s.includes("$" + tag + "$")) tag += "x";
  return "$" + tag + "$" + s + "$" + tag + "$";
};

const out: string[] = [];
out.push("insert into site_content (key, value)");
out.push("select k, v::jsonb from (values");
out.push(Object.entries(DEFAULT_CONTENT).map(([k, v]) => `  (${q(k)}, ${q(JSON.stringify(v))})`).join(",\n"));
out.push(") as t(k, v)\non conflict (key) do nothing;\n");

out.push("insert into site_showrooms (business, brand, town, company, street, pin, sort)");
out.push("select * from (values");
out.push(DEFAULT_SHOWROOMS.map((s) => `  (${q(s.business)}, ${q(s.brand)}, ${q(s.town)}, ${q(s.company)}, ${q(s.street)}, ${q(s.pin)}, ${s.sort})`).join(",\n"));
out.push(") as t(business, brand, town, company, street, pin, sort)\nwhere not exists (select 1 from site_showrooms);\n");

const dir = path.join(process.cwd(), "content", "blog");
const files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
out.push("insert into site_posts (slug, title, description, category, body, published_on, checked_on, status)");
out.push("select slug, title, description, category, body, published_on::date, checked_on::date, 'published' from (values");
out.push(files.map((f) => {
  const src = readFileSync(path.join(dir, f), "utf8").replace(/\r\n/g, "\n");
  const p = parsePost(f.slice(0, -3), src);
  const body = src.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
  return `  (${q(p.slug)}, ${q(p.title)}, ${q(p.description)}, ${q(p.category)}, ${q(body)}, ${q(p.date)}, ${q(p.updated ?? null)})`;
}).join(",\n"));
out.push(") as t(slug, title, description, category, body, published_on, checked_on)\nwhere not exists (select 1 from site_posts)\non conflict (slug) do nothing;");

console.log(out.join("\n"));
