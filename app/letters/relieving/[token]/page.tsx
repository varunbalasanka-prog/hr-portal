import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadLetter } from "@/lib/letters";
import { formatDate, todayIst } from "@/lib/dates";
import { ExpiredLink, Letterhead, Tamil } from "@/components/letterhead";

type Props = { params: Promise<{ token: string }> };
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Relieving & experience letter · Balasanka Group", robots: { index: false } };

/** For staff who left with information (resigned properly). Not issued to those who left without information. */
export default async function RelievingLetter({ params }: Props) {
  const { token } = await params;
  const letter = await loadLetter(token);
  if (letter.expired) return <ExpiredLink />;
  const { c, address, companyName } = letter;
  if (c.employment_status !== "Left" || c.left_type !== "With Information" || !c.relieving_date || !c.actual_joining_date) notFound();
  const designation = c.designation ?? c.posts[0] ?? "Staff";
  const from = formatDate(c.actual_joining_date), to = formatDate(c.relieving_date);

  return (
    <Letterhead>
      <div className="mb-2 text-right font-bold">Date: {formatDate(todayIst())}</div>
      <h1 className="my-4 text-center font-bold uppercase underline">Relieving &amp; Experience Letter</h1>
      <p className="mb-2 font-bold">TO WHOM IT MAY CONCERN</p>
      <p className="mb-1 text-justify">
        This is to certify that <b>{c.name}</b>{c.father_name ? <> (S/o or D/o or W/o {c.father_name})</> : null} worked with
        Balasanka Group of Companies at <b>{address}</b> as <b>{designation}</b> from <b>{from}</b> to <b>{to}</b>.
      </p>
      <Tamil>
        {c.name} அவர்கள் பாலசங்கா குரூப் ஆஃப் கம்பெனிஸின் {address} கிளையில் {from} முதல் {to} வரை {designation} ஆகப் பணியாற்றினார் என்று சான்றளிக்கப்படுகிறது.
      </Tamil>
      <p className="mb-1 text-justify">
        {c.name} resigned from the services of the Company and has been relieved from duty at the close of business on <b>{to}</b>.
        During the period of employment, the conduct was found to be good.
      </p>
      <Tamil>அவர் தாமாகப் பணியிலிருந்து விலகினார்; {to} அன்று பணியிலிருந்து விடுவிக்கப்பட்டார். பணிக்காலத்தில் அவரது நடத்தை நன்றாக இருந்தது.</Tamil>
      <p className="mb-1">We wish {c.name} all the best in future endeavours.</p>
      <Tamil>அவரது எதிர்கால முயற்சிகளுக்கு எங்கள் வாழ்த்துகள்.</Tamil>
      <p className="mt-8"><b>For {companyName}</b><br /><br /><br /><b>Authorized Signatory</b></p>
    </Letterhead>
  );
}
