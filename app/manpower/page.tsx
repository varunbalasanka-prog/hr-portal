import { StaffPage } from "@/components/staff-page";
import { requireProfile } from "@/lib/auth";
import { todayIst } from "@/lib/dates";
import type { StaffLoan } from "@/lib/manpower";
import { isAdminRole, type Branch } from "@/lib/types";
import { withFirmRoles } from "@/lib/job-roles";
import { Manpower, type ManpowerRow } from "./manpower";

export const dynamic = "force-dynamic";

export default async function ManpowerPage() {
  const { profile, supabase } = await requireProfile();
  const [{ data: rows }, { data: branches }, { data: setting }, { data: loans, error: loansError }] = await Promise.all([
    supabase.from("manpower_requests").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("branches").select("*").order("town").order("name"),
    supabase.from("app_settings").select("value").eq("key", "branch_posts").maybeSingle(),
    supabase.rpc("staff_loans_list", { p_request: null }),
  ]);
  const stores = await withFirmRoles(supabase, (branches as Branch[]) ?? []);
  return (
    <StaffPage me={profile} active="manpower" title="Manpower requests"
      subtitle="Stores ask for permanent staff, or temporary staff from other stores for a festival rush.">
      <Manpower me={profile} admin={isAdminRole(profile.role)} canLend={isAdminRole(profile.role) || profile.role === "hr"}
        rows={(rows as ManpowerRow[]) ?? []} branches={stores}
        posts={(setting?.value as Record<string, string[]>) ?? {}} loans={(loans as StaffLoan[]) ?? []} today={todayIst()} tempReady={!loansError} />
    </StaffPage>
  );
}
