import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadLetter } from "@/lib/letters";
import { formatDate, probationEnd, todayIst } from "@/lib/dates";
import { Addresses, ExpiredLink, Letterhead, Tamil } from "@/components/letterhead";

type Props = { params: Promise<{ token: string }> };
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmation letter · Balasanka Group", robots: { index: false } };

const nextDay = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** Issued when the 6-month probation ends and the employee is still working. */
export default async function ConfirmationLetter({ params }: Props) {
  const { token } = await params;
  const letter = await loadLetter(token);
  if (letter.expired) return <ExpiredLink />;
  const { c, address, companyName } = letter;
  if (c.pipeline_status !== "Joined" || !c.actual_joining_date || c.employment_status === "Left") notFound();
  const confirmed = formatDate(c.confirmation_date ?? nextDay(probationEnd(c.actual_joining_date)));
  const designation = c.designation ?? c.posts[0] ?? "Staff";

  return (
    <Letterhead>
      <div className="mb-2 text-right font-bold">Date: {formatDate(todayIst())}</div>
      <Addresses from={address} name={c.name} address={c.address} phone={c.mobile} />
      <h1 className="my-3 text-center font-bold uppercase underline">Confirmation of Employment</h1>
      <p className="mb-2 text-justify">Dear <b>{c.name}</b>,</p>
      <p className="mb-1 text-justify">
        With reference to your appointment as <b>{designation}</b> at {address} from <b>{formatDate(c.actual_joining_date)}</b>,
        we are pleased to inform you that you have successfully completed your probation period. Your services are hereby
        <b> confirmed with effect from {confirmed}</b>.
      </p>
      <Tamil>
        {address}-இல் {formatDate(c.actual_joining_date)} முதல் {designation} ஆகப் பணியாற்றி வரும் நீங்கள் தகுதிகாண் காலத்தை வெற்றிகரமாக
        நிறைவு செய்துள்ளீர்கள். {confirmed} முதல் உங்கள் பணி நிரந்தரமாக உறுதிப்படுத்தப்படுகிறது என்பதை மகிழ்ச்சியுடன் தெரிவிக்கிறோம்.
      </Tamil>
      <p className="mb-1 text-justify">
        All other terms and conditions of your appointment letter remain unchanged. After confirmation, either party may end
        the employment by giving 30 days&apos; notice in writing or salary in lieu of notice, as per company policy.
      </p>
      <Tamil>உங்கள் பணி நியமனக் கடிதத்தின் மற்ற நிபந்தனைகள் மாற்றமின்றித் தொடரும். பணி உறுதிப்படுத்தலுக்குப் பிறகு, பணியிலிருந்து விலக 30 நாட்கள் முன் எழுத்துப்பூர்வ அறிவிப்பு அல்லது அதற்கான சம்பளம் பொருந்தும்.</Tamil>
      <p className="mb-1">We appreciate your contribution and wish you continued success with us.</p>
      <Tamil>உங்கள் பங்களிப்பைப் பாராட்டுகிறோம்; தொடர்ந்து சிறப்பாகப் பணியாற்ற வாழ்த்துகிறோம்.</Tamil>
      <p className="mt-8"><b>For {companyName}</b><br /><br /><br /><b>Authorized Signatory</b></p>
    </Letterhead>
  );
}
