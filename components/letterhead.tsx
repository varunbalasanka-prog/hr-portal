import { PrintButton } from "./print-button";

export function Letterhead({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-200 print:bg-white">
      <div className="mx-auto min-h-screen max-w-[210mm] bg-white px-[15mm] pb-24 pt-[12mm] font-serif text-[10.5pt] leading-snug text-black shadow print:shadow-none">
        <table className="mb-6 w-full border-b-2 border-brand-accent pb-2">
          <tbody><tr>
            <td>
              <div className="text-[16pt] font-bold uppercase text-brand">Balasanka Group of Companies</div>
              <div className="text-[8pt] font-bold text-slate-600">Theni • Madurai • Virudhunagar • Sivakasi • Srivilliputhur • Rajapalayam • Tenkasi • Tirunelveli</div>
            </td>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <td className="text-right"><img src="/balasanka_logo.png" alt="Balasanka logo" className="ml-auto h-11 w-auto" /></td>
          </tr></tbody>
        </table>
        {children}
      </div>
      <PrintButton />
    </div>
  );
}

export function Tamil({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 font-sans text-[9pt] italic text-slate-700">{children}</div>;
}

export function Addresses({ from, name, address, phone, stacked }: { from: string; name: string; address: string | null; phone: string; stacked?: boolean }) {
  if (stacked) return (
    <div className="mb-3">
      <p className="mb-3"><b>FROM:</b><br />{from.split(", ").map((l, i) => <span key={i}>{l}<br /></span>)}</p>
      <p><b>TO:</b><br />Mr / Ms. {name},<br />{address || "Tamil Nadu"}<br />Phone: {phone}</p>
    </div>
  );
  return (
    <table className="mb-3 w-full"><tbody><tr className="align-top">
      <td className="w-1/2 pr-4"><b>FROM:</b><br />{from.split(", ").map((l, i) => <span key={i}>{l}<br /></span>)}</td>
      <td className="w-1/2"><b>TO:</b><br />Mr/Ms. {name},<br />{address || "Tamil Nadu"}<br />Phone: {phone}</td>
    </tr></tbody></table>
  );
}

/** Shown instead of a letter or form when its link is older than 60 days and HR hasn't renewed it. */
export function ExpiredLink() {
  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <div className="card p-6">
        <h1 className="mb-2 text-lg font-bold text-brand">This link has expired</h1>
        <p className="text-sm text-slate-700">For your privacy, links stop working after 60 days. Please ask the HR team to send you a new link.</p>
        <p className="mt-2 text-sm text-slate-600">உங்கள் தனியுரிமைக்காக, இணைப்புகள் 60 நாட்களுக்குப் பிறகு செயல்படாது. புதிய இணைப்பை அனுப்ப HR குழுவிடம் கேட்கவும்.</p>
      </div>
    </main>
  );
}
