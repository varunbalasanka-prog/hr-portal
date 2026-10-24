"use server";
import { randomUUID } from "node:crypto";
import { createPublicClient } from "@/lib/supabase/public";
import { ALLOWED_TYPES, MAX_FILE_BYTES } from "@/lib/onboarding";
import { APPLY_FILE_FIELDS, APPLY_TEXT_FIELDS, REQUIRED_FILES } from "./fields";

const MESSAGES: Record<string, string> = {
  bad_mobile: "Please enter a valid 10-digit mobile number.",
  missing: "Please fill all required fields marked *.",
  bad_branch: "Please choose the branch you are applying to.",
  too_big: "Some answers are too long. Please shorten them.",
};

const text = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);

/** Runs with the public key: files go to a new private folder, then the database records the application and tells HR. */
export async function submitApplication(fd: FormData): Promise<{ ok: boolean; message: string }> {
  const name = text(fd, "name", 120);
  const mobile = text(fd, "mobile", 20).replace(/\D/g, "").slice(-10);
  const post = text(fd, "post", 120);
  const branchId = text(fd, "branch_id", 40);
  if (!name || !post || !branchId) return { ok: false, message: MESSAGES.missing };
  if (!/^[6-9]\d{9}$/.test(mobile)) return { ok: false, message: MESSAGES.bad_mobile };

  const files: [string, File][] = [];
  for (const key of Object.keys(APPLY_FILE_FIELDS)) {
    const f = fd.get(key);
    if (!(f instanceof File) || f.size === 0) {
      if (REQUIRED_FILES.includes(key)) return { ok: false, message: `Please upload your ${APPLY_FILE_FIELDS[key].toLowerCase()}.` };
      continue;
    }
    if (f.size > MAX_FILE_BYTES) return { ok: false, message: `${APPLY_FILE_FIELDS[key]} is larger than 8 MB.` };
    if (!ALLOWED_TYPES.includes(f.type)) return { ok: false, message: `${APPLY_FILE_FIELDS[key]} must be a photo or PDF.` };
    files.push([key, f]);
  }

  const form_data: Record<string, string> = {};
  for (const [k, label] of Object.entries(APPLY_TEXT_FIELDS)) {
    const v = text(fd, k);
    if (v) form_data[label] = v;
  }

  const db = createPublicClient();
  const folder = randomUUID();
  for (const [key, f] of files) {
    const ext = f.type === "application/pdf" ? "pdf" : f.type.split("/")[1];
    const path = `${folder}/${key}.${ext}`;
    const { error } = await db.storage.from("applications").upload(path, f, { contentType: f.type });
    if (error) return { ok: false, message: `Upload failed for ${APPLY_FILE_FIELDS[key]}. Please try again.` };
    form_data[APPLY_FILE_FIELDS[key]] = `app-file:${path}`;
  }

  const { data, error } = await db.rpc("submit_application", {
    p: {
      name, mobile, post, branch_id: branchId, folder: files.length ? folder : null, form_data,
      father_name: text(fd, "father_name", 120), email: text(fd, "email", 120),
      address: text(fd, "address"), marital_status: text(fd, "marital_status", 40),
    },
  });
  if (error) return { ok: false, message: "Could not submit. Please try again." };
  if (data === "ok" || data === "updated") return { ok: true, message: "Submitted" };
  return { ok: false, message: MESSAGES[data as string] ?? "Could not submit. Please try again." };
}
