// Appraisals (0020_appraisals.sql). A pay rise or promotion after joining happens only through an appraisal: HR or an
// admin records the interview on the store's form, proposes the new salary / role, and an admin approves it. The approved change becomes a
// dated line in the staff register. Each appraisal keeps a copy of the form it was filled on, so changing the form
// later never changes past appraisals.
// The form follows the store's business type. The jewellery form is the branches' paper "Appraisal form 2026"
// (Akshaya Velli Theni); the automobile form is the draft varun approved on 27 Oct 2026. Admins can edit both on the
// Staff page (saved in appraisal_forms, 0022); the forms below are the starting versions.

/** "heading" is a sub-title inside a section; it holds no answer. */
export type FieldType = "number" | "text" | "grade" | "check" | "heading";
export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "number", label: "Number" }, { value: "text", label: "Text" }, { value: "grade", label: "Good / Average / Poor" },
  { value: "check", label: "Tick box" }, { value: "heading", label: "Sub-heading" },
];
export interface AppraisalField { key: string; label: string; type: FieldType; hint?: string }
export interface AppraisalSection {
  key: string;
  title: string;
  /** "past": filled once for each of the two years before the cycle. "next": targets for the cycle's year. */
  years?: "past" | "next";
  fields: AppraisalField[];
}
export type FormKind = "jewellery" | "automobile";
export interface AppraisalForm { kind: FormKind; version: string; title: string; sections: AppraisalSection[] }

/** The in-charge's ratings. */
export const GRADES = [{ value: "good", label: "Good" }, { value: "average", label: "Average" }, { value: "poor", label: "Poor" }] as const;

const SALES: AppraisalField[] = [
  { key: "late", label: "Late (days)", type: "number" },
  { key: "leave", label: "Leave (days)", type: "number" },
  { key: "total_sales", label: "Total sales (₹)", type: "number" },
  { key: "aps_count", label: "No. of APS", type: "number" },
  { key: "new_ex_customers", label: "New / existing customers", type: "number" },
  { key: "exchange_pct", label: "Exchange %", type: "number" },
  { key: "piece_rate_pct", label: "Piece rate %", type: "number" },
  { key: "ticket_size", label: "Ticket size (₹)", type: "number" },
  { key: "bucket_size", label: "Bucket size", type: "number" },
  { key: "aps_collection_pct", label: "APS collection %", type: "number" },
];

export const JEWELLERY_FORM: AppraisalForm = {
  kind: "jewellery",
  version: "2026-1",
  title: "Jewellery appraisal form",
  sections: [
    {
      key: "interview", title: "Interview",
      fields: [
        { key: "presentation_done", label: "Gave the 2-minute talk: why they deserve the appraisal, and how they will improve next year", type: "check" },
        { key: "expected_salary", label: "Expected salary (₹ per month)", type: "number" },
        { key: "incharge_name", label: "Store in-charge", type: "text" },
      ],
    },
    {
      key: "past", title: "Last two years", years: "past",
      fields: [
        { key: "salary", label: "Salary (₹ per month)", type: "number" },
        ...SALES,
        { key: "knowledge", label: "Knowledge of the job (by in-charge)", type: "grade" },
        { key: "customer_satisfaction", label: "Customer satisfaction (by in-charge)", type: "grade" },
        { key: "team_work", label: "Team work (by in-charge)", type: "grade" },
        { key: "grooming", label: "Grooming (by in-charge)", type: "grade" },
        { key: "unique_done", label: "What unique thing they did to improve sales", type: "text" },
      ],
    },
    {
      key: "next", title: "Targets for next year", years: "next",
      fields: [
        ...SALES,
        { key: "did_for_salary", label: "What I did for salary", type: "text" },
        { key: "did_for_incentive", label: "What I did for incentive", type: "text" },
        { key: "improvement_areas", label: "Improvement areas", type: "text" },
        { key: "unique_plan", label: "What unique thing they will do to improve sales", type: "text" },
        { key: "company_ideas", label: "Ideas for improving the company", type: "text" },
      ],
    },
    {
      key: "signoff", title: "Sign-off",
      fields: [
        { key: "staff_signed", label: "Staff signed the form", type: "check" },
        { key: "incharge_signed", label: "In-charge signed the form", type: "check" },
      ],
    },
  ],
};

