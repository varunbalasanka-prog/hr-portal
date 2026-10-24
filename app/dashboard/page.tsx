import { requireProfile } from "@/lib/auth";
import { categorize } from "@/lib/categorize";
import type { Branch, Candidate, NotificationRow, OnboardingSubmission, Profile } from "@/lib/types";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { profile, supabase } = await requireProfile();

  const [cands, subs, branches, people, notifs, receipts] = await Promise.all([
    supabase.from("candidates").select("*").order("received_at", { ascending: false }).limit(5000),
    supabase.from("onboarding_submissions").select("*"),
    supabase.from("branches").select("*").order("name"),
    supabase.from("profiles").select("id, username, full_name, role, branch_id, mobile, photo_path").order("username"),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("notification_receipts").select("*").eq("username", profile.username),
  ]);

  const subByCand = new Map((subs.data as OnboardingSubmission[] ?? []).map((s) => [s.candidate_id, s]));
  const rows = (cands.data as Candidate[] ?? []).map((c) => ({ c, cat: categorize(c, subByCand.get(c.id)), onboarding: subByCand.get(c.id) ?? null }));

  const receiptBy = new Map((receipts.data ?? []).map((r) => [r.notification_id as number, r]));
  const notifications = (notifs.data as NotificationRow[] ?? [])
    .map((n) => ({ ...n, viewed_at: receiptBy.get(n.id)?.viewed_at ?? null, cleared_at: receiptBy.get(n.id)?.cleared_at ?? null }))
    .filter((n) => !n.cleared_at && (profile.role === "admin" || n.recipient === profile.username));

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
    />
  );
}
