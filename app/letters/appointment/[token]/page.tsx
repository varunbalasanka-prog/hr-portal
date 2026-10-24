import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadLetter } from "@/lib/letters";
import { formatDate, probationEnd, todayIst } from "@/lib/dates";
import { calculateSalary, rupees } from "@/lib/salary";
import { Addresses, Letterhead, Tamil } from "@/components/letterhead";

type Props = { params: Promise<{ token: string }> };
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Appointment letter · Balasanka Group", robots: { index: false } };

const CLAUSES: [string, (v: Record<string, string>) => string, (v: Record<string, string>) => string][] = [
  ["Joining Date", (v) => `Your employment with the Company formally commences from your date of joining, i.e., ${v.doj}.`,
    (v) => `நிறுவனத்துடனான உங்கள் வேலைவாய்ப்பு நீங்கள் சேர்ந்த தேதியான ${v.doj} முதல் அதிகாரப்பூர்வமாகத் தொடங்குகிறது.`],
  ["Designation and Reporting", (v) => `You are appointed as ${v.designation} and will report to the Store Manager / Branch Head or any other person designated by the Company.`,
    (v) => `நீங்கள் ${v.designation} ஆக நியமிக்கப்படுகிறீர்கள். ஸ்டோர் மேனேஜர் / கிளைப் பொறுப்பாளர் அல்லது நிறுவனத்தால் நியமிக்கப்படும் உயர் அதிகாரிக்குப் கீழ் நீங்கள் பணியாற்ற வேண்டும்.`],
  ["Probation Period & Training Rules", (v) => `You are placed on probation for a period extending up to 6 months (From: ${v.doj} To: ${v.probEnd}). During the probation period: If the employee wishes to resign, 15 days prior written notice or recovery of salary applies in accordance with Section 73 & 74 of the Indian Contract Act, 1872 and Section 7(2) of the Payment of Wages Act, 1936. Management reserves the right to terminate immediately if performance is unsatisfactory. Food, accommodation, and uniform costs are borne by the employee.`,
    (v) => `நீங்கள் 6 மாத காலம் வரை பயிற்சி காலத்தில் வைக்கப்படுகிறீர்கள் (தேதி: ${v.doj} முதல் ${v.probEnd} வரை). பயிற்சி காலத்தில் 15 நாட்கள் நோட்டீஸ் அல்லது ஊதிய சட்ட விதிமுறைகள் பொருந்தும்.`],
  ["Salary Compensation", (v) => `Consolidated Salary: Rs. ${v.gross} per month. Salary will be paid monthly subject to statutory deductions (PF, ESI) as per government regulations.`,
    (v) => `ஒருங்கிணைந்த சம்பளம்: மாதம் ரூ. ${v.gross}/-. மாதந்தோறும் சம்பளம் வழங்கப்படும். PF மற்றும் ESI பிடித்தங்கள் பொருந்தும்.`],
  ["Place of Posting and Transfer", (v) => `You are officially posted at ${v.address}. The Management reserves the full right to transfer you to any existing or future branch, location, or division.`,
    (v) => `${v.address} கிளையில் பணியமர்த்தப்பட்டுள்ளீர்கள். உங்களை வேறு எந்தக் கிளைக்கும் அல்லது பிரிவுக்கும் இடமாற்றம் செய்ய நிறுவனத்திற்கு முழு உரிமை உண்டு.`],
  ["Duties and Responsibilities", () => "You shall perform to the best of your ability all the duties inherent in your post and additional responsibilities assigned by management.",
    () => "உங்கள் பதவிக்குரிய அனைத்துக் கடமைகளையும், நிறுவனத்தின் தேவைக்கேற்ப மேலாண்மை வழங்கும் கூடுதல் பொறுப்புகளையும் உங்களது முழுத் திறமையுடன் செய்து முடிக்க வேண்டும்."],
  ["Hours of Work, Shift Schedule & Weekly Offs", () => "You must strictly adhere to designated shift timings and weekly off policies as per branch rules.",
    () => "நிறுவனம் அவ்வப்போது நிர்ணயிக்கும் ஷிஃப்ட் நேரங்கள் மற்றும் வார விடுமுறை விதிகளுக்கு நீங்கள் கண்டிப்பாகக் கட்டுப்பட வேண்டும்."],
  ["Company Property and Inventory", () => "You are required to maintain all company property and inventory with due care. Losses due to proven negligence will be recovered.",
    () => "உங்களிடம் ஒப்படைக்கப்படும் நிறுவனத்தின் பொருட்கள் மற்றும் சாதனங்களை மிகுந்த கவனத்துடன் பராமரிக்க வேண்டும். சேதாரம் இருப்பின் வசூலிக்கப்படும்."],
  ["Professional Conduct", () => "Maintain honesty and integrity, do not accept gifts or personal favors from customers/vendors, and adhere to company ethical standards.",
    () => "அனைத்து நடவடிக்கைகளிலும் நேர்மையைப் பேண வேண்டும். வாடிக்கையாளர்கள் அல்லது வெண்டர்களிடம் இருந்து பரிசுகளையோ பணப் பலன்களையோ பெறக்கூடாது."],
  ["Confidentiality and Non-Engagement", () => "Devote full time to the Company. Do not engage in any other business or employment. Maintain strict confidentiality of business data and customer information.",
    () => "நிறுவனத்தில் பணியாற்றும் காலத்தில் வேறு எந்தத் தொழிலிலோ பகுதிநேர வேலையிலோ ஈடுபடக்கூடாது. நிறுவனத்தின் ரகசியங்களைப் பாதுகாக்க வேண்டும்."],
  ["Media Consent, Ownership & Brand Promotion", () => "As part of company branding, participation in promotional photographs, videos, and campaigns is routine without extra remuneration, under Section 17(c) of the Copyright Act, 1957. Consent is perpetual and irrevocable.",
    () => "நிறுவனத்தின் பிராண்ட் விளம்பரங்கள் மற்றும் ரீல்ஸ் வீடியோக்களில் பங்கேற்பது வழக்கமான பணியின் ஒரு பகுதியாகும்; அதற்கு தனியாக ஊதியம் வழங்கப்படாது. பதிப்புரிமைச் சட்டம், 1957 இன் படி அனைத்து மீடியா சொத்துகளும் நிறுவனத்திற்குச் சொந்தமானவை."],
  ["Notices & Policies", () => "The Company may frame, amend, or withdraw policies from time to time relating to employee benefits, working hours, and conduct.",
    () => "நிறுவனத்தின் சலுகைகள், வேலை நேரம் மற்றும் ஒழுக்க முறைகள் சார்ந்த கொள்கைகளில் மாற்றங்களைச் செய்ய நிறுவனத்திற்கு உரிமை உண்டு."],
  ["Governing Law and Jurisdiction", () => "This employment is governed by the laws of India. Any disputes are subject exclusively to the jurisdiction of Courts at Theni District, Tamil Nadu.",
    () => "இந்தப் பணி நியமனம் இந்திய சட்டங்களுக்கு உட்பட்டது. இது தொடர்பான சட்டப் பிரச்சனைகள் தேனி மாவட்ட நீதிமன்ற எல்லைக்கு உட்பட்டது."],
  ["Acceptance", () => "Please confirm your acceptance of all terms and conditions by signing and returning a copy of this letter.",
    () => "இந்த பணி நியமனக் கடிதத்தின் நிபந்தனைகளை ஏற்றுக்கொண்டதை உறுதிப்படுத்த இதன் நகலில் கையொப்பமிட்டு வழங்கவும்."],
];

