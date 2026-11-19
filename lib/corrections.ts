/** Admin corrections (0041_admin_corrections.sql): what can be corrected, and the statuses an admin can set back. */

export const CANDIDATE_FIELDS = ["name", "mobile", "email", "address", "father_name", "marital_status"] as const;
export type CandidateField = (typeof CANDIDATE_FIELDS)[number];

export const CANDIDATE_FIELD_LABELS: Record<CandidateField, string> = {
  name: "Name",
  mobile: "Mobile",
  email: "Email",
  address: "Address",
  father_name: "Father / husband",
  marital_status: "Marital status",
};

export type StatusTarget = "followup" | "interview" | "selected" | "joined";

export const STATUS_TARGETS: { value: StatusTarget; label: string; needs?: "at" | "date"; dateLabel?: string }[] = [
  { value: "followup", label: "Back to follow-up (screening calls start again)" },
  { value: "interview", label: "Interview scheduled", needs: "at", dateLabel: "Interview date and time" },
  { value: "selected", label: "Selected, waiting to join", needs: "date", dateLabel: "Expected joining date" },
  { value: "joined", label: "Joined (working)", needs: "date", dateLabel: "Joining date" },
];

/** Onboarding details an admin may correct: the ones already filled, plus the standard typed details. */
export function onboardingKeys(details: Record<string, unknown> | null | undefined, standard: string[]): string[] {
  const filled = Object.keys(details ?? {}).filter((k) => k !== "consent_version");
  return [...filled, ...standard.filter((k) => !filled.includes(k))];
}

/** Only the values that actually changed (trimmed), so an untouched field is never sent. */
export function changedFields(before: Record<string, string | null | undefined>, after: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(after)) {
    if ((v ?? "").trim() !== (before[k] ?? "").toString().trim()) out[k] = v.trim();
  }
  return out;
}

export const reasonOk = (r: string) => r.trim().length >= 3;
