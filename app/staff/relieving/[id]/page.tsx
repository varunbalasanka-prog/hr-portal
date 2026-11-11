import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { formatDate, todayIst } from "@/lib/dates";
import { Letterhead, Tamil } from "@/components/letterhead";

type Props = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Relieving & experience letter · Balasanka Group", robots: { index: false } };

type Letter = {
  name: string; father_name: string | null; employee_code: string | null; joined_on: string; left_on: string;
  kind: "resigned" | "retired"; designation: string | null; store: string | null; address: string | null;
};

/** Relieving letter for any employee in the staff register (imported staff too), printed by HR or an admin.
 *  relieving_letter() (0039) returns it only for someone who resigned or retired and whose exit is closed. */
export default async function StaffRelievingLetter({ params }: Props) {
  const { id } = await params;
  const { profile, supabase } = await requireProfile();
  if (profile.role === "branch") notFound();
  const { data } = await supabase.rpc("relieving_letter", { p_employment: id });
  const l = data as Letter | null;
  if (!l) notFound();
  const address = l.address ?? l.store ?? "Balasanka Group of Companies, Tamil Nadu";
  const companyName = address.split(",")[0].trim();
  const designation = l.designation ?? "Staff";
  const from = formatDate(l.joined_on), to = formatDate(l.left_on);
  const retired = l.kind === "retired";

  return (
    <Letterhead>
      <div className="mb-2 text-right font-bold">Date: {formatDate(todayIst())}</div>
      <h1 className="my-4 text-center font-bold uppercase underline">Relieving &amp; Experience Letter</h1>
      <p className="mb-2 font-bold">TO WHOM IT MAY CONCERN</p>
      <p className="mb-1 text-justify">
        This is to certify that <b>{l.name}</b>{l.father_name ? <> (S/o or D/o or W/o {l.father_name})</> : null}
        {l.employee_code ? <>, employee code {l.employee_code},</> : null} worked with
        Balasanka Group of Companies at <b>{address}</b> as <b>{designation}</b> from <b>{from}</b> to <b>{to}</b>.
      </p>
      <Tamil>
        {l.name} அவர்கள் பாலசங்கா குரூப் ஆஃப் கம்பெனிஸின் {address} கிளையில் {from} முதல் {to} வரை {designation} ஆகப் பணியாற்றினார் என்று சான்றளிக்கப்படுகிறது.
      </Tamil>
      {retired ? <>
        <p className="mb-1 text-justify">
          {l.name} retired from the services of the Company and has been relieved from duty at the close of business on <b>{to}</b>.
          During the period of employment, the conduct was found to be good.
        </p>
        <Tamil>அவர் பணி ஓய்வு பெற்றார்; {to} அன்று பணியிலிருந்து விடுவிக்கப்பட்டார். பணிக்காலத்தில் அவரது நடத்தை நன்றாக இருந்தது.</Tamil>
      </> : <>
        <p className="mb-1 text-justify">
          {l.name} resigned from the services of the Company and has been relieved from duty at the close of business on <b>{to}</b>.
          During the period of employment, the conduct was found to be good.
        </p>
        <Tamil>அவர் தாமாகப் பணியிலிருந்து விலகினார்; {to} அன்று பணியிலிருந்து விடுவிக்கப்பட்டார். பணிக்காலத்தில் அவரது நடத்தை நன்றாக இருந்தது.</Tamil>
      </>}
      <p className="mb-1">We wish {l.name} all the best in future endeavours.</p>
      <Tamil>அவரது எதிர்கால முயற்சிகளுக்கு எங்கள் வாழ்த்துகள்.</Tamil>
      <p className="mt-8"><b>For {companyName}</b><br /><br /><br /><b>Authorized Signatory</b></p>
    </Letterhead>
  );
}
