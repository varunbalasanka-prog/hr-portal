import type { Metadata } from "next";
import QRCode from "qrcode";
import { requireProfile } from "@/lib/auth";
import { loadCareers, siteUrl } from "@/lib/careers";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hiring posters · Balasanka HR", robots: { index: false } };

type Props = { searchParams: Promise<{ branch?: string }> };

/** One A4 "We are hiring" poster per branch, with a QR code that opens the apply page for that branch.
 *  Scans are counted as source "poster" in Reports. */
export default async function PosterPage({ searchParams }: Props) {
  await requireProfile();
  const [{ branch }, branches] = await Promise.all([searchParams, loadCareers()]);
  const list = (branches ?? []).filter((b) => !branch || b.id === branch);
  const posters = await Promise.all(list.map(async (b) => {
    const url = `${siteUrl()}/apply?branch=${b.id}&src=poster`;
    return { b, url, qr: await QRCode.toDataURL(url, { margin: 1, width: 600, errorCorrectionLevel: "M" }) };
  }));

  return (
    <div className="bg-slate-200 print:bg-white">
      <form className="mx-auto flex max-w-[210mm] items-center gap-2 p-3 print:hidden">
        <select name="branch" defaultValue={branch ?? ""} className="input">
          <option value="">All branches ({(branches ?? []).length} posters)</option>
          {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button className="btn-primary">Show</button>
      </form>
      {posters.map(({ b, url, qr }) => (
        <section key={b.id} className="mx-auto mb-4 flex min-h-[297mm] max-w-[210mm] flex-col items-center bg-white px-[15mm] py-[15mm] text-center shadow [break-after:page] print:mb-0 print:shadow-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/balasanka_logo.png" alt="" className="h-20 w-auto" />
          <div className="mt-2 font-serif text-xl font-extrabold uppercase text-brand">Balasanka Group of Companies</div>
          <h1 className="mt-8 text-6xl font-black uppercase tracking-tight">We are hiring!</h1>
          <p className="mt-2 text-4xl font-bold">வேலைக்கு ஆட்கள் தேவை!</p>
          <p className="mt-6 text-2xl font-semibold">{b.name}</p>
          <ul className="mt-6 flex max-w-[160mm] flex-wrap justify-center gap-2 text-lg">
            {(b.urgent.length ? b.urgent.map((u) => u.post) : b.posts.slice(0, 10)).map((p) => <li key={p} className="rounded-full border-2 border-brand px-3 py-1">{p}</li>)}
          </ul>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR code to apply at ${b.name}`} className="mt-10 h-[70mm] w-[70mm]" />
          <p className="mt-4 text-2xl font-bold">Scan to apply in 5 minutes</p>
          <p className="text-xl">ஸ்கேன் செய்து 5 நிமிடத்தில் விண்ணப்பிக்கவும்</p>
          <p className="mt-6 break-all text-sm text-slate-600">{url}</p>
        </section>
      ))}
      <PrintButton />
    </div>
  );
}
