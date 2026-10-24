"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usernameToEmail } from "@/lib/auth";

export async function login(_: { error?: string } | undefined, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (error) return { error: "Invalid username or password." };
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  redirect(aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2" ? "/login/verify" : "/dashboard");
}

/** Second step for staff who turned on two-step login: the 6-digit code from their authenticator app. */
export async function verifyCode(_: { error?: string } | undefined, formData: FormData) {
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "Enter the 6-digit code from your authenticator app." };
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === "verified");
  if (!factor) redirect("/dashboard");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: "That code didn't work. Check the time on your phone and try the newest code." };
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
