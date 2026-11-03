import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BLOG_CATEGORIES, allPosts, findPost, showDate } from "@/lib/blog";
import { CAREERS_SITE, GROUP_SITE, breadcrumbSchema, groupHref, ldJson, pageMeta } from "@/lib/group";
import { LINK, WRAP } from "../../ui";
import { PostBody, PostList, PostMeta } from "../post-parts";

export const dynamicParams = false;
export const generateStaticParams = () => allPosts().map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = findPost((await params).slug);
  if (!p) return {};
  const meta = pageMeta(`${p.title} | Balasanka Group`, p.description, `/blog/${p.slug}`);
  return {
    ...meta,
    openGraph: { ...meta.openGraph, type: "article", publishedTime: p.date, modifiedTime: p.updated ?? p.date, section: BLOG_CATEGORIES[p.category].label },
  };
}

/** One post: title, meta line, body, then where to go next (a showroom page or the jobs) and two more posts. */
export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = findPost((await params).slug);
  if (!p) notFound();
  const cat = BLOG_CATEGORIES[p.category];
  const url = `${GROUP_SITE}/blog/${p.slug}`;
  const more = [...allPosts().filter((x) => x.slug !== p.slug && x.category === p.category), ...allPosts().filter((x) => x.category !== p.category)].slice(0, 2);
  const article = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: p.description,
    datePublished: p.date,
    dateModified: p.updated ?? p.date,
    inLanguage: "en-IN",
    articleSection: cat.label,
    url,
    mainEntityOfPage: url,
    image: `${GROUP_SITE}/icon-512.png`,
    author: { "@type": "Organization", "@id": `${GROUP_SITE}/#org`, name: "Balasanka Group of Companies", url: `${GROUP_SITE}/` },
    publisher: { "@type": "Organization", "@id": `${GROUP_SITE}/#org`, name: "Balasanka Group of Companies", logo: { "@type": "ImageObject", url: `${GROUP_SITE}/icon-512.png` } },
  };
  const next =
    cat.business ? { text: `See our ${cat.label.toLowerCase()} showrooms`, href: groupHref(`/${cat.business}`) }
    : p.category === "careers" ? { text: "See open jobs", href: `${CAREERS_SITE}/careers` }
    : { text: "Find a showroom near you", href: groupHref("/showrooms") };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([article, breadcrumbSchema([["Blog", "/blog"], [p.title, `/blog/${p.slug}`]])]) }} />
      <article className={`${WRAP} pb-14 pt-8 sm:pt-12`}>
        <nav aria-label="Breadcrumb" className="text-[15px] text-[#55516f]">
          <a href={groupHref("/blog")} className={LINK}>Blog</a>
        </nav>
        <h1 className="mt-4 max-w-[24ch] text-4xl font-semibold leading-tight text-[#2b2177] sm:text-5xl">{p.title}</h1>
        <p className="mt-4 max-w-[55ch] text-xl leading-relaxed text-[#4a4666]">{p.description}</p>
        <div className="mt-5"><PostMeta p={p} /></div>
        <div className="mt-8 border-t border-[#1b1640]/10 pt-2">
          <PostBody blocks={p.blocks} />
        </div>
        {p.updated && <p className="mt-10 text-[15px] text-[#55516f]">Last checked on {showDate(p.updated)}.</p>}
        <p className="mt-10">
          <a href={next.href} className="inline-flex h-12 items-center rounded-md bg-[#d9261c] px-7 text-lg font-semibold text-white hover:bg-[#b81f17]">{next.text}</a>
        </p>
      </article>
      {more.length > 0 && (
        <section aria-labelledby="h-more" className={`${WRAP} bg-[#f4f4f6] py-12 sm:py-16`}>
          <h2 id="h-more" className="text-2xl font-semibold sm:text-3xl">More from the blog</h2>
          <PostList posts={more} href={(s) => groupHref(`/blog/${s}`)} headingLevel={3} />
        </section>
      )}
    </>
  );
}
