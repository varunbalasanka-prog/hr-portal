import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import type { Branch, Profile } from "@/lib/types";
import type { AdminQuestion } from "@/lib/apply-questions";
import { AdminPanel } from "./panel";
import type { AuditRow } from "./history";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { supabase, profile } = await requireAdmin();
  const [{ data: people }, { data: notifs }, { data: receipts }, { data: questions }, { data: settings }, { data: branches }, { data: history }] = await Promise.all([
    supabase.from("profiles").select("*").order("role").order("username"),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("notification_receipts").select("*").not("viewed_at", "is", null),
    supabase.from("application_questions").select("*").order("sort_order").order("created_at"),
    supabase.from("app_settings").select("key, value").in("key", ["apply_posts", "branch_posts"]),
    supabase.from("branches").select("*").order("town").order("name"),
    profile.role === "superadmin"
      ? supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(300)
      : Promise.resolve({ data: null }),
  ]);
  const setting = (k: string) => settings?.find((r) => r.key === k)?.value;
  const viewed = new Map((receipts ?? []).filter((r) => r.viewed_at).map((r) => [`${r.notification_id}:${r.username}`, r.viewed_at as string]));
  const log = (notifs ?? []).map((n) => ({ ...n, viewed_at: viewed.get(`${n.id}:${n.recipient}`) ?? null }));
  return (
    <div>
      <header className="flex items-center justify-between bg-brand px-4 py-3 text-white">
        <h1 className="font-bold">{profile.role === "superadmin" ? "Super admin" : "Admin"}: logins, application form &amp; notification log</h1>
        <Link href="/dashboard" className="btn-outline !py-1">← Dashboard</Link>
      </header>
      <AdminPanel me={profile} history={(history as AuditRow[] | null) ?? null} people={(people as Profile[]) ?? []} log={log} questions={(questions as AdminQuestion[]) ?? []} posts={(setting("apply_posts") as string[]) ?? []}
        branches={(branches as Branch[]) ?? []} branchPosts={(setting("branch_posts") as Record<string, string[]>) ?? {}} />
    </div>
  );
}
