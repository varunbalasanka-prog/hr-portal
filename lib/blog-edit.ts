/**
 * The bridge between the blog's visual editor (Website > Blog) and how a post is stored.
 * Posts are still stored as the small Markdown subset in blog-format.ts, so the public pages and the six older
 * posts don't change. The editor shows them as normal formatted text: markdown -> blocks -> HTML to open a post,
 * and the editor's HTML -> blocks -> markdown to save it. Anything the editor can't store (colours, pictures,
 * tables, pasted styling) is dropped, so what is in the box is what goes on the site.
 */
import { safeHref, type Block, type Inline } from "./blog-format";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Joins neighbouring pieces of the same kind and squeezes spaces, so a save never adds stray symbols. */
function tidy(parts: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const p of parts) {
    const v = p.v.replace(/\s+/g, " ");
    if (!v) continue;
    const last = out.at(-1);
    if (last && last.t === p.t && p.t !== "link") last.v += v;
    else out.push({ ...p, v });
  }
  if (out[0]) out[0].v = out[0].v.trimStart();
  if (out.at(-1)) out.at(-1)!.v = out.at(-1)!.v.trimEnd();
  return out.filter((p) => p.v);
}

/** Markdown for one line of text. Spaces at the edge of bold words move outside the stars. */
function inlineMd(parts: Inline[]): string {
  return tidy(parts)
    .map((p) => {
      if (p.t === "text") return p.v;
      const lead = /^\s*/.exec(p.v)![0];
      const trail = /\s*$/.exec(p.v)![0];
      const core = p.v.trim();
      if (!core) return p.v;
      if (p.t === "bold") return `${lead}**${core.replace(/\*\*/g, "*")}**${trail}`;
      return `${lead}[${core.replace(/[[\]]/g, "")}](${p.href.replace(/\s/g, "%20").replace(/\)/g, "%29")})${trail}`;
    })
    .join("");
}

/**
 * A paragraph whose first words look like a heading, list or note mark ("1. ", "- ", "> ", "## ") would come back as
 * one. Typed in the editor, that is never meant, so the mark is softened: "1. " to "1 ", "- " to "– ".
 */
const safeStart = (line: string) =>
  line.replace(/^(#{2,3}) /, "$1").replace(/^- /, "– ").replace(/^(\d+)\. /, "$1 ").replace(/^>/, "› ");

export function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.t) {
        case "h2": return `## ${b.text.trim()}`;
        case "h3": return `### ${b.text.trim()}`;
        case "p": return safeStart(inlineMd(b.parts));
        case "note": return `> ${inlineMd(b.parts)}`;
        case "ul": return b.items.map((it) => `- ${inlineMd(it)}`).join("\n");
        case "ol": return b.items.map((it, i) => `${i + 1}. ${inlineMd(it)}`).join("\n");
      }
    })
    .filter((s) => s.replace(/^(#{2,3}|-|\d+\.|>)\s*/gm, "").trim())
    .join("\n\n");
}

function inlineHtml(parts: Inline[]): string {
  return parts
    .map((p) => (p.t === "bold" ? `<strong>${esc(p.v)}</strong>` : p.t === "link" && safeHref(p.href) ? `<a href="${esc(p.href)}">${esc(p.v)}</a>` : esc(p.v)))
    .join("");
}

/** What the editor shows when a post is opened. */
export function blocksToHtml(blocks: Block[]): string {
  if (!blocks.length) return "<p><br></p>";
  return blocks
    .map((b) => {
      switch (b.t) {
        case "h2": case "h3": return `<${b.t}>${esc(b.text)}</${b.t}>`;
        case "p": return `<p>${inlineHtml(b.parts)}</p>`;
        case "note": return `<blockquote><p>${inlineHtml(b.parts)}</p></blockquote>`;
        case "ul": case "ol": return `<${b.t}>${b.items.map((it) => `<li>${inlineHtml(it)}</li>`).join("")}</${b.t}>`;
      }
    })
    .join("");
}

/**
 * What someone types in the link box, as a link the site accepts: "balasanka.in/jewellery" or "www.bis.gov.in"
 * get https://, "/about" stays one of our pages, an email gets mailto:. Null when it can't be a link.
 */
export function fixHref(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^(balasanka\.in|www\.balasanka\.in)(\/|$)/i.test(s)) return s.replace(/^(www\.)?balasanka\.in/i, "") || "/";
  if (/^[^\s@/]+@[^\s@/]+\.[a-z]{2,}$/i.test(s)) return `mailto:${s}`;
  if (/^\+?[\d\s-]{8,}$/.test(s)) return `tel:${s.replace(/[\s-]/g, "")}`;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s)) return `https://${s}`;
  return /\s/.test(s) ? null : safeHref(s);
}

