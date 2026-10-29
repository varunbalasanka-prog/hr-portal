import type { Metadata } from "next";
import { loadApplyConfig } from "./config";
import { ApplyForm } from "./form";
import { cleanSource } from "@/lib/sources";
import { SITE_NAME } from "@/lib/careers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Apply for a job · Balasanka Group",
  description: "Jobs at Balasanka Group showrooms in Theni, Madurai, Virudhunagar, Sivakasi, Rajapalayam, Tenkasi and Tirunelveli. Apply online in 5 minutes. / வேலைக்கு விண்ணப்பிக்கவும்.",
  openGraph: {
    title: "Jobs at Balasanka Group · வேலைவாய்ப்பு",
    description: "Apply online in 5 minutes for jobs at our showrooms across South Tamil Nadu.",
    images: ["/balasanka_logo.png"], locale: "en_IN", type: "website", siteName: SITE_NAME,
  },
};

type Props = { searchParams: Promise<{ branch?: string; src?: string; post?: string }> };

export default async function ApplyPage({ searchParams }: Props) {
  const [config, sp] = await Promise.all([loadApplyConfig(), searchParams]);
  const branch = config?.branches.some((b) => b.id === sp.branch) ? sp.branch : undefined;
  // A showroom poster's QR code and the careers page's "Apply at this branch" button are for that showroom only,
  // so their visitors can't switch branch.
  const source = cleanSource(sp.src);
  const lockBranch = !!branch && (source === "poster" || source === "careers");
  // A job page's Apply button picks its post too (still changeable among the store's open posts).
  const post = branch && config?.branches.find((b) => b.id === branch)?.posts.includes(sp.post ?? "") ? sp.post : undefined;
  return (
    <main className="mx-auto max-w-2xl p-3 sm:p-6">
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/balasanka_logo.png" alt="Balasanka logo" className="h-11 w-auto" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight text-brand">Apply for a job at Balasanka Group</h1>
            <p className="text-sm text-slate-500">வேலை விண்ணப்பம் · takes about 5 minutes</p>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          {config ? <ApplyForm {...config} initialBranch={branch} initialPost={post} lockBranch={lockBranch} source={source} /> : <p className="py-6 text-center text-sm text-red-700">The form could not load. Please refresh the page.</p>}
        </div>
      </div>
    </main>
  );
}
