// Staff register (0019_staff_records.sql): each stint at the company with its dated store / role / salary lines.
// Pure functions for the Staff page: which tab a person belongs to for a store, a division or the whole group.

export type ExitType = "resigned" | "absconded" | "terminated" | "retired" | "other";

export interface StaffPosition {
  id: number;
  branch_id: string;
  designation: string | null;
  basic: number | null;       // null for store logins
  allowances: number | null;
  from_date: string;
  to_date: string | null;     // last day in this line; null = current
  change_type: string;
  reason: string | null;
  entered_by: string;
}

export interface StaffStint {
  id: string;
  employee_id: string;
  candidate_id: string | null;
  name: string;
  mobile: string | null;
  source: "portal" | "import";
  employee_code: string | null;
  joined_on: string;
  left_on: string | null;
  exit_type: ExitType | null;
  exit_reason: string | null;
  rehire: "yes" | "no" | "not sure" | null;
  confirmation_date: string | null;
  confirmed: boolean;
  positions: StaffPosition[];
}

export type BranchLite = { id: string; name: string; division?: string | null };

/** What the page is looking at: one store, one division, or every store the user may see. */
export type Scope = { kind: "branch"; id: string } | { kind: "division"; name: string } | { kind: "all" };

export type Placement =
  | { tab: "current"; position: StaffPosition; since: string }
  | { tab: "past"; position: StaffPosition; why: "left" | "other division"; to?: string }
  | { tab: "moved"; position: StaffPosition; to: string };

export const EXIT_LABEL: Record<ExitType, string> = {
  resigned: "Resigned", absconded: "Left without information", terminated: "Terminated", retired: "Retired", other: "Other",
};

export const CHANGE_LABEL: Record<string, string> = {
  joined: "Joined", transfer: "Transfer", promotion: "Promotion", increment: "Increment", "role change": "Role change",
  demotion: "Demotion", "salary change": "Salary change", correction: "Correction",
};

export function divisionOf(b: BranchLite | undefined): string {
  if (!b) return "";
  return (b.division?.trim() || b.name.split(" - ")[0].trim());
}

function sorted(s: StaffStint): StaffPosition[] {
  return [...s.positions].sort((a, b) => a.from_date.localeCompare(b.from_date) || a.id - b.id);
}

/**
 * Where a stint shows for a scope.
 *  - current: working, and the open line is in scope
 *  - past: their time in scope ended because they left the company, or (for a store) they moved to another division,
 *          or (for a division) they moved out of it
 *  - moved: (store only) they moved to another store in the same division, which is not a loss
 * null: the stint never touched the scope.
 */
export function placement(s: StaffStint, scope: Scope, branches: Map<string, BranchLite>): Placement | null {
  const lines = sorted(s);
  const inScope = (p: StaffPosition) =>
    scope.kind === "all" ? true
      : scope.kind === "branch" ? p.branch_id === scope.id
      : divisionOf(branches.get(p.branch_id)) === scope.name;

  const open = s.left_on ? undefined : lines.find((p) => p.to_date === null);
  if (open && inScope(open)) {
    // Since when they have been in scope without a break.
    let i = lines.indexOf(open);
    while (i > 0 && inScope(lines[i - 1])) i--;
    return { tab: "current", position: open, since: lines[i].from_date };
  }

  let k = -1;
  lines.forEach((p, i) => { if (inScope(p)) k = i; });
  if (k < 0) return null;
  const last = lines[k];
  const next = lines[k + 1];
  if (!next) return { tab: "past", position: last, why: "left" };
  const toName = branches.get(next.branch_id)?.name ?? "another store";
  if (scope.kind === "branch" && divisionOf(branches.get(next.branch_id)) === divisionOf(branches.get(last.branch_id))) {
    return { tab: "moved", position: last, to: toName };
  }
  return { tab: "past", position: last, why: "other division", to: toName };
}

/** Whole months between two dates (YYYY-MM-DD), for tenure. */
export function monthsBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
}

/** "2 yr 3 mo", "5 mo", "under 1 mo". */
export function tenureLabel(from: string, to: string): string {
  const m = monthsBetween(from, to);
  if (m === 0) return "under 1 mo";
  const y = Math.floor(m / 12), r = m % 12;
  return [y ? `${y} yr` : "", r ? `${r} mo` : ""].filter(Boolean).join(" ");
}
