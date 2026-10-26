import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadLetter } from "@/lib/letters";
import { formatDate, probationEnd } from "@/lib/dates";
import { confirmationDate, letterDate } from "@/lib/confirmation";
import { calculateSalary } from "@/lib/salary";
import { Addresses, ExpiredLink, Letterhead, Tamil } from "@/components/letterhead";

type Props = { params: Promise<{ token: string }> };
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmation letter · Balasanka Group", robots: { index: false } };

/** Whole rupees, as on the branches' printed confirmation letters (11,161 not 11,161.00). */
const inr = (n: number) => n.toLocaleString("en-IN");

// Wording follows the branches' "Employment Service Confirmation Letter" (Sivakasi, Oct 2026).
const CLAUSES: [string, (v: Record<string, string>) => string, (v: Record<string, string>) => string][] = [
  ["Designation & Transfer Rights", (v) => `You are confirmed as ${v.designation}. The Management reserves the right to transfer you to any branch or group entity based on business needs.`,
    (v) => `(நீங்கள் ${v.designation} ஆகப் பணி உறுதி செய்யப்படுகிறீர்கள். நிறுவனத் தேவைக்கேற்ப எந்தக் கிளைக்கும் பணிமாறுதல் செய்யும் உரிமை நிர்வாகத்திற்கு உண்டு.)`],
  ["Notice Period & Salary Recovery", () => "Post-confirmation, 1 Month prior written notice is mandatory to resign. If you fail to serve notice, 1 Month Salary will be recovered and adjusted in lieu of notice, in accordance with Section 73 & 74 of the Indian Contract Act, 1872 and Section 7(2) of the Payment of Wages Act, 1936.",
    () => "(பணியிலிருந்து விலக 1 மாதம் முன்னறிவிப்பு தருவது கட்டாயமாகும். முன்னறிவிப்பு தராமல் விலகினால், இந்திய ஒப்பந்தச் சட்டம், 1872 இன் பிரிவு 73 & 74 மற்றும் ஊதிய வழங்கு சட்டம், 1936 இன் பிரிவு 7(2) இன் படி, 1 மாத சம்பளம் பிடித்தம் செய்யப்படும்.)"],
  ["Incentive Eligibility", () => "Incentives are performance-linked upon achieving monthly targets set by Management and are not guaranteed fixed pay.",
    () => "(நிர்வாகம் நிர்ணயிக்கும் மாதாந்திர இலக்குகளை எட்டும் போது மட்டுமே இன்சென்டிவ் தகுதி பெற முடியும். இது நிலையான ஊதியம் அல்ல.)"],
  // The printed letters call this consent "perpetual and irrevocable". Kept withdrawable here, as in the
  // appointment letter, because the DPDP Act lets a person withdraw consent at any time.
  ["Media Consent, Ownership & Brand Promotion", () => "As part of company branding and marketing, employees may be required to participate in promotional photographs, videos, reels, and digital campaigns. Participation in such activities is voluntary and forms a routine part of brand building; no additional salary, allowances, or financial compensation is applicable for the same. In accordance with Section 17(c) of the Copyright Act, 1957, all media content and digital assets created during the course of employment shall remain the absolute and exclusive property of the Company. You may withdraw your consent for future use of your image at any time by writing to HR; material already published before that may continue to be used. Refusal to participate will not affect your employment status.",
    () => "(நிறுவனத்தின் பிராண்ட் மற்றும் மார்க்கெட்டிங் விளம்பரங்கள், ரீல்ஸ் மற்றும் வீடியோக்களில் ஊழியர்கள் பங்கேற்க நேரிடலாம். இதில் பங்கேற்பது தன்னார்வமானது மற்றும் பிராண்ட் வளர்ச்சிக்கான வழக்கமான பணியின் ஒரு பகுதியாகும்; இதற்கு தனியாக கூடுதல் சம்பளமோ, படிகளோ அல்லது எந்தவிதமான எக்ஸ்ட்ரா ஊதியமோ வழங்கப்படாது. பதிப்புரிமைச் சட்டம், 1957 இன் பிரிவு 17(c) இன் படி, பணியில் இருக்கும் காலத்தில் உருவாக்கப்படும் அனைத்து மீடியா சொத்துகளும் நிறுவனத்தின் முழுமையான மற்றும் பிரத்யேகச் சொந்த சொத்தாகும். HR-க்கு எழுத்துப்பூர்வமாகத் தெரிவித்து, இனி உங்கள் படத்தைப் பயன்படுத்துவதற்கான ஒப்புதலை எப்போது வேண்டுமானாலும் திரும்பப் பெறலாம்; அதற்கு முன் வெளியிடப்பட்டவை தொடர்ந்து பயன்படுத்தப்படலாம். இதில் பங்கேற்க மறுப்பதால் உங்களது வேலைக்கு எந்தவிதப் பாதிப்பும் ஏற்படாது.)"],
  ["Confidentiality & Rules", () => "All other terms detailed in your initial Appointment Letter remain unchanged and continue to apply.",
    () => "(அப்பாயிண்ட்மெண்ட் லெட்டரில் உள்ள வேலை நேரம் மற்றும் இதர சேவை விதிகள் அனைத்தும் தொடர்ந்து நடைமுறையில் இருக்கும்.)"],
];

