import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { categorize } from "@/lib/categorize";
import { fetchAll } from "@/lib/fetch-all";
import { CANDIDATE_COLUMNS, type Branch, type Candidate } from "@/lib/types";
import { Reports, type ReportRow } from "./reports";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const { supabase } = await requireAdmin();
  const [cands, { data: branches }, { data: hrs }] = await Promise.all([
    fetchAll<Candidate>((f, t) => supabase.from("candidates").select(CANDIDATE_COLUMNS).order("id").range(f, t).returns<Candidate[]>()),
    supabase.from("branches").select("*").order("name"),
    supabase.from("profiles").select("username").in("role", ["hr", "admin", "superadmin"]),
  ]);
  const bName = new Map((branches as Branch[] ?? []).map((b) => [b.id, b.name]));
  const rows = cands.map((c) => {
    const cat = categorize(c);
    const bucket: ReportRow["bucket"] = cat.active ? "in_followup" : cat.category.endsWith("joined_list") ? "completed" : "dropped";
    return {
      name: c.name, mobile: c.mobile, hr: c.assigned_hr, source: c.source, received: c.received_at.slice(0, 10),
      location: (c.branch_id && bName.get(c.branch_id)) || c.applied_locations[0] || "Unassigned",
      status: c.pipeline_status, reason: c.rejection_reason ?? "", bucket,
    };
  });
  return (
    <div>
      <header className="flex items-center justify-between bg-brand px-4 py-3 text-white">
        <h1 className="font-bold">Reports &amp; analytics</h1>
        <Link href="/dashboard" className="btn-outline !py-1">← Dashboard</Link>
      </header>
      <Reports rows={rows} branches={(branches as Branch[] ?? []).map((b) => b.name)} hrs={(hrs ?? []).map((h) => h.username)} />
    </div>
  );
}
