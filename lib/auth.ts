import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";
export { usernameToEmail } from "./usernames";

/** The logged-in staff member, or a redirect to /login. */
export async function requireProfile(): Promise<{ profile: Profile; supabase: Awaited<ReturnType<typeof createClient>> }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login?error=no-profile");
  return { profile: profile as Profile, supabase };
}

export async function requireAdmin() {
  const ctx = await requireProfile();
  if (ctx.profile.role !== "admin") redirect("/dashboard");
  return ctx;
}
