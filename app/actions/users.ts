"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireProfile, requireSuperAdmin, usernameToEmail } from "@/lib/auth";

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

const ROLES = ["superadmin", "admin", "hr", "branch"] as const;

/** Adds a login. The database decides who may create which role (only the super admin creates admins). */
export async function adminCreateUser(input: { username: string; full_name: string; role: string; branch_id: string | null; password: string }) {
  const { supabase } = await requireAdmin();
  const username = input.username.trim().toLowerCase().replace(/\s+/g, " ");
  if (!/^[a-z0-9][a-z0-9 .\-]{1,40}$/.test(username)) return { ok: false, message: "Username: 2-40 letters, numbers, spaces, dots or dashes." };
  if (!input.full_name.trim()) return { ok: false, message: "Enter the person's name." };
  if (!ROLES.includes(input.role as (typeof ROLES)[number])) return { ok: false, message: "Choose a role." };
  if (input.password.length < MIN_PASSWORD) return { ok: false, message: `Password must be at least ${MIN_PASSWORD} characters.` };
  const { error } = await supabase.rpc("admin_create_user", {
    p_username: username, p_full_name: input.full_name.trim(), p_role: input.role,
    p_branch: input.role === "branch" ? input.branch_id : null, p_email: usernameToEmail(username), p_password: input.password,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin");
  return { ok: true, message: `Login "${username}" created.` };
}

export async function adminDeleteUser(userId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_delete_user", { p_user: userId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin");
  return { ok: true, message: "Login removed." };
}

/** Super admin only (enforced by the profiles policy as well). */
export async function superSetRole(userId: string, role: string) {
  const { supabase, profile } = await requireSuperAdmin();
  if (userId === profile.id) return { ok: false, message: "You can't change your own role." };
  if (!ROLES.includes(role as (typeof ROLES)[number]) || role === "branch") return { ok: false, message: "Choose admin, HR or super admin. Store logins are created per store." };
  const { data, error } = await supabase.from("profiles").update({ role, branch_id: null }).eq("id", userId).select("id");
  if (error) return { ok: false, message: error.message };
  if (!data?.length) return { ok: false, message: "Not allowed." };
  revalidatePath("/admin");
  return { ok: true, message: "Role changed." };
}
