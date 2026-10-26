import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadLetter } from "@/lib/letters";
import { formatDate, probationEnd } from "@/lib/dates";
import { confirmationDate, letterDate } from "@/lib/confirmation";
import { MEDIA_CONSENT } from "@/lib/letter-clauses";
import { Addresses, ExpiredLink, Letterhead, SalarySchedule, Tamil } from "@/components/letterhead";

type Props = { params: Promise<{ token: string }> };
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmation letter · Balasanka Group", robots: { index: false } };

// Wording follows the branches' "Employment Service Confirmation Letter" (Sivakasi, Oct 2026).
const CLAUSES: [string, (v: Record<string, string>) => string, (v: Record<string, string>) => string][] = [
  ["Designation & Transfer Rights", (v) => `You are confirmed as ${v.designation}. The Management reserves the right to transfer you to any branch or group entity based on business needs.`,
    (v) => `(நீங்கள் ${v.designation} ஆகப் பணி உறுதி செய்யப்படுகிறீர்கள். நிறுவனத் தேவைக்கேற்ப எந்தக் கிளைக்கும் பணிமாறுதல் செய்யும் உரிமை நிர்வாகத்திற்கு உண்டு.)`],
  ["Notice Period & Salary Recovery", () => "Post-confirmation, 1 Month prior written notice is mandatory to resign. If you fail to serve notice, 1 Month Salary will be recovered and adjusted in lieu of notice, in accordance with Section 73 & 74 of the Indian Contract Act, 1872 and Section 7(2) of the Payment of Wages Act, 1936.",
    () => "(பணியிலிருந்து விலக 1 மாதம் முன்னறிவிப்பு தருவது கட்டாயமாகும். முன்னறிவிப்பு தராமல் விலகினால், இந்திய ஒப்பந்தச் சட்டம், 1872 இன் பிரிவு 73 & 74 மற்றும் ஊதிய வழங்கு சட்டம், 1936 இன் பிரிவு 7(2) இன் படி, 1 மாத சம்பளம் பிடித்தம் செய்யப்படும்.)"],
  ["Incentive Eligibility", () => "Incentives are performance-linked upon achieving monthly targets set by Management and are not guaranteed fixed pay.",
    () => "(நிர்வாகம் நிர்ணயிக்கும் மாதாந்திர இலக்குகளை எட்டும் போது மட்டுமே இன்சென்டிவ் தகுதி பெற முடியும். இது நிலையான ஊதியம் அல்ல.)"],
  [MEDIA_CONSENT.title, () => MEDIA_CONSENT.en, () => `(${MEDIA_CONSENT.ta})`],
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

  return (
    <Letterhead>
      <div className="mb-2 text-right">Date: {formatDate(letterDate(c))}</div>
      <Addresses stacked mrms="Mr / Ms." from={address} name={c.name} address={c.address} phone={c.mobile} />
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
      <SalarySchedule basic={c.basic_salary} allowances={c.allowances} grossLabel="Gross Salary" />
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
