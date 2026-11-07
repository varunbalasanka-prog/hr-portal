"use server";
import { createPublicClient } from "@/lib/supabase/public";
import { checkAnswer, fieldName, isVisible } from "@/lib/apply-questions";
import { clientIp } from "@/lib/client-ip";
import { pushTo } from "@/lib/push";
import { lookupDetails } from "./lookup";

type Result = { ok: boolean; message: string; field?: string };

const TRY_AGAIN = "Could not submit. Please try again. / சமர்ப்பிக்க முடியவில்லை, மீண்டும் முயற்சிக்கவும்.";
const MESSAGES: Record<string, string> = {
  expired: "This link has expired. Please contact HR. / இந்த இணைப்பு காலாவதியானது, HR-ஐத் தொடர்பு கொள்ளவும்.",
  done: "Your details were already submitted. / உங்கள் விவரங்கள் ஏற்கனவே சமர்ப்பிக்கப்பட்டன.",
  too_big: "Some answers are too long. Please shorten them. / சில பதில்கள் மிக நீளம், சுருக்கவும்.",
  bad_file: "File upload expired. Please submit again. / கோப்பு பதிவேற்றம் காலாவதியானது, மீண்டும் சமர்ப்பிக்கவும்.",
  too_many: "Too many tries from this device. Please try again in an hour. / அதிக முயற்சிகள், ஒரு மணி நேரம் கழித்து முயற்சிக்கவும்.",
  busy: "We are receiving many forms right now. Please try again in an hour. / தற்போது அதிக படிவங்கள், ஒரு மணி நேரம் கழித்து முயற்சிக்கவும்.",
};

/** Step 1, only when there are files: an upload folder, with the same limits as the apply page. */
export async function startDetails(token: string): Promise<{ ok: true; folder: string } | { ok: false; message: string }> {
  const found = await lookupDetails(token);
  if (!found) return { ok: false, message: TRY_AGAIN };
  if (found.expired) return { ok: false, message: MESSAGES.expired };
  if (found.submitted_at) return { ok: false, message: MESSAGES.done };
  const { hash } = await clientIp();
  const { data, error } = await createPublicClient().rpc("open_apply_folder", { p_secret: process.env.APPLY_SECRET ?? "", p_ip: hash });
  if (error || !data) return { ok: false, message: TRY_AGAIN };
  const r = data as { folder?: string; error?: string };
  return r.folder ? { ok: true, folder: r.folder } : { ok: false, message: MESSAGES[r.error ?? ""] ?? TRY_AGAIN };
}

/** Step 2: answers and file paths. Checked against the questions this candidate still has, saved under their current labels.
 *  The database never overwrites an answer the candidate already gave. */
export async function submitDetails(token: string, fd: FormData): Promise<Result> {
  const found = await lookupDetails(token);
  if (!found) return { ok: false, message: TRY_AGAIN };
  if (found.expired) return { ok: false, message: MESSAGES.expired };
  if (found.submitted_at) return { ok: false, message: MESSAGES.done };
  const { questions } = found;
  const folder = String(fd.get("folder") ?? "").trim().slice(0, 40);
  const answers: Record<string, string> = {};
  for (const q of questions) answers[q.id] = String(fd.get(fieldName(q)) ?? "").trim().slice(0, 1000);

  const form_data: Record<string, string> = {};
  for (const q of questions) {
    if (!isVisible(q, answers, questions)) continue;
    if (q.type === "file") {
      const path = answers[q.id];
      if (!path) {
        if (q.required) return { ok: false, message: `Please upload / பதிவேற்றவும்: ${q.label}`, field: fieldName(q) };
        continue;
      }
      if (!folder || !path.startsWith(`${folder}/`)) return { ok: false, message: MESSAGES.bad_file };
      form_data[q.label] = `app-file:${path}`;
      continue;
    }
    const problem = checkAnswer(q, answers[q.id]);
    if (problem) return { ok: false, message: problem, field: fieldName(q) };
    if (answers[q.id]) form_data[q.label] = answers[q.id];
  }

  const { data, error } = await createPublicClient().rpc("submit_details", {
    p_token: token, p: { folder: folder || null, form_data }, p_secret: process.env.APPLY_SECRET ?? "",
  });
  if (error || !data) return { ok: false, message: TRY_AGAIN };
  const r = data as { status: string; notify?: string };
  if (r.status !== "ok") return { ok: false, message: MESSAGES[r.status] ?? TRY_AGAIN };
  if (r.notify) await pushTo(r.notify, { title: "Details filled", body: `${found.name} filled the after-interview details`, url: "/dashboard" });
  return { ok: true, message: "Submitted" };
}
