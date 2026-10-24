"use server";
import { createPublicClient } from "@/lib/supabase/public";
import { isToken } from "@/lib/candidate-token";

const MESSAGES: Record<string, string> = {
  ok: "Thank you. HR has been told. / நன்றி. HR-க்குத் தெரிவிக்கப்பட்டது.",
  already: "You have already answered this offer. Please call HR to change it. / ஏற்கனவே பதிலளித்துள்ளீர்கள். மாற்ற HR-ஐ அழைக்கவும்.",
  expired: "This link has expired. Please ask HR for a new one. / இணைப்பு காலாவதியானது.",
};

/** The candidate accepts or declines from their offer letter link. */
export async function respondToOffer(token: string, accept: boolean, reason: string) {
  if (!isToken(token)) return { ok: false, message: "Invalid link." };
  const { data, error } = await createPublicClient().rpc("respond_offer", { p_token: token, p_accept: accept, p_reason: reason.slice(0, 300) });
  if (error) return { ok: false, message: "Could not save. Please try again. / மீண்டும் முயற்சிக்கவும்." };
  const status = String(data);
  return { ok: status === "ok", message: MESSAGES[status] ?? "Invalid link." };
}
