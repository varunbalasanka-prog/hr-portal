"use server";
import { randomUUID } from "node:crypto";
import { createPublicClient } from "@/lib/supabase/public";
import { ALLOWED_TYPES, MAX_FILE_BYTES } from "@/lib/onboarding";
import { checkAnswer, fieldName, isVisible } from "@/lib/apply-questions";
import { loadApplyConfig } from "./config";

const MESSAGES: Record<string, string> = {
  bad_mobile: "Please enter a valid 10-digit mobile number.",
  missing: "Please fill all required fields marked *.",
  bad_branch: "Please choose the branch you are applying to.",
  too_big: "Some answers are too long. Please shorten them.",
};

const text = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);

/** Runs with the public key. Answers are checked against the questions live right now and saved under their current
 *  labels, so later edits to the questions don't change this application. */
export async function submitApplication(fd: FormData): Promise<{ ok: boolean; message: string }> {
  const name = text(fd, "name", 120);
  const mobile = text(fd, "mobile", 20).replace(/\D/g, "").slice(-10);
  const post = text(fd, "post", 120);
  const branchId = text(fd, "branch_id", 40);
  const fatherName = text(fd, "father_name", 120);
  const address = text(fd, "address");
  const marital = text(fd, "marital_status", 40);
  if (!name || !post || !branchId || !fatherName || !address || !marital) return { ok: false, message: MESSAGES.missing };
  if (!/^[6-9]\d{9}$/.test(mobile)) return { ok: false, message: MESSAGES.bad_mobile };

  const config = await loadApplyConfig();
  if (!config) return { ok: false, message: "Could not submit. Please try again." };
  const { questions } = config;

  const answers: Record<string, string> = {};
  for (const q of questions) if (q.type !== "file") answers[q.id] = text(fd, fieldName(q), 1000);

  const form_data: Record<string, string> = {};
  const files: [string, string, File][] = [];
  for (const q of questions) {
    if (!isVisible(q, answers, questions)) continue;
    if (q.type === "file") {
      const f = fd.get(fieldName(q));
      if (!(f instanceof File) || f.size === 0) {
        if (q.required) return { ok: false, message: `Please upload: ${q.label}` };
        continue;
      }
      if (f.size > MAX_FILE_BYTES) return { ok: false, message: `${q.label} is larger than 8 MB.` };
      if (!ALLOWED_TYPES.includes(f.type)) return { ok: false, message: `${q.label} must be a photo or PDF.` };
      files.push([q.id, q.label, f]);
      continue;
    }
    const problem = checkAnswer(q, answers[q.id]);
    if (problem) return { ok: false, message: problem };
    if (answers[q.id]) form_data[q.label] = answers[q.id];
  }

  const db = createPublicClient();
  const folder = randomUUID();
  for (const [id, label, f] of files) {
    const ext = f.type === "application/pdf" ? "pdf" : f.type.split("/")[1];
    const path = `${folder}/${id}.${ext}`;
    const { error } = await db.storage.from("applications").upload(path, f, { contentType: f.type });
    if (error) return { ok: false, message: `Upload failed for ${label}. Please try again.` };
    form_data[label] = `app-file:${path}`;
  }

  const { data, error } = await db.rpc("submit_application", {
    p: {
      name, mobile, post, branch_id: branchId, folder: files.length ? folder : null, form_data,
      father_name: fatherName, email: text(fd, "email", 120), address, marital_status: marital,
    },
  });
  if (error) return { ok: false, message: "Could not submit. Please try again." };
  if (data === "ok" || data === "updated") return { ok: true, message: "Submitted" };
  return { ok: false, message: MESSAGES[data as string] ?? "Could not submit. Please try again." };
}
