// Appraisals (0020_appraisals.sql). A pay rise or promotion after joining happens only through an appraisal: HR or an
// admin records the interview on the store's form, proposes the new salary / role, and an admin approves it. The approved change becomes a
// dated line in the staff register. Each appraisal keeps a copy of the form it was filled on, so changing the form
// later never changes past appraisals.
// The form follows the store's business type. The jewellery form is the branches' paper "Appraisal form 2026"
// (Akshaya Velli Theni). Automobile stores get theirs once varun approves its draft.

export type FieldType = "number" | "text" | "grade" | "check";
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

/** Forms in use. A business type with no form here has no appraisals (its salaries change the old way). */
export const FORMS: Partial<Record<FormKind, AppraisalForm>> = { jewellery: JEWELLERY_FORM };

/** Same mapping as appraisal_kind() in 0020_appraisals.sql. */
export function formFor(businessType: string | null | undefined): AppraisalForm | null {
  return businessType === "Jewellery" ? JEWELLERY_FORM : null;
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
