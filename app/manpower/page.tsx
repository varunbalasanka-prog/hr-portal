import { StaffPage } from "@/components/staff-page";
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
    <StaffPage me={profile} active="manpower" title="Manpower requests"
      subtitle="Stores ask for staff here. Approved requests show as “Urgently hiring” on the careers page.">
      <Manpower me={profile} admin={isAdminRole(profile.role)} rows={(rows as ManpowerRow[]) ?? []} branches={(branches as Branch[]) ?? []}
        posts={(setting?.value as Record<string, string[]>) ?? {}} />
    </StaffPage>
  );
}
