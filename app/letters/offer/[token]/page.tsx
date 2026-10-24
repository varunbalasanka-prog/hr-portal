import type { Metadata } from "next";
import { loadLetter } from "@/lib/letters";
import { addDays, formatDate, todayIst } from "@/lib/dates";
import { calculateSalary, rupees } from "@/lib/salary";
import { Addresses, ExpiredLink, Letterhead, Tamil } from "@/components/letterhead";

type Props = { params: Promise<{ token: string }> };
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Offer letter · Balasanka Group", robots: { index: false } };

export default async function OfferLetter({ params }: Props) {
  const { token } = await params;
  const letter = await loadLetter(token);
  if (letter.expired) return <ExpiredLink />;
  const { c, branch, address, companyName } = letter;
  const doj = c.revised_joining_date ?? c.expected_joining_date ?? todayIst();
  const dojStr = formatDate(doj);
  const validity = formatDate(addDays(doj, 3));
  const designation = c.designation ?? c.posts[0] ?? "Staff";
  const s = calculateSalary(c.basic_salary, c.allowances);
  const jewellery = (branch?.business_type ?? "").toLowerCase().includes("jewellery") || address.toLowerCase().includes("velli");
  const reportTime = jewellery ? "09:30 AM" : "09:00 AM";

  return (
    <Letterhead>
      <div className="mb-2 text-right font-bold">Date: {formatDate(todayIst())}</div>
      <Addresses from={address} name={c.name} address={c.address} phone={c.mobile} />
      <p className="mb-1">Dear <b>{c.name}</b>,</p>
      <h1 className="my-3 text-center font-bold uppercase underline">Employment Offer Letter</h1>
      <p className="mb-1 text-justify">We are pleased to offer you the position of <b>{designation}</b> at <b>{address}</b>, Balasanka Group of Companies, starting from <b>{dojStr}</b> or earlier.</p>
      <Tamil>பாலசங்கா குரூப் ஆஃப் கம்பெனிஸின் {address} கிளையில் {designation} பதவிக்கு உங்களது பணி வாய்ப்பு மகிழ்ச்சியுடன் வழங்கப்படுகிறது.</Tamil>

      <ol className="space-y-2">
        <li><b>1. COMPENSATION:</b> Initial monthly salary - Basic: <b>Rs. {rupees(s.basic)}</b>, Allowances: <b>Rs. {rupees(s.allowances)}</b>, Gross: <b>Rs. {rupees(s.gross)}</b> per month (PF &amp; ESI apply as per rules).
          <Tamil>ஊதிய விவரம்: அடிப்படைச் சம்பளம் ரூ. {rupees(s.basic)}, படிகள் ரூ. {rupees(s.allowances)} சேர்த்து மொத்தம் மாதம் ரூ. {rupees(s.gross)} (PF மற்றும் ESI பொருந்தும்).</Tamil></li>
        <li><b>2. PROBATION &amp; WORKING HOURS:</b> 6 months probation period from date of joining. Working hours and weekly offs will be as per branch policy.
          <Tamil>தகுதிகாண் காலம் மற்றும் வேலை நேரம்: 6 மாதங்கள் தகுதிகாண் காலம். வேலை நேரம் மற்றும் வார விடுமுறை கிளைக் கொள்கையின்படி அமல்படுத்தப்படும்.</Tamil></li>
        <li><b>3. REPORTING &amp; DOCUMENTS:</b> Report to the Store Manager on <b>{dojStr}</b> at <b>{reportTime}</b> with certificates, ID proof &amp; photos.
          <Tamil>குறிப்பு: {dojStr} அன்று காலை {reportTime} மணிக்கு ஸ்டோர் மேனேஜரிடம் கடிதத்தை வழங்கி, கல்வி மற்றும் அடையாளச் சான்றிதழ்களைச் சமர்ப்பிக்கவும்.</Tamil></li>
        <li><b>4. OFFER VALIDITY:</b> Valid up to <b>{validity}</b>. Inform HR in case of any unavoidable delay.
          <Tamil>செல்லுபடிகாலம்: இந்தக் கடிதம் {validity} வரை செல்லுபடியாகும். தவிர்க்க முடியாத தாமதம் எனில் HR-ஐத் தொடர்பு கொள்ளவும்.</Tamil></li>
      </ol>

      <table className="mt-6 w-full"><tbody><tr className="align-bottom">
        <td className="w-1/2"><b>For {companyName}</b><br /><br /><br /><br /><b>Authorized Signatory</b></td>
        <td className="w-1/2 border border-slate-400 p-2.5 text-[9.5pt]"><b>EMPLOYEE ACCEPTANCE:</b><br />I accept the terms and confirm to join on/before the date.<br /><br />Candidate signature: __________________<br /><br />Date: __________________</td>
      </tr></tbody></table>
    </Letterhead>
  );
}
