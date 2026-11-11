// Exit process (0039_exit_process.sql), staff records phase 3. The store raises a resignation, HR confirms the last
// working day, takes the exit interview (or skips it with a reason) and relieves the employee on or after the last day.
// The relieving letter opens after that. Store logins never see the interview answers, HR notes or rehire.
// Admins can edit the interview questions on the Staff page (saved in exit_form). Each interview keeps a copy of the
// questions it was taken on, so editing them never changes past interviews. The questions below are the starting set
// from the staff records plan.

import type { ExitType } from "./staff";

export type ExitStatus = "raised" | "confirmed" | "relieved" | "cancelled";
export type QuestionType = "choice" | "multi" | "rating" | "yesno" | "text";

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "choice", label: "Pick one" }, { value: "multi", label: "Pick any" }, { value: "rating", label: "Rate 1 to 5 (one line per item)" },
  { value: "yesno", label: "Yes / Maybe / No" }, { value: "text", label: "Short text" },
];

export interface ExitQuestion {
  key: string;
  label: string;
  label_ta?: string;
  type: QuestionType;
  /** Choices for choice / multi; the items rated for rating. */
  options?: string[];
  required?: boolean;
}
export interface ExitForm { version: string; questions: ExitQuestion[] }

/** choice / yesno / text: a string. multi: the options picked. rating: item -> 1..5. */
export type ExitAnswer = string | string[] | Record<string, number>;
export type ExitAnswers = Record<string, ExitAnswer>;

export interface StaffExit {
  id: string;
  employment_id: string;
  status: ExitStatus;
  kind: ExitType;
  reason_given: string | null;
  informed_on: string | null;
  last_day: string;
  raised_by: string;
  raised_at: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  interview_status: "pending" | "done" | "skipped";
  interview_on: string | null;
  relieved_by: string | null;
  relieved_at: string | null;
  cancelled_by: string | null;
  cancel_note: string | null;
  // Not sent to store logins.
  interview_mode?: "phone" | "in person" | null;
  interviewed_by?: string | null;
  form?: ExitForm | null;
  answers?: ExitAnswers;
  skip_reason?: string | null;
  hr_notes?: string | null;
  rehire?: "yes" | "no" | "not sure" | null;
}

/** How someone is leaving, in the words the forms use. A store can raise the first two only. */
export const KIND_OPTIONS: { value: ExitType; label: string }[] = [
  { value: "resigned", label: "Resigned" },
  { value: "absconded", label: "Left without information (absconding)" },
  { value: "terminated", label: "Terminated" },
  { value: "retired", label: "Retired" },
  { value: "other", label: "Other" },
];
export const STORE_KINDS: ExitType[] = ["resigned", "absconded"];

export const REHIRE_OPTIONS = [
  { value: "yes", label: "Yes, we would take them back" }, { value: "not sure", label: "Not sure" }, { value: "no", label: "No" },
];

const REASONS = ["Salary", "Better job offer", "Work timings", "Distance / travel", "Manager or supervisor", "Workload",
  "No growth", "Family", "Marriage or relocation", "Health", "Studies", "Other"];

export const DEFAULT_EXIT_FORM: ExitForm = {
  version: "2026-1",
  questions: [
    { key: "main_reason", label: "Main reason for leaving", label_ta: "வேலையை விடுவதற்கான முக்கிய காரணம்", type: "choice", options: REASONS, required: true },
    { key: "other_reasons", label: "Any other reasons", label_ta: "வேறு காரணங்கள் ஏதேனும்", type: "multi", options: REASONS },
    { key: "ratings", label: "Rate each from 1 (poor) to 5 (very good)", label_ta: "ஒவ்வொன்றையும் 1 (மோசம்) முதல் 5 (மிக நன்று) வரை மதிப்பிடுங்கள்", type: "rating",
      options: ["Supervisor", "Team", "Salary", "Working hours", "Training"] },
    { key: "stay", label: "What would have made you stay?", label_ta: "எது இருந்திருந்தால் நீங்கள் தொடர்ந்து வேலை செய்திருப்பீர்கள்?", type: "text" },
    { key: "recommend", label: "Would you recommend Balasanka to a friend?", label_ta: "பாலசங்காவில் வேலை செய்ய உங்கள் நண்பருக்குப் பரிந்துரைப்பீர்களா?", type: "yesno" },
    { key: "come_back", label: "Would you come back in future?", label_ta: "எதிர்காலத்தில் மீண்டும் எங்களிடம் வேலைக்கு வருவீர்களா?", type: "yesno" },
    { key: "next", label: "Where are you going next? (optional)", label_ta: "அடுத்து எங்கே செல்கிறீர்கள்? (விருப்பம்)", type: "choice",
      options: ["Another jewellery / auto showroom", "Other job", "Studies", "Not working", "Prefer not to say"] },
  ],
};

export const YES_NO = [
  { value: "yes", label: "Yes", ta: "ஆம்" }, { value: "maybe", label: "Maybe", ta: "இருக்கலாம்" }, { value: "no", label: "No", ta: "இல்லை" },
];

