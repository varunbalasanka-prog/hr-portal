import { PrintButton } from "./print-button";
import { calculateSalary } from "@/lib/salary";

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

/** `stacked` is the layout of the branches' Word letters: FROM above TO, the address as company / street / town. */
export function Addresses({ from, name, address, phone, stacked, mrms = "Mr/Ms." }: {
  from: string; name: string; address: string | null; phone: string; stacked?: boolean; mrms?: string;
}) {
  if (stacked) {
    const parts = from.split(", ");
    const lines = parts.length > 3 ? [parts[0], parts.slice(1, -2).join(", "), parts.slice(-2).join(", ")] : parts;
    return (
      <div className="mb-3">
        <p className="mb-3"><b>FROM:</b><br />{lines.map((l, i) => <span key={i}>{l}<br /></span>)}</p>
        <p><b>TO:</b><br />{mrms} {name},<br />{address || "Tamil Nadu"}<br />Phone: {phone}</p>
      </div>
    );
  }
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

/** "SCHEDULE I - COMPENSATION DETAILS" as on the branches' Word letters, in whole rupees. */
export function SalarySchedule({ basic, allowances, grossLabel }: { basic: number; allowances: number; grossLabel: string }) {
  const s = calculateSalary(basic, allowances);
  const inr = (n: number) => n.toLocaleString("en-IN");
  const rows: [string, string, boolean?][] = [
    ["Basic Salary", inr(s.basic)], ["Allowances", inr(s.allowances)], [grossLabel, inr(s.gross), true],
    ["ESI", `(-) ${inr(s.esiEmployee)}`], ["PF", `(-) ${inr(s.pfEmployee)}`], ["Take Home Salary", inr(s.takeHome), true], ["Total Monthly CTC", inr(s.totalCtc), true],
  ];
  return (
    <div className="mt-2 break-inside-avoid">
      <b>SCHEDULE I - COMPENSATION DETAILS</b>
      <table className="my-2 w-full border-collapse text-[9.5pt]">
        <thead><tr className="border-b-2 border-black"><th className="px-1 py-0.5 text-left">Component</th><th className="px-1 py-0.5 text-left">Amount (₹)</th></tr></thead>
        <tbody>{rows.map(([k, val, bold]) => (
          <tr key={k} className={`border-b border-slate-300 ${bold ? "font-bold" : ""}`}><td className="w-1/2 px-1 py-0.5">{k}</td><td className="px-1 py-0.5">{val}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
