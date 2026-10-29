import { StaffPage } from "@/components/staff-page";
import { requireAdmin } from "@/lib/auth";
import type { Branch, Profile } from "@/lib/types";
import type { AdminQuestion } from "@/lib/apply-questions";
import { AdminPanel } from "./panel";
import type { WalkinRequestRow } from "./walkins";
import type { OpeningRow, RoleRow } from "./job-listings";
import type { AuditRow } from "./history";
import { DEFAULT_WARN_AGE } from "@/lib/walkin";
import { firmRoleNames, loadFirmRoles } from "@/lib/job-roles";
import { divisionOf } from "@/lib/staff";
import { DEFAULT_CONTACT, cleanRetention, type PrivacyContact } from "@/lib/privacy";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { supabase, profile } = await requireAdmin();
  const [{ data: people }, { data: notifs }, { data: receipts }, { data: questions }, { data: settings }, { data: branches }, { data: history }, { data: walkins }, openings, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").order("role").order("username"),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("notification_receipts").select("*").not("viewed_at", "is", null),
    supabase.from("application_questions").select("*").order("sort_order").order("created_at"),
    supabase.from("app_settings").select("key, value").in("key", ["apply_posts", "branch_posts", "privacy_contact", "retention_months", "walkin_warn_age"]),
    supabase.from("branches").select("*").order("town").order("name"),
    profile.role === "superadmin"
      ? supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(300)
      : Promise.resolve({ data: null }),
    supabase.from("walkin_requests").select("id, status, reason, requested_by, created_at, decided_by, payload, candidate:candidates(name, mobile), branch:branches(name)")
      .order("created_at", { ascending: false }).limit(50),
    // Missing until 0024 runs; the Job listings tab then says so.
    supabase.from("job_openings").select("id, branch_id, post, opened_at, closes_on, salary_min, salary_max").is("closed_at", null).order("post"),
    supabase.from("job_roles").select("name, summary, duties, requirements, shift, benefits").order("sort").order("name"),
  ]);
  const setting = (k: string) => settings?.find((r) => r.key === k)?.value;
  // Null until 0025 runs; each store then gets its firm's roles for Store posts.
  const firmRoles = await loadFirmRoles(supabase);
  const stores = ((branches as Branch[]) ?? []).map((b) => firmRoles ? { ...b, roles: firmRoleNames(firmRoles.roles, firmRoles.firms[divisionOf(b)] ?? []) } : b);
  const viewed = new Map((receipts ?? []).filter((r) => r.viewed_at).map((r) => [`${r.notification_id}:${r.username}`, r.viewed_at as string]));
  const log = (notifs ?? []).map((n) => ({ ...n, viewed_at: viewed.get(`${n.id}:${n.recipient}`) ?? null }));
  return (
    <StaffPage me={profile} active="admin" title={profile.role === "superadmin" ? "Super admin settings" : "Admin settings"}
      subtitle="Walk-in approvals, job roles, open posts, job listings, the application form, logins and privacy.">
      <AdminPanel walkins={(walkins as unknown as WalkinRequestRow[]) ?? []}
        warnAge={settings?.some((r) => r.key === "walkin_warn_age") ? ((setting("walkin_warn_age") as number) || null) : DEFAULT_WARN_AGE} me={profile} history={(history as AuditRow[] | null) ?? null} people={(people as Profile[]) ?? []} log={log} questions={(questions as AdminQuestion[]) ?? []} posts={(setting("apply_posts") as string[]) ?? []}
        branches={stores} branchPosts={(setting("branch_posts") as Record<string, string[]>) ?? {}}
        roles={firmRoles} jobs={{ ready: !openings.error, openings: (openings.data as OpeningRow[] | null) ?? [], roles: (roles as RoleRow[] | null) ?? [] }}
        privacyContact={{ ...DEFAULT_CONTACT, ...((setting("privacy_contact") as Partial<PrivacyContact>) ?? {}) }} retentionMonths={cleanRetention(setting("retention_months"))} />
    </StaffPage>
  );
}
