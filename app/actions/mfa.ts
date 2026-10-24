"use server";
import { requireProfile } from "@/lib/auth";

type Result = { ok: boolean; message: string };

export type MfaState = { enabled: boolean; factorId: string | null };

export async function mfaStatus(): Promise<MfaState> {
  const { supabase } = await requireProfile();
  const { data } = await supabase.auth.mfa.listFactors();
  const f = data?.totp.find((x) => x.status === "verified");
  return { enabled: !!f, factorId: f?.id ?? null };
}

/** Step 1 of turning on two-step login: a QR code for Google Authenticator / Microsoft Authenticator. */
export async function startMfa(): Promise<{ ok: true; factorId: string; qr: string; secret: string } | { ok: false; message: string }> {
  const { supabase } = await requireProfile();
  // Clear half-finished attempts so they don't pile up.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const f of existing?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Balasanka HR ${Date.now()}`, issuer: "Balasanka HR" });
  if (error || !data) return { ok: false, message: error?.message ?? "Could not start." };
  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Step 2: the first code from the app proves it is set up. */
export async function confirmMfa(factorId: string, code: string): Promise<Result> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\D/g, "") });
  if (error) return { ok: false, message: "That code didn't work. Try the newest code in the app." };
  return { ok: true, message: "Two-step login is on. You'll be asked for a code each time you log in." };
}

export async function disableMfa(factorId: string): Promise<Result> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Two-step login is off." };
}
