import { BLOG_CATEGORIES, safeHref, showDate, type Block, type Inline, type Post } from "@/lib/blog-format";
import { groupHref } from "@/lib/group";
import { LINK } from "../style";

/** Inline text. Links to other sites open in a new tab; our own ("/about") stay in place and work on previews too. */
function Text({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.t === "bold" ? <strong key={i} className="font-semibold">{p.v}</strong>
        : p.t === "link" && safeHref(p.href) ? (
          <a key={i} href={p.href.startsWith("/") ? groupHref(p.href) : p.href} className={LINK} {...(/^https?:/.test(p.href) ? { target: "_blank", rel: "noopener" } : {})}>{p.v}</a>
        )
        : <span key={i}>{p.v}</span>)}
    </>
  );
}

/** A post's body in one readable column (about 65 characters a line). */
export function PostBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="max-w-[65ch] text-[18px] leading-[1.75] text-[#2a2550]">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h2": return <h2 key={i} id={b.id} className="mt-12 text-2xl font-semibold leading-snug text-[#1b1640] sm:text-[1.75rem]">{b.text}</h2>;
          case "h3": return <h3 key={i} id={b.id} className="mt-8 text-xl font-semibold text-[#1b1640]">{b.text}</h3>;
          case "p": return <p key={i} className="mt-5"><Text parts={b.parts} /></p>;
          case "note": return <p key={i} className="mt-6 rounded-lg bg-[#f4f4f6] px-5 py-4 text-[17px] text-[#3d3866]"><Text parts={b.parts} /></p>;
          case "ul": return <ul key={i} className="mt-5 list-disc space-y-2 pl-6 marker:text-[#d9261c]">{b.items.map((it, j) => <li key={j}><Text parts={it} /></li>)}</ul>;
          case "ol": return <ol key={i} className="mt-5 list-decimal space-y-2 pl-6 marker:font-semibold marker:text-[#2b2177]">{b.items.map((it, j) => <li key={j}><Text parts={it} /></li>)}</ol>;
        }
      })}
    </div>
  );
}

/** Category, date and reading time on one quiet line. */
export function PostMeta({ p }: { p: Post }) {
  return (
    <p className="text-[15px] text-[#55516f]">
      {BLOG_CATEGORIES[p.category].label} · <time dateTime={p.date}>{showDate(p.date)}</time> · {p.minutes} min read
    </p>
  );
}

/** A list of posts as plain rows: title, one line, meta. */
export function PostList({ posts, href, headingLevel = 2 }: { posts: Post[]; href: (slug: string) => string; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <ul className="divide-y divide-[#1b1640]/10">
      {posts.map((p) => (
        <li key={p.slug} data-reveal className="py-6">
          <H className="text-xl font-semibold leading-snug sm:text-2xl">
            <a href={href(p.slug)} className="hover:underline">{p.title}</a>
          </H>
          <p className="mt-2 max-w-[60ch] text-lg leading-relaxed text-[#4a4666]">{p.description}</p>
          <div className="mt-2"><PostMeta p={p} /></div>
        </li>
      ))}
    </ul>
  );
}