const AUTO_FIGURES: AppraisalField[] = [
  { key: "late", label: "Late (days)", type: "number" },
  { key: "leave", label: "Leave (days)", type: "number" },
  { key: "h_sales", label: "Sales staff", type: "heading" },
  { key: "vehicles_sold", label: "Vehicles sold (units)", type: "number" },
  { key: "enquiries", label: "Enquiries handled", type: "number" },
  { key: "enquiry_booking_pct", label: "Enquiry to booking %", type: "number" },
  { key: "test_rides", label: "Test rides given", type: "number" },
  { key: "finance_pct", label: "Finance cases %", type: "number" },
  { key: "insurance_pct", label: "Insurance sold with vehicle %", type: "number" },
  { key: "accessories_sales", label: "Accessories sales (₹)", type: "number" },
  { key: "warranty_amc", label: "Extended warranty / AMC sold", type: "number" },
  { key: "exchange_vehicles", label: "Exchange vehicles taken", type: "number" },
  { key: "h_service", label: "Service staff", type: "heading" },
  { key: "job_cards", label: "Vehicles serviced (job cards)", type: "number" },
  { key: "repeat_repairs", label: "Repeat repairs (came back within 30 days)", type: "number" },
  { key: "labour_revenue", label: "Labour revenue (₹)", type: "number" },
  { key: "spares_sales", label: "Spares and oil sales (₹)", type: "number" },
  { key: "service_hours", label: "Average service time (hours)", type: "number" },
  { key: "h_all", label: "All staff", type: "heading" },
  { key: "complaints", label: "Customer complaints", type: "number" },
];

export const AUTOMOBILE_FORM: AppraisalForm = {
  kind: "automobile",
  version: "2026-1",
  title: "Automobile appraisal form",
  sections: [
    {
      key: "interview", title: "Interview",
      fields: [
        { key: "presentation_done", label: "Gave the 2-minute talk: why they deserve the appraisal, and how they will improve next year", type: "check" },
        { key: "role", label: "Role (Sales / Service / Office)", type: "text" },
        { key: "expected_salary", label: "Expected salary (₹ per month)", type: "number" },
        { key: "incharge_name", label: "Store in-charge", type: "text" },
      ],
    },
    {
      key: "past", title: "Last two years", years: "past",
      fields: [
        { key: "salary", label: "Salary (₹ per month)", type: "number" },
        ...AUTO_FIGURES,
        { key: "knowledge", label: "Knowledge of the job (by in-charge)", type: "grade" },
        { key: "customer_satisfaction", label: "Customer satisfaction (by in-charge)", type: "grade" },
        { key: "team_work", label: "Team work (by in-charge)", type: "grade" },
        { key: "grooming", label: "Grooming (by in-charge)", type: "grade" },
        { key: "unique_done", label: "What unique thing they did to improve sales / service", type: "text" },
      ],
    },
    {
      key: "next", title: "Targets for next year", years: "next",
      fields: [
        ...AUTO_FIGURES,
        { key: "did_for_salary", label: "What I did for salary", type: "text" },
        { key: "did_for_incentive", label: "What I did for incentive", type: "text" },
        { key: "improvement_areas", label: "Improvement areas", type: "text" },
        { key: "unique_plan", label: "What unique thing they will do to improve sales / service", type: "text" },
        { key: "company_ideas", label: "Ideas for improving the company", type: "text" },
      ],
    },
    {
      key: "signoff", title: "Sign-off",
      fields: [
        { key: "staff_signed", label: "Staff signed the form", type: "check" },
        { key: "incharge_signed", label: "In-charge signed the form", type: "check" },
      ],
    },
  ],
};

/** The starting forms. A business type with no form has no appraisals (its salaries change the old way). */
export const DEFAULT_FORMS: Record<FormKind, AppraisalForm> = { jewellery: JEWELLERY_FORM, automobile: AUTOMOBILE_FORM };

/** The forms in use: an admin's saved version (appraisal_forms) over the starting one. */
export function currentForms(saved: { kind: string; form: AppraisalForm }[] | null | undefined): Record<FormKind, AppraisalForm> {
  const out = { ...DEFAULT_FORMS };
  for (const r of saved ?? []) if (r.kind in out) out[r.kind as FormKind] = r.form;
  return out;
}

/** Same mapping as appraisal_kind() in 0022_appraisal_forms.sql. */
export function kindFor(businessType: string | null | undefined): FormKind | null {
  return businessType === "Jewellery" ? "jewellery" : businessType === "Automobiles" || businessType === "Cycles" ? "automobile" : null;
}

/** Fields the approval steps rely on. Admins can reword them but not remove them or change their type. */
export const LOCKED_FIELDS: Record<string, FieldType> = {
  "interview.presentation_done": "check", "signoff.staff_signed": "check", "signoff.incharge_signed": "check",
};

