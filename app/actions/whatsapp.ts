"use server";
import { requireProfile } from "@/lib/auth";
import { sendWhatsApp } from "@/lib/whatsapp-api";

/** Sends a message through the WhatsApp Business API and notes it in the candidate's history. */
export async function sendCandidateWhatsApp(candidateId: string, text: string, label: string) {
  const { profile, supabase } = await requireProfile();
  const { data: c } = await supabase.from("candidates").select("id, mobile, pipeline_status").eq("id", candidateId).maybeSingle();
  if (!c) return { ok: false, message: "Candidate not found." };
  const r = await sendWhatsApp(c.mobile, text.slice(0, 4000));
  if (r.ok) {
    await supabase.from("candidate_events").insert({
      candidate_id: c.id, actor: profile.username, stage: "whatsapp", from_status: c.pipeline_status, to_status: c.pipeline_status,
      remark: `WhatsApp sent: ${label}`,
    });
  }
  return r;
}
