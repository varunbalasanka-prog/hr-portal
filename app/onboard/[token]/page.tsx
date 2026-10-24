import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Candidate, OnboardingSubmission } from "@/lib/types";
import { DOC_LABELS } from "@/lib/onboarding";
import { OnboardingForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Candidate onboarding · Balasanka Group", robots: { index: false } };

export default async function OnboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const admin = createAdminClient();
  const { data: c } = await admin.from("candidates").select("*").eq("access_token", token).maybeSingle<Candidate>();
  if (!c) notFound();
  const { data: sub } = await admin.from("onboarding_submissions").select("status, missing_docs").eq("candidate_id", c.id).maybeSingle<Pick<OnboardingSubmission, "status" | "missing_docs">>();
  const { data: branch } = c.branch_id ? await admin.from("branches").select("name").eq("id", c.branch_id).maybeSingle() : { data: null };

  if (sub && sub.status !== "pending") {
    return (
      <Shell>
        <h2 className="mb-2 text-lg font-bold text-green-700">Already submitted</h2>
        <p className="text-sm text-slate-600">Dear <b>{c.name}</b>, your onboarding documents have been submitted. This link is now locked.</p>
      </Shell>
    );
  }
  return (
    <Shell>
      {sub?.status === "pending" && (
        <div className="mb-4 rounded bg-amber-50 p-3 text-sm text-amber-900">
          HR asked you to re-upload: <b>{sub.missing_docs.map((k) => DOC_LABELS[k] ?? k).join(", ")}</b>. Your other documents are already saved.
        </div>
      )}
      <OnboardingForm token={token} resubmit={sub?.status === "pending"} cand={{
        name: c.name, mobile: c.mobile, branch: branch?.name ?? c.applied_locations[0] ?? "", address: c.address ?? "",
        father_name: c.father_name ?? "", marital_status: c.marital_status ?? "", email: c.email ?? "",
      }} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl p-3 sm:p-6">
      <div className="card overflow-hidden">
        <div className="bg-brand px-4 py-3 text-center text-white">
          <div className="font-serif font-extrabold uppercase tracking-wide">Balasanka Group of Companies</div>
          <div className="text-xs text-slate-300">Candidate onboarding form</div>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </main>
  );
}
