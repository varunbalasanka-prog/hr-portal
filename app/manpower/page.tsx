import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { isAdminRole, type Branch } from "@/lib/types";
import { Manpower, type ManpowerRow } from "./manpower";

export const dynamic = "force-dynamic";

export default async function ManpowerPage() {
  const { profile, supabase } = await requireProfile();
  const [{ data: rows }, { data: branches }, { data: setting }] = await Promise.all([
    supabase.from("manpower_requests").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("branches").select("*").order("town").order("name"),
    supabase.from("app_settings").select("value").eq("key", "branch_posts").maybeSingle(),
  ]);
  return (
    <div>
      <header className="flex items-center justify-between bg-brand px-4 py-3 text-white">
        <h1 className="font-bold">Manpower requests</h1>
        <Link href="/dashboard" className="btn-outline !py-1">← Dashboard</Link>
      </header>
      <Manpower me={profile} admin={isAdminRole(profile.role)} rows={(rows as ManpowerRow[]) ?? []} branches={(branches as Branch[]) ?? []}
        posts={(setting?.value as Record<string, string[]>) ?? {}} />
    </div>
  );
}
