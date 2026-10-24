import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { categorize } from "@/lib/categorize";
import { fetchAll } from "@/lib/fetch-all";
import { toCsv } from "@/lib/csv";
import { sourceLabel } from "@/lib/sources";
import { CANDIDATE_COLUMNS, type Branch, type Candidate } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Admin download of every candidate the admin can see, for Excel. ?from=YYYY-MM-DD&to=YYYY-MM-DD filters by date received. */
export async function GET(req: NextRequest) {
  const { supabase, profile } = await requireAdmin();
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  const [cands, { data: branches }] = await Promise.all([
    fetchAll<Candidate>((f, t) => supabase.from("candidates").select(CANDIDATE_COLUMNS).order("received_at").order("id").range(f, t).returns<Candidate[]>()),
    supabase.from("branches").select("id, name"),
  ]);
  const bName = new Map(((branches ?? []) as Pick<Branch, "id" | "name">[]).map((b) => [b.id, b.name]));
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
  const rows = cands
    .filter((c) => (!/^\d{4}-\d{2}-\d{2}$/.test(from) || c.received_at.slice(0, 10) >= from) && (!/^\d{4}-\d{2}-\d{2}$/.test(to) || c.received_at.slice(0, 10) <= to))
    .map((c) => [
      day(c.received_at), c.name, c.mobile, c.source, sourceLabel(c.source_channel), c.referred_by, c.posts.join("; "), c.applied_locations.join("; "),
      (c.branch_id && bName.get(c.branch_id)) || "", c.assigned_hr, categorize(c).label, c.pipeline_status, c.rejection_reason,
      day(c.first_call_at), day(c.interview_at), c.designation, day(c.expected_joining_date), day(c.actual_joining_date),
      c.offer_response, c.employment_status, c.left_type, day(c.relieving_date), c.talent_pool ? "yes" : "", c.talent_tags.join("; "),
    ]);
  const csv = toCsv([[
    "Received", "Name", "Mobile", "Online / walk-in", "Heard about us", "Referred by", "Posts", "Applied locations", "Branch", "HR",
    "List", "Status", "Reason", "First call", "Interview", "Designation", "Expected joining", "Joined on", "Offer reply",
    "Employment", "Left type", "Relieving date", "Talent pool", "Tags",
  ], ...rows]);
  await supabase.rpc("log_export", { p_rows: rows.length }).then(() => null, () => null);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="balasanka-candidates-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
      "X-Exported-By": profile.username,
    },
  });
}
