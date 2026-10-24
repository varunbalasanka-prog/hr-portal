import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { ApplyForm, type BranchOption } from "./form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Apply for a job · Balasanka Group" };

export default async function ApplyPage() {
  const { data } = await createPublicClient().rpc("public_branches");
  const branches = (data ?? []) as BranchOption[];
  return (
    <main className="mx-auto max-w-2xl p-3 sm:p-6">
      <div className="card overflow-hidden">
        <div className="bg-brand px-4 py-3 text-center text-white">
          <div className="font-serif font-extrabold uppercase tracking-wide">Balasanka Group of Companies</div>
          <div className="text-xs text-slate-300">Job application / வேலை விண்ணப்பம்</div>
        </div>
        <div className="p-4"><ApplyForm branches={branches} /></div>
      </div>
    </main>
  );
}
