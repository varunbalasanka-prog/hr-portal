import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ONBOARDING_CATEGORIES, categorize } from "@/lib/categorize";
import { fetchAll } from "@/lib/fetch-all";
import { CANDIDATE_COLUMNS, type Branch, type Candidate } from "@/lib/types";
import { Reports, type ReportRow } from "./reports";
import { sourceLabel } from "@/lib/sources";
import { todayIst } from "@/lib/dates";
import { MissingWork, type MissedRow } from "./missing-work";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const { supabase } = await requireAdmin();
  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const [cands, { data: branches }, { data: hrs }, { data: missed }, { data: overdue }] = await Promise.all([
    fetchAll<Candidate>((f, t) => supabase.from("candidates").select(CANDIDATE_COLUMNS).order("id").range(f, t).returns<Candidate[]>()),
    supabase.from("branches").select("*").order("name"),
    supabase.from("profiles").select("username").in("role", ["hr", "admin", "superadmin"]),
    supabase.from("missed_work").select("day, hr, candidate, task, due_at, status").gte("day", since).order("day", { ascending: false }).limit(2000),
    supabase.rpc("overdue_now"),
  ]);
  const today = todayIst();
  const overdueRows = ((overdue ?? []) as Omit<MissedRow, "day">[]).map((r) => ({ ...r, day: today }));
  const bName = new Map((branches as Branch[] ?? []).map((b) => [b.id, b.name]));
  const rows = cands.map((c) => {
    const cat = categorize(c);
    const bucket: ReportRow["bucket"] = cat.active ? "in_followup" : cat.category.endsWith("joined_list") || ONBOARDING_CATEGORIES.includes(cat.category) ? "completed" : "dropped";
    return {
      name: c.name, mobile: c.mobile, hr: c.assigned_hr, source: c.source, received: c.received_at.slice(0, 10),
      location: (c.branch_id && bName.get(c.branch_id)) || c.applied_locations[0] || "Unassigned",
      status: c.pipeline_status, reason: c.rejection_reason ?? "", bucket,
      channel: c.source === "walkin" ? "Walk-in" : sourceLabel(c.source_channel), referred: !!c.referred_by,
      contacted: !!c.first_call_at || c.calling_status === "Contacted", interviewed: !!c.interview_at,
      offered: !!c.expected_joining_date || !!c.offer_response, joined: c.actual_joining_date?.slice(0, 10) ?? null, offer: c.offer_response,
    };
  });
  return (
    <div>
      <header className="flex items-center justify-between bg-brand px-4 py-3 text-white">
        <h1 className="font-bold">Reports &amp; analytics</h1>
        <Link href="/dashboard" className="btn-outline !py-1">← Dashboard</Link>
      </header>
      <MissingWork rows={(missed as MissedRow[]) ?? []} now={overdueRows} hrs={(hrs ?? []).map((h) => h.username)} />
      <Reports rows={rows} branches={(branches as Branch[] ?? []).map((b) => b.name)} hrs={(hrs ?? []).map((h) => h.username)} />
    </div>
  );
}
