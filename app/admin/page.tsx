import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { AdminPanel } from "./panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const [{ data: people }, { data: notifs }, { data: receipts }] = await Promise.all([
    supabase.from("profiles").select("*").order("role").order("username"),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("notification_receipts").select("*").not("viewed_at", "is", null),
  ]);
  const viewed = new Map((receipts ?? []).filter((r) => r.viewed_at).map((r) => [`${r.notification_id}:${r.username}`, r.viewed_at as string]));
  const log = (notifs ?? []).map((n) => ({ ...n, viewed_at: viewed.get(`${n.id}:${n.recipient}`) ?? null }));
  return (
    <div>
      <header className="flex items-center justify-between bg-brand px-4 py-3 text-white">
        <h1 className="font-bold">Admin: users &amp; notification log</h1>
        <Link href="/dashboard" className="btn-outline !py-1">← Dashboard</Link>
      </header>
      <AdminPanel people={(people as Profile[]) ?? []} log={log} />
    </div>
  );
}
