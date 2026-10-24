"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireProfile } from "@/lib/auth";

const MIN_PASSWORD = 8;

export async function updateMyProfile(formData: FormData) {
  const { profile, supabase } = await requireProfile();
  const mobile = String(formData.get("mobile") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const updates: Record<string, string | null> = { mobile: mobile || null };

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/")) return { ok: false, message: "Photo must be an image." };
    const path = `${profile.id}/${Date.now()}_${photo.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await supabase.storage.from("avatars").upload(path, photo, { contentType: photo.type, upsert: true });
    if (error) return { ok: false, message: error.message };
    updates.photo_path = path;
  }
  const { error } = await supabase.from("profiles").update(updates).eq("id", profile.id);
  if (error) return { ok: false, message: error.message };

  if (password) {
    if (password.length < MIN_PASSWORD) return { ok: false, message: `Password must be at least ${MIN_PASSWORD} characters.` };
    const { error: pErr } = await supabase.auth.updateUser({ password });
    if (pErr) return { ok: false, message: pErr.message };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}

export async function adminResetPassword(userId: string, newPassword: string) {
  const { supabase } = await requireAdmin();
  if (newPassword.length < MIN_PASSWORD) return { ok: false, message: `Password must be at least ${MIN_PASSWORD} characters.` };
  // The database function checks again that the caller is an admin.
  const { error } = await supabase.rpc("admin_set_password", { p_user: userId, p_password: newPassword });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Password reset." };
}
