"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { SITE_TAG } from "@/lib/site-tag";
import { CONTENT_KEYS, checkContent, checkPost, checkShowroom, type ContentKey, type PostRow, type Showroom, type SiteContent } from "@/lib/site";

type Result = { ok: boolean; message: string; id?: string; url?: string };

/** balasanka.in shows the change at once: the cached words and every company page are rebuilt on the next visit. */
function refreshSite() {
  revalidateTag(SITE_TAG);
  revalidatePath("/group", "layout");
  revalidatePath("/website");
}

const failed = (e: { message: string; code?: string } | null): Result =>
  /'phone' column|column .*phone/.test(e?.message ?? "")
    ? { ok: false, message: "Phones can't be saved yet. Run 0032_showroom_phones.sql in Supabase first." }
    : e?.code === "42P01" || /relation .* does not exist|schema cache/.test(e?.message ?? "")
    ? { ok: false, message: "The website tables are not set up yet. Run 0029_website_content.sql in Supabase first." }
    : e?.code === "23505" ? { ok: false, message: "Another post already uses this web address. Change it slightly." }
    : { ok: false, message: e?.message ?? "Could not save." };

export async function saveShowroom(input: Partial<Showroom>): Promise<Result> {
  const { supabase } = await requireSuperAdmin();
  const c = checkShowroom(input);
  if (!c.ok) return c;
  const q = input.id
    ? supabase.from("site_showrooms").update(c.value).eq("id", input.id).select("id").single()
    : supabase.from("site_showrooms").insert(c.value).select("id").single();
  const { data, error } = await q;
  if (error) return failed(error);
  refreshSite();
  return { ok: true, message: input.id ? "Showroom saved. It is live on balasanka.in." : "Showroom added. It is live on balasanka.in.", id: data.id };
}

export async function deleteShowroom(id: string): Promise<Result> {
  const { supabase } = await requireSuperAdmin();
  const { error } = await supabase.from("site_showrooms").delete().eq("id", id);
  if (error) return failed(error);
  refreshSite();
  return { ok: true, message: "Showroom removed from balasanka.in." };
}

/** New order for a business's showrooms (ids top to bottom). */
export async function orderShowrooms(ids: string[]): Promise<Result> {
  const { supabase } = await requireSuperAdmin();
  for (const [i, id] of ids.entries()) {
    const { error } = await supabase.from("site_showrooms").update({ sort: (i + 1) * 10 }).eq("id", id);
    if (error) return failed(error);
  }
  refreshSite();
  return { ok: true, message: "Order saved." };
}

export async function savePost(input: Partial<PostRow>): Promise<Result> {
  const { supabase } = await requireSuperAdmin();
  const c = checkPost(input);
  if (!c.ok) return c;
  const q = input.id
    ? supabase.from("site_posts").update(c.value).eq("id", input.id).select("id").single()
    : supabase.from("site_posts").insert(c.value).select("id").single();
  const { data, error } = await q;
  if (error) return failed(error);
  refreshSite();
  const live = c.value.status === "published";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return {
    ok: true, id: data.id,
    message: !live ? "Draft saved. Visitors cannot see it." : c.value.published_on > today ? `Saved. It goes live on ${c.value.published_on}.` : "Published. It is live on balasanka.in.",
  };
}

export async function deletePost(id: string): Promise<Result> {
  const { supabase } = await requireSuperAdmin();
  const { error } = await supabase.from("site_posts").delete().eq("id", id);
  if (error) return failed(error);
  refreshSite();
  return { ok: true, message: "Post deleted." };
}

export async function saveContent<K extends ContentKey>(key: K, value: SiteContent[K]): Promise<Result> {
  const { supabase } = await requireSuperAdmin();
  if (!CONTENT_KEYS.includes(key)) return { ok: false, message: "Unknown part of the site." };
  const problem = checkContent(key, value);
  if (problem) return { ok: false, message: problem };
  const { error } = await supabase.from("site_content").upsert({ key, value });
  if (error) return failed(error);
  refreshSite();
  return { ok: true, message: "Saved. It is live on balasanka.in." };
}

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** A brand logo into the public 'site' bucket; returns its web address for the brand strip. */
export async function uploadLogo(form: FormData): Promise<Result> {
  const { supabase } = await requireSuperAdmin();
  const file = form.get("file");
  const brand = String(form.get("brand") ?? "logo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a picture file." };
  const ext = LOGO_TYPES[file.type];
  if (!ext) return { ok: false, message: "Logo must be a PNG, JPG or WebP picture." };
  if (file.size > 1024 * 1024) return { ok: false, message: "Logo must be under 1 MB." };
  const name = `logos/${brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "logo"}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("site").upload(name, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) return failed(error);
  return { ok: true, message: "Logo uploaded. Press Save to show it on the site.", url: supabase.storage.from("site").getPublicUrl(name).data.publicUrl };
}
