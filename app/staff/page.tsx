import { StaffPage } from "@/components/staff-page";
import { requireProfile } from "@/lib/auth";
import { isAdminRole, type Branch } from "@/lib/types";
import type { StaffStint } from "@/lib/staff";
import { currentForms, type Appraisal, type AppraisalForm } from "@/lib/appraisal";
import { todayIst } from "@/lib/dates";
import { StaffRegister } from "./register";

export const dynamic = "force-dynamic";

export default async function StaffRegisterPage() {
  const { profile, supabase } = await requireProfile();
  const store = profile.role === "branch";
  const [{ data: stints, error }, { data: branches }, { data: appraisals }, { data: forms }] = await Promise.all([
    supabase.rpc("staff_register", { p_branch: store ? profile.branch_id : null }),
    supabase.from("branches").select("*").order("town").order("name"),
    // Appraisals hold salaries: HR and admins only (0020). Null until 0020 is run.
    store ? Promise.resolve({ data: null }) : supabase.rpc("appraisal_list"),
    store ? Promise.resolve({ data: null }) : supabase.from("appraisal_forms").select("kind, form"),
  ]);
  return (
    <StaffPage me={profile} active="staff" title="Staff"
      subtitle={store ? "Who works at your store now, who left, and who moved to another store." : "Current and past staff of every store, with each person's moves and pay changes."}>
      {error
        ? <div className="mx-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:mx-6">The staff register isn&apos;t set up yet. An admin needs to run 0019_staff_records.sql in Supabase.</div>
        : <StaffRegister me={profile} admin={isAdminRole(profile.role)} stints={(stints as StaffStint[]) ?? []} appraisals={appraisals as Appraisal[] | null} forms={currentForms(forms as { kind: string; form: AppraisalForm }[] | null)} branches={(branches as Branch[]) ?? []} today={todayIst()} />}
    </StaffPage>
  );
}
