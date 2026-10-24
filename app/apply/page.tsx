import type { Metadata } from "next";
import { loadApplyConfig } from "./config";
import { ApplyForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Apply for a job · Balasanka Group",
  description: "Jobs at Balasanka Group showrooms in Theni, Madurai, Virudhunagar, Sivakasi, Rajapalayam, Tenkasi and Tirunelveli. Apply online in 5 minutes. / வேலைக்கு விண்ணப்பிக்கவும்.",
  openGraph: {
    title: "Jobs at Balasanka Group · வேலைவாய்ப்பு",
    description: "Apply online in 5 minutes for jobs at our showrooms across South Tamil Nadu.",
    images: ["/balasanka_logo.png"], locale: "en_IN", type: "website",
  },
};

export default async function ApplyPage() {
  const config = await loadApplyConfig();
  return (
    <main className="mx-auto max-w-2xl p-3 sm:p-6">
      <div className="card overflow-hidden">
        <div className="bg-brand px-4 py-3 text-center text-white">
          <div className="font-serif font-extrabold uppercase tracking-wide">Balasanka Group of Companies</div>
          <div className="text-xs text-slate-300">Job application / வேலை விண்ணப்பம்</div>
        </div>
        <div className="p-4">
          {config ? <ApplyForm {...config} /> : <p className="py-6 text-center text-sm text-red-700">The form could not load. Please refresh the page.</p>}
        </div>
      </div>
    </main>
  );
}
