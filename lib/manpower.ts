// Temporary (festival) staff requests (0021_temporary_staff.sql): pure helpers shared by the Manpower page and its actions.

export type TempRole = { post: string; headcount: number };

export interface StaffLoan {
  id: string;
  request_id: string;
  employment_id: string;
  post: string;
  name: string;
  employee_code: string | null;
  mobile: string | null;       // null for store logins
  designation: string | null;  // their own role at the home store
  from_branch_id: string;
  to_branch_id: string;
  start_date: string;
  end_date: string;
  returned_on: string | null;  // sent back early
  assigned_by: string;
}

export const MAX_TEMP_PEOPLE = 50;

/** Trims, merges repeated roles and checks the numbers. Returns the roles, or a message saying what is wrong. */
export function cleanTempRoles(roles: TempRole[]): TempRole[] | string {
  const merged = new Map<string, TempRole>();
  for (const r of roles ?? []) {
    const post = String(r.post ?? "").trim().slice(0, 80);
    const n = Math.round(Number(r.headcount));
    if (!post) continue;
    if (!(n >= 1)) return `Enter how many people for ${post}.`;
    const key = post.toLowerCase();
    const prev = merged.get(key);
    merged.set(key, { post: prev?.post ?? post, headcount: (prev?.headcount ?? 0) + n });
  }
  const list = [...merged.values()];
  if (!list.length) return "Add at least one role.";
  if (list.reduce((t, r) => t + r.headcount, 0) > MAX_TEMP_PEOPLE) return `At most ${MAX_TEMP_PEOPLE} people in one request.`;
  return list;
}

export function loanLastDay(l: Pick<StaffLoan, "returned_on" | "end_date">): string {
  return l.returned_on ?? l.end_date;
}

/** Where a loan stands on a given day. */
export function loanState(l: Pick<StaffLoan, "start_date" | "end_date" | "returned_on">, today: string): "upcoming" | "on loan" | "back" {
  if (today < l.start_date) return "upcoming";
  return today <= loanLastDay(l) ? "on loan" : "back";
}

/** How many people each role still needs. */
export function stillNeeded(roles: TempRole[], loans: Pick<StaffLoan, "post">[]): TempRole[] {
  return roles.map((r) => ({ post: r.post, headcount: Math.max(0, r.headcount - loans.filter((l) => l.post === r.post).length) }));
}
