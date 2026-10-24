"use server";
import { createPublicClient } from "@/lib/supabase/public";
import { checkAnswer, fieldName, isVisible } from "@/lib/apply-questions";
import { CONSENT_VERSION } from "@/lib/privacy";
import { clientIp } from "@/lib/client-ip";
import { verifyTurnstile } from "@/lib/turnstile";
import { loadApplyConfig } from "./config";
import { cleanSource } from "@/lib/sources";
import { pushTo } from "@/lib/push";

export type SubmitResult = { ok: boolean; message: string; ref?: string; field?: string };

const TRY_AGAIN = "Could not submit. Please try again. / சமர்ப்பிக்க முடியவில்லை, மீண்டும் முயற்சிக்கவும்.";
const MESSAGES: Record<string, string> = {
  bad_mobile: "Please enter a valid 10-digit mobile number. / சரியான 10 இலக்க கைபேசி எண்ணை உள்ளிடவும்.",
  missing: "Please fill all required fields marked *. / * குறியிட்ட அனைத்தையும் நிரப்பவும்.",
  bad_branch: "Please choose the branch you are applying to. / கிளையைத் தேர்வு செய்யவும்.",
  bad_post: "That post isn't open at the chosen branch. Please choose again. / இந்தக் கிளையில் அந்தப் பதவி இல்லை, மீண்டும் தேர்வு செய்யவும்.",
  too_big: "Some answers are too long. Please shorten them. / சில பதில்கள் மிக நீளம், சுருக்கவும்.",
  no_consent: "Please tick the box to agree to the privacy notice. / தனியுரிமை அறிவிப்பை ஏற்க பெட்டியில் டிக் செய்யவும்.",
  too_many: "Too many applications from this number or device today. Please try again tomorrow. / இன்று அதிக விண்ணப்பங்கள் வந்துள்ளன, நாளை முயற்சிக்கவும்.",
  busy: "We are receiving many applications right now. Please try again in an hour. / தற்போது அதிக விண்ணப்பங்கள், ஒரு மணி நேரம் கழித்து முயற்சிக்கவும்.",
  bad_file: "File upload expired. Please submit again. / கோப்பு பதிவேற்றம் காலாவதியானது, மீண்டும் சமர்ப்பிக்கவும்.",
  on_record: "We already have your earlier application on record. Please contact the branch HR. / உங்கள் முந்தைய விண்ணப்பம் எங்களிடம் உள்ளது. கிளை HR-ஐத் தொடர்பு கொள்ளவும்.",
  bot: "Please complete the \"I am human\" check. / \"நான் மனிதர்\" சரிபார்ப்பை முடிக்கவும்.",
};
const FIELD_FOR: Record<string, string> = { bad_mobile: "mobile", bad_branch: "branch_id", bad_post: "post", no_consent: "consent" };

const text = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);

/** Step 1: the browser asks for an upload folder. Checks the human test and rate limits before any file is accepted. */
export async function startApplication(turnstileToken: string): Promise<{ ok: true; folder: string } | { ok: false; message: string }> {
  const { ip, hash } = await clientIp();
  if (!(await verifyTurnstile(turnstileToken, ip))) return { ok: false, message: MESSAGES.bot };
  const { data, error } = await createPublicClient().rpc("open_apply_folder", { p_secret: process.env.APPLY_SECRET ?? "", p_ip: hash });
  if (error || !data) return { ok: false, message: TRY_AGAIN };
  const r = data as { folder?: string; error?: string };
  if (!r.folder) return { ok: false, message: MESSAGES[r.error ?? ""] ?? TRY_AGAIN };
  return { ok: true, folder: r.folder };
}

/** Step 2, after the browser has uploaded the files into the folder: the answers and file paths, no file bodies.
 *  Answers are checked against the questions live right now and saved under their current labels. */
export async function submitApplication(fd: FormData): Promise<SubmitResult> {
  const name = text(fd, "name", 120);
  const mobile = text(fd, "mobile", 20).replace(/\D/g, "").slice(-10);
  const post = text(fd, "post", 120);
  const branchId = text(fd, "branch_id", 40);
  const fatherName = text(fd, "father_name", 120);
  const address = text(fd, "address");
  const marital = text(fd, "marital_status", 40);
  const folder = text(fd, "folder", 40);
  for (const [k, v] of [["branch_id", branchId], ["post", post], ["name", name], ["mobile", mobile], ["father_name", fatherName], ["marital_status", marital], ["address", address]]) {
    if (!v) return { ok: false, message: MESSAGES.missing, field: k };
  }
  if (!/^[6-9]\d{9}$/.test(mobile)) return { ok: false, message: MESSAGES.bad_mobile, field: "mobile" };
  if (fd.get("consent") !== "yes") return { ok: false, message: MESSAGES.no_consent, field: "consent" };

  const config = await loadApplyConfig();
  if (!config) return { ok: false, message: TRY_AGAIN };
  const { questions } = config;
  const branch = config.branches.find((b) => b.id === branchId);
  if (!branch) return { ok: false, message: MESSAGES.bad_branch, field: "branch_id" };
  if (!branch.posts.includes(post)) return { ok: false, message: MESSAGES.bad_post, field: "post" };

  const answers: Record<string, string> = {};
  for (const q of questions) answers[q.id] = text(fd, fieldName(q), 1000);

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

  const { data, error } = await createPublicClient().rpc("submit_application", {
    p: {
      name, mobile, post, branch_id: branchId, folder: folder || null, form_data, consent_version: CONSENT_VERSION,
      father_name: fatherName, email: text(fd, "email", 120), address, marital_status: marital,
      source_channel: cleanSource(text(fd, "source_channel", 40)) ?? (text(fd, "referred_by", 120) ? "referral" : null),
      referred_by: text(fd, "referred_by", 120) || null,
    },
    p_secret: process.env.APPLY_SECRET ?? "",
  });
  if (error || !data) return { ok: false, message: TRY_AGAIN };
  const r = data as { status: string; ref?: string; notify?: string };
  if (r.status === "ok" || r.status === "updated") {
    if (r.notify) await pushTo(r.notify, { title: r.status === "ok" ? "New application" : "Applied again", body: `${name} · ${post} · ${branch.name}`, url: "/dashboard" });
    return { ok: true, message: "Submitted", ref: r.ref };
  }
  return { ok: false, message: MESSAGES[r.status] ?? TRY_AGAIN, field: FIELD_FOR[r.status] };
}
