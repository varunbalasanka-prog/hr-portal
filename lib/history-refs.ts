import type { SupabaseClient } from "@supabase/supabase-js";
import { employmentIds, isUuid, targetTable, type Refs } from "./history-format";

type Row = { action: string; target: string | null; detail: Record<string, unknown> | null };
type Named = { id: string; name: string };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
type Em = { employee?: { name?: string } | { name?: string }[] | null };
const personOf = (em: unknown) => one(one(em as Em | Em[] | null)?.employee)?.name ?? null;

/** Collects every id string anywhere in a logged value (keys too: branch_posts is keyed by store id). */
function idsIn(v: unknown, into: Set<string>) {
  if (isUuid(v)) into.add(v);
  else if (Array.isArray(v)) v.forEach((x) => idsIn(x, into));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (isUuid(k)) into.add(k); idsIn(x, into); }
}

/** Looks up the names behind the codes in the change history. Missing tables or deleted rows just stay unnamed. */
export async function loadHistoryRefs(supabase: SupabaseClient, rows: Row[], stores: Named[], logins: { id: string; username: string }[]): Promise<Refs> {
  const refs: Refs = {};
  const wanted = new Set<string>();
  rows.forEach((r) => idsIn(r.detail, wanted));
  for (const s of stores) if (wanted.has(s.id)) refs[s.id] = { label: s.name };
  for (const p of logins) if (wanted.has(p.id)) refs[p.id] = { label: p.username };

  const byTable: Record<string, Set<string>> = { candidates: new Set(), manpower_requests: new Set(), staff_loans: new Set(), appraisals: new Set(), employments: new Set() };
  for (const r of rows) {
    const t = targetTable(r.action);
    if (t && isUuid(r.target)) byTable[t].add(r.target);
    employmentIds(r.detail).forEach((id) => byTable.employments.add(id));
  }
  const list = (s: Set<string>) => [...s].slice(0, 300);
  const storeName = (id: string | null | undefined) => stores.find((s) => s.id === id)?.name;

  const [cands, requests, loans, appraisals, employments] = await Promise.all([
    byTable.candidates.size ? supabase.from("candidates").select("id, name").in("id", list(byTable.candidates)) : null,
    byTable.manpower_requests.size ? supabase.from("manpower_requests").select("id, post, kind, branch_id").in("id", list(byTable.manpower_requests)) : null,
    byTable.staff_loans.size ? supabase.from("staff_loans").select("id, post, to_branch_id, employment:employments(employee:employees(name))").in("id", list(byTable.staff_loans)) : null,
    byTable.appraisals.size ? supabase.from("appraisals").select("id, cycle, employment:employments(employee:employees(name))").in("id", list(byTable.appraisals)) : null,
    byTable.employments.size ? supabase.from("employments").select("id, employee:employees(name)").in("id", list(byTable.employments)) : null,
  ]);

  for (const c of (cands?.data ?? []) as Named[]) refs[c.id] = { label: c.name, href: `/dashboard?open=${c.id}` };
  for (const m of (requests?.data ?? []) as { id: string; post: string; kind?: string; branch_id: string }[]) {
    const store = storeName(m.branch_id);
    const what = m.kind === "temporary" ? "Temporary staff request" : `${m.post} request`;
    refs[m.id] = { label: store ? `${what}, ${store}` : what, href: "/manpower" };
  }
  for (const l of (loans?.data ?? []) as { id: string; post: string; to_branch_id: string; employment: unknown }[]) {
    const who = personOf(l.employment);
    const store = storeName(l.to_branch_id);
    refs[l.id] = { label: [who, l.post && `as ${l.post}`, store && `at ${store}`].filter(Boolean).join(" ") || "Staff loan", href: "/manpower" };
  }
  for (const a of (appraisals?.data ?? []) as { id: string; cycle: string; employment: unknown }[]) {
    const [y, m] = a.cycle.split("-");
    const cycle = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-GB", { month: "short", year: "numeric" });
    refs[a.id] = { label: `${personOf(a.employment) ?? "Appraisal"}, ${cycle} appraisal`, href: "/staff" };
  }
  for (const e of (employments?.data ?? []) as { id: string; employee: unknown }[]) {
    const name = one(e.employee as { name?: string } | null)?.name;
    if (name) refs[e.id] = { label: name };
  }
  return refs;
}