/** The questions in use: the admin's saved version, or the starting set. */
export function currentExitForm(saved: { form: ExitForm } | null | undefined): ExitForm {
  return saved?.form?.questions?.length ? saved.form : DEFAULT_EXIT_FORM;
}

const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

/** Checks an edited question list. Keys stay as they were, so old answers still line up; new questions get one from the label. */
export function sanitizeExitForm(input: ExitForm, version: string): { form?: ExitForm; error?: string } {
  const seen = new Set<string>();
  const questions: ExitQuestion[] = [];
  for (const raw of input?.questions ?? []) {
    const label = clip(raw.label, 200);
    if (!label) return { error: "Every question needs English wording." };
    const type = QUESTION_TYPES.some((t) => t.value === raw.type) ? raw.type : "text";
    let key = slug(raw.key || label) || `q${questions.length + 1}`;
    while (seen.has(key)) key = `${key}_2`;
    seen.add(key);
    const q: ExitQuestion = { key, label, type };
    const ta = clip(raw.label_ta, 200);
    if (ta) q.label_ta = ta;
    if (type === "choice" || type === "multi" || type === "rating") {
      const options = [...new Set((raw.options ?? []).map((o) => clip(o, 80)).filter(Boolean))].slice(0, 30);
      if (options.length < (type === "rating" ? 1 : 2)) {
        return { error: `“${label}” needs ${type === "rating" ? "at least one item to rate" : "at least two choices"}.` };
      }
      q.options = options;
    }
    if (raw.required && type !== "rating") q.required = true;
    questions.push(q);
  }
  if (questions.length === 0) return { error: "Keep at least one question." };
  if (questions.length > 40) return { error: "Up to 40 questions." };
  return { form: { version, questions } };
}

/** Keeps only answers that fit the questions. */
export function cleanExitAnswers(form: ExitForm, answers: ExitAnswers): ExitAnswers {
  const out: ExitAnswers = {};
  for (const q of form.questions) {
    const a = answers?.[q.key];
    if (a == null) continue;
    if (q.type === "text") { const t = clip(a, 1000); if (t) out[q.key] = t; }
    else if (q.type === "choice") { if (typeof a === "string" && q.options?.includes(a)) out[q.key] = a; }
    else if (q.type === "yesno") { if (typeof a === "string" && YES_NO.some((y) => y.value === a)) out[q.key] = a; }
    else if (q.type === "multi") {
      const picked = Array.isArray(a) ? a.filter((v) => q.options?.includes(v)) : [];
      if (picked.length) out[q.key] = [...new Set(picked)];
    } else if (q.type === "rating" && typeof a === "object" && !Array.isArray(a)) {
      const r: Record<string, number> = {};
      for (const item of q.options ?? []) {
        const n = Number((a as Record<string, unknown>)[item]);
        if (Number.isInteger(n) && n >= 1 && n <= 5) r[item] = n;
      }
      if (Object.keys(r).length) out[q.key] = r;
    }
  }
  return out;
}

/** Required questions still unanswered (labels). */
export function missingAnswers(form: ExitForm, answers: ExitAnswers): string[] {
  return form.questions.filter((q) => q.required && answers[q.key] == null).map((q) => q.label);
}

/** One line for an answer, for the read-only view. */
export function answerText(q: ExitQuestion, a: ExitAnswer | undefined): string {
  if (a == null) return "-";
  if (q.type === "yesno") return YES_NO.find((y) => y.value === a)?.label ?? String(a);
  if (Array.isArray(a)) return a.join(", ");
  if (typeof a === "object") return Object.entries(a).map(([k, v]) => `${k} ${v}/5`).join(" · ");
  return a;
}

export type ExitStep = "confirm" | "interview" | "wait" | "relieve" | "done" | "cancelled";

/** What has to happen next on an exit, on a given day. */
export function nextStep(x: Pick<StaffExit, "status" | "interview_status" | "last_day">, today: string): ExitStep {
  if (x.status === "cancelled") return "cancelled";
  if (x.status === "relieved") return "done";
  if (x.status === "raised") return "confirm";
  if (x.interview_status === "pending") return "interview";
  return x.last_day > today ? "wait" : "relieve";
}

export const STEP_LABEL: Record<ExitStep, string> = {
  confirm: "HR to confirm the last day", interview: "Exit interview due", wait: "Waiting for the last day",
  relieve: "Ready to relieve", done: "Relieved", cancelled: "Cancelled",
};

/** The open exit of a stint, if any. */
export const openExit = (list: StaffExit[] | null, employmentId: string) =>
  list?.find((x) => x.employment_id === employmentId && (x.status === "raised" || x.status === "confirmed")) ?? null;

/** A relieving letter is given to people who resigned or retired, after any exit on their stint is closed. */
export const letterAllowed = (s: { left_on: string | null; exit_type: ExitType | null }, open: StaffExit | null) =>
  !!s.left_on && (s.exit_type === "resigned" || s.exit_type === "retired") && !open;