/** Checks an edited form and tidies it. New fields get a key; existing keys never change, so answers stay matched. */
export function sanitizeForm(kind: FormKind, input: AppraisalForm, version: string): { form?: AppraisalForm; error?: string } {
  const types = new Set(FIELD_TYPES.map((t) => t.value));
  const sections: AppraisalSection[] = [];
  const sectionKeys = new Set<string>();
  for (const [si, sec] of (input.sections ?? []).entries()) {
    const title = String(sec.title ?? "").trim().slice(0, 120);
    if (!title) return { error: `Section ${si + 1} needs a title.` };
    const key = /^[a-z][a-z0-9_]{0,39}$/.test(sec.key ?? "") ? sec.key : `s${si + 1}_${Math.random().toString(36).slice(2, 7)}`;
    if (sectionKeys.has(key)) return { error: `Two sections share the key ${key}.` };
    sectionKeys.add(key);
    const fieldKeys = new Set<string>();
    const fields: AppraisalField[] = [];
    for (const f of sec.fields ?? []) {
      const label = String(f.label ?? "").trim().slice(0, 300);
      if (!label) return { error: `A question in “${title}” has no wording.` };
      if (!types.has(f.type)) return { error: `“${label}” has an unknown answer type.` };
      let fk = /^[a-z][a-z0-9_]{0,39}$/.test(f.key ?? "") ? f.key : "";
      while (!fk || fieldKeys.has(fk)) fk = `q_${Math.random().toString(36).slice(2, 8)}`;
      fieldKeys.add(fk);
      fields.push({ key: fk, label, type: f.type });
    }
    const years = sec.years === "past" || sec.years === "next" ? sec.years : undefined;
    sections.push({ key, title, ...(years ? { years } : {}), fields });
  }
  for (const [k, type] of Object.entries(LOCKED_FIELDS)) {
    const [sk, fk] = k.split(".");
    const f = sections.find((s) => s.key === sk)?.fields.find((x) => x.key === fk);
    if (!f || f.type !== type) return { error: "The 2-minute talk and both signature tick boxes must stay on the form." };
  }
  const title = String(input.title ?? "").trim().slice(0, 120) || DEFAULT_FORMS[kind].title;
  return { form: { kind, version, title, sections } };
}

/** Appraisal year for a date: April to March, e.g. 27 Oct 2026 -> "2026-27". */
export function cycleFor(date: string): string {
  const [y, m] = date.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** The two years before a cycle, oldest first: "2026-27" -> ["2024-25", "2025-26"]. */
export function pastYears(cycle: string): [string, string] {
  const start = Number(cycle.slice(0, 4));
  return [cycleFor(`${start - 2}-04-01`), cycleFor(`${start - 1}-04-01`)];
}

export type Answers = Record<string, unknown>;

/** Where a field's answer lives: past-year fields are stored per year ("past.2025-26.late"). */
export function answerKey(section: AppraisalSection, field: AppraisalField, year?: string): string {
  return section.years === "past" ? `${section.key}.${year}.${field.key}` : `${section.key}.${field.key}`;
}

/** Keeps only answers the form knows, with the right type. Grades are good / average / poor. */
export function cleanAnswers(form: AppraisalForm, cycle: string, raw: Answers): Answers {
  const out: Answers = {};
  for (const s of form.sections) {
    const years = s.years === "past" ? pastYears(cycle) : [undefined];
    for (const y of years) for (const f of s.fields) {
      if (f.type === "heading") continue;
      const k = answerKey(s, f, y);
      const v = raw[k];
      if (v === undefined || v === null || v === "") continue;
      if (f.type === "check") { if (v === true || v === "true") out[k] = true; continue; }
      if (f.type === "number") { const n = Number(v); if (Number.isFinite(n)) out[k] = n; continue; }
      if (f.type === "grade") { if (GRADES.some((g) => g.value === v)) out[k] = v; continue; }
      out[k] = String(v).trim().slice(0, 2000);
    }
  }
  return out;
}

/** What still blocks proposing a salary from this interview. Empty = ready. */
export function interviewGaps(answers: Answers, interviewOn: string | null): string[] {
  const gaps: string[] = [];
  if (!interviewOn) gaps.push("the interview date");
  if (answers["interview.presentation_done"] !== true) gaps.push("the 2-minute talk");
  if (answers["signoff.staff_signed"] !== true) gaps.push("the staff's signature");
  if (answers["signoff.incharge_signed"] !== true) gaps.push("the in-charge's signature");
  return gaps;
}

export type AppraisalStatus = "interviewed" | "proposed" | "approved" | "rejected";

export interface Appraisal {
  id: string;
  employment_id: string;
  cycle: string;
  status: AppraisalStatus;
  interview_on: string | null;
  interviewed_by: string;
  form: AppraisalForm;
  answers: Answers;
  current_designation: string | null;
  current_basic: number | null;
  current_allowances: number | null;
  proposed_designation: string | null;
  proposed_basic: number | null;
  proposed_allowances: number | null;
  effective_from: string | null;
  proposal_note: string | null;
  proposed_by: string | null;
  proposed_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

export const STATUS_LABEL: Record<AppraisalStatus, string> = {
  interviewed: "Interview done", proposed: "Waiting for admin", approved: "Approved", rejected: "Not approved",
};

/** Percentage rise in gross pay, one decimal. */
export function risePct(a: Pick<Appraisal, "current_basic" | "current_allowances" | "proposed_basic" | "proposed_allowances">): number | null {
  const before = (a.current_basic ?? 0) + (a.current_allowances ?? 0);
  if (!before || a.proposed_basic == null) return null;
  const after = a.proposed_basic + (a.proposed_allowances ?? 0);
  return Math.round(((after - before) / before) * 1000) / 10;
}
