import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lookupToken } from "@/lib/candidate-token";
import { DOC_LABELS } from "@/lib/onboarding";
import { ExpiredLink } from "@/components/letterhead";
import { OnboardingForm } from "./form";
import { digilockerEnabled } from "@/lib/digilocker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Candidate onboarding · Balasanka Group", robots: { index: false } };

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ dl?: string; dl_error?: string }> };

/** Paths DigiLocker saved for this token, passed back in ?dl=. Anything outside the token's folder is ignored
 *  (the database checks the same when the form is submitted). */
function fetchedPaths(token: string, dl?: string): Record<string, string> {
  if (!dl) return {};
  try {
    const raw = JSON.parse(Buffer.from(dl, "base64url").toString()) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(raw).filter(([k, v]) => k in DOC_LABELS && typeof v === "string" && v.startsWith(`${token}/`) && !v.includes("..")) as [string, string][]);
  } catch {
    return {};
  }
}

export default async function OnboardPage({ params, searchParams }: Props) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const found = await lookupToken(token);
  if (!found) notFound();
  if (found.expired) return <ExpiredLink />;
  const { candidate: c, branch, onboarding: sub } = found;
  if (sub && sub.status !== "pending") {
    return (
      <Shell>
        <h2 className="mb-2 text-lg font-bold text-green-700">Already submitted / ஏற்கனவே சமர்ப்பிக்கப்பட்டது</h2>
        <p className="text-sm text-slate-700">Dear <b>{c.name}</b>, your onboarding documents have been submitted. This link is now locked.</p>
        <p className="text-sm text-slate-600">உங்கள் ஆவணங்கள் சமர்ப்பிக்கப்பட்டன. இந்த இணைப்பு இப்போது பூட்டப்பட்டுள்ளது.</p>
      </Shell>
    );
  }
  return (
    <Shell>
      {sub?.status === "pending" && (
        <div className="mb-4 rounded bg-amber-50 p-3 text-sm text-amber-900" role="status">
          HR asked you to re-upload / மீண்டும் பதிவேற்றவும்: <b>{sub.missing_docs.map((k) => DOC_LABELS[k] ?? k).join(", ")}</b>.
          Your other documents are already saved. / மற்ற ஆவணங்கள் சேமிக்கப்பட்டுள்ளன.
        </div>
      )}
      <OnboardingForm token={token} resubmit={sub?.status === "pending"} digilocker={digilockerEnabled()} fetched={fetchedPaths(token, sp.dl)} fetchError={!!sp.dl_error} cand={{
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
          <h1 className="font-serif font-extrabold uppercase tracking-wide">Balasanka Group of Companies</h1>
          <div className="text-xs text-slate-300">Candidate onboarding form / பணியில் சேர்வதற்கான படிவம்</div>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </main>
  );
}