// ---- The editor's HTML back into blocks (runs in the browser only) ----

const BLOCK = /^(P|DIV|H[1-6]|UL|OL|LI|BLOCKQUOTE|SECTION|ARTICLE|HEADER|FOOTER|PRE|TABLE|TR|FIGURE)$/;

function inlineOf(node: Node, bold = false, out: Inline[] = []): Inline[] {
  if (node.nodeType === 3) {
    out.push(bold ? { t: "bold", v: node.textContent ?? "" } : { t: "text", v: node.textContent ?? "" });
    return out;
  }
  if (node.nodeType !== 1) return out;
  const el = node as HTMLElement;
  if (el.tagName === "BR") { out.push({ t: "text", v: " " }); return out; }
  if (el.tagName === "A" && el.getAttribute("href") && safeHref(el.getAttribute("href")!)) {
    out.push({ t: "link", v: el.textContent ?? "", href: el.getAttribute("href")! });
    return out;
  }
  const isBold = bold || el.tagName === "B" || el.tagName === "STRONG" || /^(bold|[6-9]00)$/.test(el.style?.fontWeight ?? "");
  el.childNodes.forEach((c) => inlineOf(c, isBold, out));
  if (BLOCK.test(el.tagName)) out.push({ t: "text", v: " " });
  return out;
}

const textOf = (el: Node) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

/** The editor's content as the blocks a post is made of. */
export function htmlToBlocks(root: HTMLElement): Block[] {
  const blocks: Block[] = [];
  let loose: Inline[] = [];
  const flush = () => {
    const parts = tidy(loose);
    if (parts.length) blocks.push({ t: "p", parts });
    loose = [];
  };
  const listItems = (el: Element): Inline[][] => {
    const items: Inline[][] = [];
    el.querySelectorAll(":scope > li").forEach((li) => {
      const own: Inline[] = [];
      li.childNodes.forEach((c) => { if (!(c.nodeType === 1 && /^(UL|OL)$/.test((c as Element).tagName))) inlineOf(c, false, own); });
      if (tidy(own).length) items.push(tidy(own));
      li.querySelectorAll(":scope > ul, :scope > ol").forEach((sub) => items.push(...listItems(sub)));
    });
    return items;
  };
  const walk = (parent: Node) => {
    parent.childNodes.forEach((node) => {
      const el = node as HTMLElement;
      if (node.nodeType !== 1 || !BLOCK.test(el.tagName)) return void inlineOf(node, false, loose);
      flush();
      const tag = el.tagName;
      if (/^H[1-6]$/.test(tag)) {
        const text = textOf(el);
        if (text) blocks.push({ t: tag === "H1" || tag === "H2" ? "h2" : "h3", text, id: "" });
      } else if (tag === "UL" || tag === "OL") {
        const items = listItems(el);
        if (items.length) blocks.push({ t: tag === "UL" ? "ul" : "ol", items });
      } else if (tag === "BLOCKQUOTE") {
        const parts = tidy(inlineOf(el));
        if (parts.length) blocks.push({ t: "note", parts });
      } else if ([...el.children].some((c) => BLOCK.test(c.tagName))) {
        walk(el);
      } else {
        const parts = tidy(inlineOf(el));
        if (parts.length) blocks.push({ t: "p", parts });
      }
    });
    flush();
  };
  walk(root);
  return blocks;
}
