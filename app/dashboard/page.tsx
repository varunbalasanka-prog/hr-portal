import { requireProfile } from "@/lib/auth";
import { categorize } from "@/lib/categorize";
import { fetchAll } from "@/lib/fetch-all";
import { CANDIDATE_COLUMNS, isAdminRole, type Branch, type Candidate, type NotificationRow, type OnboardingSubmission, type Profile } from "@/lib/types";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ list?: string }> }) {
  const { list } = await searchParams;
  const { profile, supabase } = await requireProfile();

  const [cands, subs, branches, people, notifs, receipts] = await Promise.all([
    fetchAll<Candidate>((f, t) => supabase.from("candidates").select(CANDIDATE_COLUMNS).order("received_at", { ascending: false }).order("id").range(f, t).returns<Candidate[]>()),
    fetchAll<OnboardingSubmission>((f, t) => supabase.from("onboarding_submissions").select("*").order("id").range(f, t)),
    supabase.from("branches").select("*").order("name"),
    supabase.from("profiles").select("id, username, full_name, role, branch_id, mobile, photo_path").order("username"),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("notification_receipts").select("*").eq("username", profile.username),
  ]);

  const subByCand = new Map(subs.map((s) => [s.candidate_id, s]));
  const rows = cands.map((c) => ({ c, cat: categorize(c, subByCand.get(c.id)), onboarding: subByCand.get(c.id) ?? null }));

  const receiptBy = new Map((receipts.data ?? []).map((r) => [r.notification_id as number, r]));
  const notifications = (notifs.data as NotificationRow[] ?? [])
    .map((n) => ({ ...n, viewed_at: receiptBy.get(n.id)?.viewed_at ?? null, cleared_at: receiptBy.get(n.id)?.cleared_at ?? null }))
    .filter((n) => !n.cleared_at && (isAdminRole(profile.role) || n.recipient === profile.username));

  let photoUrl: string | null = null;
  if (profile.photo_path) {
    const { data } = await supabase.storage.from("avatars").createSignedUrl(profile.photo_path, 3600);
    photoUrl = data?.signedUrl ?? null;
  }

  return (
    <Dashboard
      me={profile}
      photoUrl={photoUrl}
      rows={rows}
      branches={(branches.data as Branch[]) ?? []}
      people={(people.data as Profile[]) ?? []}
      notifications={notifications}
      appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""}
      initialList={list}
    />
  );
}
