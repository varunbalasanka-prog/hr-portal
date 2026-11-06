import { StaffPage } from "@/components/staff-page";
import { requireSuperAdmin } from "@/lib/auth";
import { mergeContent, type PostRow, type Showroom } from "@/lib/site";
import { DEFAULT_CONTENT, DEFAULT_SHOWROOMS } from "@/lib/site-defaults";
import { WebsiteEditor } from "./editor";

export const dynamic = "force-dynamic";

/** Edit balasanka.in: showrooms, blog posts and the words on its pages. Only the superadmin login can open it or save. */
export default async function WebsitePage() {
  const { supabase, profile } = await requireSuperAdmin();
  const [content, showrooms, posts] = await Promise.all([
    supabase.from("site_content").select("key, value"),
    supabase.from("site_showrooms").select("*").order("sort"),
    supabase.from("site_posts").select("id, slug, title, description, category, body, published_on, checked_on, status, updated_at").order("published_on", { ascending: false }),
  ]);
  const ready = !content.error && !showrooms.error && !posts.error;
  const viewBase = process.env.VERCEL_ENV === "production" ? "https://balasanka.in" : "/group";
  return (
    <StaffPage me={profile} active="website" title="Website (balasanka.in)"
      subtitle="Showrooms, blog posts and the words on the company website. Saved changes are live straight away."
      actions={<a className="btn-outline" href={viewBase} target="_blank" rel="noopener">Open balasanka.in ↗</a>}>
      {!ready && (
        <div role="alert" className="mx-4 mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200 sm:mx-6">
          <b>One step left:</b> run <code>0029_website_content.sql</code> in the Supabase SQL editor. Until then you can look around, but saving is off and the site keeps showing its current words.
        </div>
      )}
      <WebsiteEditor ready={ready} viewBase={viewBase}
        content={mergeContent(DEFAULT_CONTENT, content.data ?? [])}
        showrooms={ready ? (showrooms.data as Showroom[]) : DEFAULT_SHOWROOMS}
        posts={ready ? (posts.data as PostRow[]) : []} />
    </StaffPage>
  );
}