/** Issued when the 6-month probation ends and the employee is still working. Opens only after HR approves it. */
export default async function ConfirmationLetter({ params }: Props) {
  const { token } = await params;
  const letter = await loadLetter(token);
  if (letter.expired) return <ExpiredLink />;
  const { c, address } = letter;
  if (c.pipeline_status !== "Joined" || !c.actual_joining_date || c.employment_status === "Left") notFound();
  if (!c.confirmation_approved_at) return <NotYetApproved />;
  const v = {
    doj: formatDate(c.actual_joining_date), probEnd: formatDate(probationEnd(c.actual_joining_date)),
    confirmed: formatDate(confirmationDate(c)),
    designation: (c.designation ?? c.posts[0] ?? "Staff").toUpperCase(),
  };
  const s = calculateSalary(c.basic_salary, c.allowances);
  const rows: [string, string, boolean?][] = [
    ["Basic Salary", inr(s.basic)], ["Allowances", inr(s.allowances)], ["Gross Salary", inr(s.gross), true],
    ["ESI", `(-) ${inr(s.esiEmployee)}`], ["PF", `(-) ${inr(s.pfEmployee)}`], ["Take Home Salary", inr(s.takeHome), true], ["Total Monthly CTC", inr(s.totalCtc), true],
  ];

  return (
    <Letterhead>
      <div className="mb-2 text-right">Date: {formatDate(letterDate(c))}</div>
      <Addresses stacked from={address} name={c.name} address={c.address} phone={c.mobile} />
      <p className="mb-2">Dear {c.name},</p>
      <h1 className="my-3 text-center font-bold uppercase">Employment Service Confirmation Letter</h1>
      <p className="mb-1">
        We are pleased to inform you that upon successful completion of your probation period (from {v.doj} to {v.probEnd}),
        your employment with Balasanka Group of Companies at {address} is confirmed with effect from {v.confirmed}.
      </p>
      <Tamil>
        உங்களது தகுதிகாண் காலம் ({v.doj} முதல் {v.probEnd} வரை) வெற்றிகரமாக நிறைவடைந்ததைத் தொடர்ந்து, உங்களது பணி நியமனம் {v.confirmed} முதல் முறைப்படி உறுதி செய்யப்படுகிறது.
      </Tamil>
      {CLAUSES.map(([h, en, ta], i) => (
        <div key={h} className="mb-2"><b>{i + 1}. {h}:</b><br />{en(v)}<Tamil>{ta(v)}</Tamil></div>
      ))}
      <div className="mt-2 break-inside-avoid">
        <b>SCHEDULE I - COMPENSATION DETAILS</b>
        <table className="my-2 w-full border-collapse text-[9.5pt]">
          <thead><tr className="border-b-2 border-black"><th className="px-1 py-0.5 text-left">Component</th><th className="px-1 py-0.5 text-left">Amount (₹)</th></tr></thead>
          <tbody>{rows.map(([k, val, bold]) => (
            <tr key={k} className={`border-b border-slate-300 ${bold ? "font-bold" : ""}`}><td className="w-1/2 px-1 py-0.5">{k}</td><td className="px-1 py-0.5">{val}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <div className="break-inside-avoid">
        <p className="mt-8">For Balasanka Group of Companies<br />Authorized Signatory / HR Dept</p>
        <p className="mt-10">Employee Acceptance:<br />I accept the terms &amp; conditions above.</p>
        <p className="mt-10">Signature of Mr / Ms. {c.name}<br />Date:</p>
      </div>
    </Letterhead>
  );
}

function NotYetApproved() {
  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <div className="card p-6">
        <h1 className="mb-2 text-lg font-bold text-brand">Confirmation letter not ready yet</h1>
        <p className="text-sm text-slate-700">Your confirmation letter will open here once HR approves it after your probation period.</p>
        <p className="mt-2 text-sm text-slate-600">உங்கள் தகுதிகாண் காலம் முடிந்ததும் HR ஒப்புதல் அளித்த பிறகு உங்கள் பணி உறுதிக் கடிதம் இங்கே திறக்கும்.</p>
      </div>
    </main>
  );
}