export default async function AppointmentLetter({ params }: Props) {
  const { token } = await params;
  const { c, address, companyName } = await loadLetter(token);
  if (c.pipeline_status !== "Joined" || !c.actual_joining_date) notFound();
  const s = calculateSalary(c.basic_salary, c.allowances);
  const v = {
    doj: formatDate(c.actual_joining_date), probEnd: formatDate(probationEnd(c.actual_joining_date)),
    designation: c.designation ?? c.posts[0] ?? "Staff", address, gross: rupees(s.gross),
  };
  const rows: [string, string, boolean?][] = [
    ["Basic Salary", rupees(s.basic)], ["Allowances", rupees(s.allowances)], ["Consolidated Salary", rupees(s.gross), true],
    ["ESI", `(-) ${rupees(s.esiEmployee)}`], ["PF", `(-) ${rupees(s.pfEmployee)}`], ["Take Home Salary", rupees(s.takeHome), true], ["Total Monthly CTC", rupees(s.totalCtc), true],
  ];

  return (
    <Letterhead>
      <div className="mb-2 text-right font-bold">Date: {formatDate(todayIst())}</div>
      <Addresses from={address} name={c.name} address={c.address} phone={c.mobile} />
      <h1 className="my-3 text-center font-bold uppercase underline">Appointment Letter</h1>
      <p className="mb-1 text-justify">Dear <b>{c.name}</b>,<br />We are pleased to appoint you to employment with Balasanka Group of Companies ({address}), effective from your date of joining (<b>{v.doj}</b>), subject to the terms and conditions outlined below.</p>
      <Tamil>({address}) பணிபுரிவதற்கான உங்களை முறைப்படி பணி நியமனம் செய்வதில் மகிழ்ச்சியடைகிறோம். நீங்கள் பணியில் சேரும் நாள் ({v.doj}) முதல் இக்கடிதத்தில் குறிப்பிடப்பட்டுள்ள நிபந்தனைகளுக்கு உட்பட்டு இந்த வேலைவாய்ப்பு வழங்கப்படுகிறது.</Tamil>
      {CLAUSES.map(([h, en, ta], i) => (
        <div key={h} className="mb-2 text-justify"><b>{i + 1}. {h}:</b> {en(v)}<Tamil>{ta(v)}</Tamil></div>
      ))}
      <div className="mt-2 break-inside-avoid">
        <b>SCHEDULE I - COMPENSATION DETAILS</b>
        <table className="my-2 w-full border-collapse text-[9.5pt]">
          <thead><tr><th className="border border-slate-400 bg-slate-100 px-2 py-1 text-left">Component</th><th className="border border-slate-400 bg-slate-100 px-2 py-1 text-left">Amount (₹)</th></tr></thead>
          <tbody>{rows.map(([k, val, bold]) => (
            <tr key={k} className={bold ? "font-bold" : ""}><td className="border border-slate-400 px-2 py-1">{k}</td><td className="border border-slate-400 px-2 py-1">{val}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <table className="mt-5 w-full break-inside-avoid"><tbody><tr className="align-bottom">
        <td className="w-1/2"><b>For {companyName}</b><br /><br /><br /><b>Authorized Signatory</b></td>
        <td className="w-1/2 border border-slate-400 p-2 text-[9.5pt]"><b>EMPLOYEE ACCEPTANCE:</b><br />I accept the terms and conditions.<br /><br />Signature: __________________<br />Date: __________________</td>
      </tr></tbody></table>
    </Letterhead>
  );
}
