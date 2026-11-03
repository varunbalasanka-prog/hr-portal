import type { Metadata } from "next";
import { allPosts } from "@/lib/blog";
import { breadcrumbSchema, groupHref, ldJson, pageMeta } from "@/lib/group";
import { WRAP } from "../ui";
import { PostList } from "./post-parts";

export const metadata: Metadata = pageMeta(
  "Blog | Balasanka Group",
  "Practical guides from the Balasanka Group showrooms in South Tamil Nadu: two-wheelers, jewellery, watches, eye care, our story and careers.",
  "/blog",
);

/** Every post, newest first. */
export default function BlogPage() {
  const posts = allPosts();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(breadcrumbSchema([["Blog", "/blog"]])) }} />
      <section className={`${WRAP} pb-6 pt-10 sm:pt-14`}>
        <h1 className="text-4xl font-semibold leading-tight text-[#2b2177] sm:text-5xl">Blog</h1>
        <p className="mt-4 max-w-[48ch] text-lg leading-relaxed text-[#4a4666]">
          Plain answers to the questions our showroom teams hear every day, and a little about who we are.
        </p>
      </section>
      <section className={`${WRAP} pb-16 sm:pb-24`}>
        {posts.length ? <PostList posts={posts} href={(s) => groupHref(`/blog/${s}`)} /> : <p className="py-6 text-lg">The first posts are on their way.</p>}
      </section>
    </>
  );
}
