/** Admin-managed questions on the /apply page. Pure helpers shared by the form, the submit action and the admin screen. */

export const QUESTION_TYPES = {
  text: "Short answer",
  long_text: "Paragraph",
  number: "Number",
  date: "Date",
  choice: "Choose one",
  file: "File upload (photo or PDF)",
} as const;
export type QuestionType = keyof typeof QUESTION_TYPES;

export type ShowWhen = { question_id: string; equals: string } | null;

export type ApplyQuestion = {
  id: string;
  section: string;
  label: string;
  type: QuestionType;
  options: string[];
  required: boolean;
  show_when: ShowWhen;
  /** date questions only: the answer must be at least this many years ago (e.g. 18 for date of birth) */
  min_age: number | null;
};

/** Admin view of a question, including deleted ones. */
export type AdminQuestion = ApplyQuestion & { sort_order: number; active: boolean };

export const MAX_ANSWER = { text: 300, long_text: 1000, number: 20, date: 10, choice: 200 } as const;

/** Form field name for a question. */
export const fieldName = (q: { id: string }) => `q_${q.id}`;

/** A question with a condition is only asked when the other question has the given answer. */
export function isVisible(q: ApplyQuestion, answers: Record<string, string>, all: ApplyQuestion[]): boolean {
  if (!q.show_when) return true;
  const parent = all.find((p) => p.id === q.show_when!.question_id);
  // a condition on a deleted question no longer hides anything
  if (!parent) return true;
  return isVisible(parent, answers, all) && answers[parent.id] === q.show_when.equals;
}

/** Groups questions into sections, keeping the order each section first appears in. */
export function groupBySection<T extends { section: string }>(qs: T[]): [string, T[]][] {
  const out = new Map<string, T[]>();
  for (const q of qs) out.set(q.section, [...(out.get(q.section) ?? []), q]);
  return [...out];
}

/** Checks one typed answer. Returns an error message or null. */
export function checkAnswer(q: ApplyQuestion, value: string, today = todayInIndia()): string | null {
  if (!value) return q.required ? `Please answer / பதிலளிக்கவும்: ${q.label}` : null;
  if (q.type === "file") return null;
  if (value.length > MAX_ANSWER[q.type]) return `Answer is too long / பதில் மிக நீளம்: ${q.label}`;
  if (q.type === "choice" && !q.options.includes(value)) return `Please choose an option / ஒன்றைத் தேர்வு செய்யவும்: ${q.label}`;
  if (q.type === "number" && !/^\d[\d,.]*$/.test(value)) return `Please enter a number / எண்ணை உள்ளிடவும்: ${q.label}`;
  if (q.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return `Please enter a date / தேதியை உள்ளிடவும்: ${q.label}`;
  if (q.type === "date" && q.min_age && value > latestDate(q.min_age, today)) {
    return `You must be at least ${q.min_age} years old / குறைந்தது ${q.min_age} வயது இருக்க வேண்டும்: ${q.label}`;
  }
  return null;
}

export type QuestionInput = {
  section: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
  show_when: ShowWhen;
  min_age: number | null;
};

/** Cleans what the admin typed. Returns the clean question or an error message. */
export function cleanQuestion(input: QuestionInput, others: AdminQuestion[], selfId?: string): { ok: true; value: QuestionInput } | { ok: false; message: string } {
  const label = input.label.trim().replace(/\s+/g, " ");
  const section = input.section.trim().replace(/\s+/g, " ") || "More details / கூடுதல் விவரங்கள்";
  if (!label) return { ok: false, message: "The question needs a label." };
  if (label.length > 300) return { ok: false, message: "Keep the question under 300 characters." };
  if (section.length > 80) return { ok: false, message: "Keep the section name under 80 characters." };
  if (!(input.type in QUESTION_TYPES)) return { ok: false, message: "Choose a question type." };
  const clash = others.find((o) => o.active && o.id !== selfId && o.label.trim().toLowerCase() === label.toLowerCase());
  if (clash) return { ok: false, message: "Another question already has this label. Use a different one." };

  const options = input.type === "choice" ? [...new Set(input.options.map((o) => o.trim()).filter(Boolean))] : [];
  if (input.type === "choice" && options.length < 2) return { ok: false, message: "A 'choose one' question needs at least 2 options." };
  if (options.some((o) => o.length > 200)) return { ok: false, message: "Keep each option under 200 characters." };

  const child = others.find((o) => o.active && selfId && o.show_when?.question_id === selfId && !options.includes(o.show_when.equals));
  if (child) return { ok: false, message: `"${child.label}" only appears for the answer "${child.show_when!.equals}". Keep that option or change that question first.` };

  let show_when: ShowWhen = null;
  if (input.show_when?.question_id) {
    const parent = others.find((o) => o.id === input.show_when!.question_id && o.active);
    if (!parent || parent.type !== "choice" || parent.id === selfId) return { ok: false, message: "'Only ask when' must point to another 'choose one' question." };
    if (!parent.options.includes(input.show_when.equals)) return { ok: false, message: "Pick which answer makes this question appear." };
    // no loops: the parent's own chain must not lead back to this question
    for (let p: AdminQuestion | undefined = parent; p?.show_when; p = others.find((o) => o.id === p!.show_when!.question_id)) {
      if (p.show_when.question_id === selfId) return { ok: false, message: "Those conditions would loop back to this question." };
    }
    show_when = { question_id: parent.id, equals: input.show_when.equals };
  }
  let min_age: number | null = null;
  if (input.type === "date" && input.min_age) {
    if (!Number.isInteger(input.min_age) || input.min_age < 1 || input.min_age > 100) return { ok: false, message: "Minimum age must be a whole number from 1 to 100." };
    min_age = input.min_age;
  }
  return { ok: true, value: { section, label, type: input.type, options, required: input.required, show_when, min_age } };
}

/** Admin-entered post list: one per line, trimmed, no blanks or repeats. */
export function cleanPosts(text: string): string[] {
  return [...new Set(text.split("\n").map((p) => p.trim().replace(/\s+/g, " ")).filter(Boolean))].map((p) => p.slice(0, 120));
}

/** "Gender / பாலினம்" → ["Gender", "பாலினம்"]. The Tamil part starts at the first Tamil letter; English-only text gives ["…", ""]. */
export function splitBilingual(text: string): [string, string] {
  const i = text.search(/[஀-௿]/);
  if (i < 0) return [text.trim(), ""];
  const cut = text.lastIndexOf(" / ", i);
  if (cut < 0) return [text.trim(), ""];
  return [text.slice(0, cut).trim(), text.slice(cut + 3).trim()];
}

/** Today's date in India as YYYY-MM-DD. */
export function todayInIndia(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

/** The latest date that is at least `years` years before `today` (YYYY-MM-DD). 29 Feb rolls back to 28 Feb. */
export function latestDate(years: number, today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const year = y - years;
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${year}-${String(m).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

/** Keeps each branch's open posts in the master list's order, dropping any post no longer in it. */
export function cleanBranchPosts(map: Record<string, string[]>, master: string[], branchIds: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const id of branchIds) out[id] = master.filter((p) => (map[id] ?? []).includes(p));
  return out;
}
