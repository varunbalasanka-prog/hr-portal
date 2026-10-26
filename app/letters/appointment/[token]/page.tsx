import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isJewellery, loadLetter } from "@/lib/letters";
import { formatDate, probationEnd, todayIst } from "@/lib/dates";
import { calculateSalary } from "@/lib/salary";
import { MEDIA_CONSENT } from "@/lib/letter-clauses";
import { Addresses, ExpiredLink, Letterhead, SalarySchedule, Tamil } from "@/components/letterhead";

type Props = { params: Promise<{ token: string }> };
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Appointment letter · Balasanka Group", robots: { index: false } };

type V = { doj: string; probEnd: string; designation: string; address: string; gross: string; jewellery: boolean };
/** A clause: heading, English lines and Tamil lines. Lines starting with "• " are bullets. */
type Clause = { h: string; en: (v: V) => string[]; ta: (v: V) => string[] };

// Wording follows the branches' Word appointment letters (Sep 2026): Akshaya Velli (jewellery) and Balasanka TVS
// (automobiles). They differ in the resignation bullet, the weekly off, and the media clause (automobiles only).
const CLAUSES: Clause[] = [
  { h: "Joining Date",
    en: (v) => [`Your employment with the Company formally commences from your date of joining, i.e., ${v.doj}.`],
    ta: (v) => [`நிறுவனத்துடனான உங்கள் வேலைவாய்ப்பு நீங்கள் பணியில் சேர்ந்த தேதியான ${v.doj} முதல் அதிகாரப்பூர்வமாகத் தொடங்குகிறது.`] },
  { h: "Designation and Reporting",
    en: (v) => [`You are appointed as ${v.designation} and will report to the Store Manager / Branch Head or any other person designated by the Company.`],
    ta: (v) => [`நீங்கள் ${v.designation} ஆக நியமிக்கப்படுகிறீர்கள். ஸ்டோர் மேனேஜர் / கிளைப் பொறுப்பாளர் அல்லது நிறுவனத்தால் நியமிக்கப்படும் உயர் அதிகாரிக்குக் கீழ் நீங்கள் பணியாற்ற வேண்டும்.`] },
  { h: "Probation Period & Training Rules",
    en: (v) => [
      `You are placed on probation for a period extending up to 6 months (From Date: ${v.doj} To Date: ${v.probEnd}). During the probation period:`,
      v.jewellery
        ? "• During the probation period, if the employee wishes to resign, they must give 15 days' prior written notice, failing which an amount equivalent to 15 days' salary shall be recovered/adjusted as compensation."
        : "• During the probation period, if the employee wishes to resign, they must give 15 days' prior written notice, failing which an amount equivalent to 15 days' salary shall be recovered and adjusted as compensation, in accordance with Section 73 & 74 of the Indian Contract Act, 1872 and Section 7(2) of the Payment of Wages Act, 1936.",
      "• However, the Management reserves the full right to terminate the employee immediately without any prior notice if their performance, conduct, or capacity is found unsatisfactory. In such cases, salary will be paid up to the last actual working day.",
      "• The Company will not provide any food, accommodation, or additional allowances.",
      "• If a uniform is required, the cost must be borne by the trainee and will be deducted from the salary.",
      "• Confirmation of employment will be decided based on your performance after the probation period.",
      "• A training/experience certificate will be issued only upon successful completion of the entire probation period.",
    ],
    ta: (v) => [
      `நீங்கள் 6 மாத காலம் வரை பயிற்சி/ப்ரொபஷன் காலத்தில் வைக்கப்படுகிறீர்கள் (தேதி: ${v.doj} முதல் ${v.probEnd} வரை). ப்ரொபஷன் காலத்தில்:`,
      v.jewellery
        ? "• பயிற்சி/ப்ரொபஷன் காலத்தில், ஊழியர் வேலையிலிருந்து விலக விரும்பினால் 15 நாட்களுக்கு முன்பாக எழுத்துப்பூர்வமாக அறிவிக்க (Notice) வேண்டும்; தவறினால் 15 நாட்களுக்கான சம்பளம் இழப்பீடாகப் பிடித்தம் செய்யப்படும்."
        : "• பயிற்சி/ப்ரொபஷன் காலத்தில், ஊழியர் வேலையிலிருந்து விலக விரும்பினால் 15 நாட்களுக்கு முன்பாக எழுத்துப்பூர்வமாக அறிவிக்க (Notice) வேண்டும்; தவறினால் இந்திய ஒப்பந்தச் சட்டம், 1872 இன் பிரிவு 73 & 74 மற்றும் ஊதிய வழங்கு சட்டம், 1936 இன் பிரிவு 7(2) இன் படி, 15 நாட்களுக்கான சம்பளம் இழப்பீடாகப் பிடித்தம் செய்யப்படும்.",
      "• அதேவேளையில், ஊழியரின் செயல்திறன், நடத்தை அல்லது வேலைத்திறன் திருப்திகரமாக இல்லை எனில், எவ்வித முன்னறிவிப்புமின்றி அவரை உடனடியாக வேலையிலிருந்து நிறுத்துவதற்கு நிர்வாகத்திற்கு முழு உரிமை உண்டு. அவ்வாறு நிறுத்தப்பட்டால், அவர் பணிபுரிந்த கடைசி நாள் வரைக்குமான சம்பளம் வழங்கப்படும்.",
      "• நிறுவனம் எந்தவிதமான உணவு, தங்குமிடம் அல்லது தனி அலவன்ஸ்களையும் வழங்காது.",
      "• சீருடை தேவைப்பட்டால், அதற்கான செலவைப் பயிற்சி பெறுபவரே ஏற்க வேண்டும்; அத்தொகை சம்பளத்தில் இருந்து பிடித்தம் செய்யப்படும்.",
      "• பயிற்சி காலம் முடிந்த பிறகு, உங்களின் செயல்திறனை அடிப்படையாகக் கொண்டு வேலையை நிரந்தரமாக்குவது குறித்து முடிவெடுக்கப்படும்.",
      "• பயிற்சி காலத்தை முழுமையாக நிறைவு செய்த பின்னரே பயிற்சி/பணி அனுபவச் சான்றிதழ் வழங்கப்படும்.",
    ] },
  { h: "Salary Compensation",
    en: (v) => [`Consolidated Salary: Rs. ${v.gross} per month. Salary will be paid on a monthly basis. All compensation is subject to statutory deductions (such as PF, ESI) in accordance with government regulations.`],
    ta: (v) => [`ஒருங்கிணைந்த சம்பளம்: மாதம் ரூ. ${v.gross}/-. மாதந்தோறும் சம்பளம் வழங்கப்படும். அனைத்துச் சம்பளப் பணமும் அரசு விதிகளின்படி சட்டப்பூர்வமான பிடித்தங்களுக்கு (PF, ESI போன்றவை) உட்பட்டது.`] },
  { h: "Place of Posting and Transfer",
    en: (v) => [`You are officially posted for work at ${v.address}. During your probation period, you may be required to attend training or perform duties at any of the Company's other business locations as required. After completion of your probation period or as per operational requirements, the Company reserves the full right to transfer you to any existing or future branch, location, or division (Jewellery, Automobile, Cycle Bazar, etc.).`],
    ta: (v) => [`${v.address} கிளையில் பணியமர்த்தப்பட்டுள்ளீர்கள். உங்கள் பயிற்சி காலத்தில், நிறுவனத்தின் தேவைக்கேற்ப பிற கிளைகள்/இடங்களுக்கும் பயிற்சி அல்லது பணிக்காகச் செல்ல வேண்டியிருக்கும். உங்கள் பயிற்சி காலம் முடிவடைந்த பிறகோ அல்லது நிறுவனத்தின் தேவைக்கேற்பவோ, உங்களை வேறு எந்தக் கிளைக்கும், இடத்திற்கும் அல்லது பிரிவுக்கும் இடமாற்றம் (Transfer) செய்ய நிறுவனத்திற்கு முழு உரிமை உண்டு.`] },
  { h: "Duties and Responsibilities",
    en: () => ["You shall perform to the best of your ability all the duties inherent in your post and such additional responsibilities as assigned required by business needs."],
    ta: () => ["உங்கள் பதவிக்குரிய அனைத்துக் கடமைகளையும், நிறுவனத்தின் தேவைக்கேற்ப மேலாண்மை உங்களுக்கு வழங்கும் கூடுதல் பொறுப்புகளையும் உங்களது முழுத் திறமையுடன் செய்து முடிக்க வேண்டும்."] },
  { h: "Hours of Work, Shift Schedule & Weekly Offs",
    en: (v) => [
      "• You must strictly adhere to the shift timings designated by the Company from time to time.",
      v.jewellery
        ? "• Weekly off will be provided on rotation basis during weekdays (Monday to Friday) equivalent to the number of Sundays falling in that particular month."
        : "• Weekly off generally on Sundays. However, if business requirements demand your presence, you may be required to work on Sundays upon prior notice.",
      "• Extended operational hours may apply during festivals and peak seasons.",
    ],
    ta: (v) => [
      "• நிறுவனம் அவ்வப்போது நிர்ணயிக்கும் ஷிஃப்ட் நேரங்களை நீங்கள் கண்டிப்பாகப் பின்பற்ற வேண்டும்.",
      v.jewellery
        ? "• அந்த மாதத்தில் எத்தனை ஞாயிற்றுக்கிழமைகள் வருகிறதோ, அதற்கு இணையான நாட்கள் வார நாட்களில் (திங்கள் முதல் வெள்ளி வரை) சுழற்சி முறையில் (Rotation basis) விடுமுறையாக வழங்கப்படும்."
        : "• வார விடுமுறை பொதுவாக ஞாயிற்றுக்கிழமைகளில் வழங்கப்படும். இருப்பினும், நிறுவனத்தின் பணித் தேவை கருதித் தெரிவிக்கப்பட்டால், ஞாயிற்றுக்கிழமைகளிலும் வேலைக்கு வர வேண்டியிருக்கும்.",
      "• பண்டிகை மற்றும் சீசன் காலங்களில் கூடுதல் நேரம் பணிபுரிய வேண்டியிருக்கும்.",
    ] },
  { h: "Company Property and Inventory",
    en: () => ["You are required to maintain all company property, materials, display stock, and items entrusted to you with due care. Upon cessation of employment, all company property, documents, and materials must be returned. In cases of proven negligence or misconduct resulting in loss, the cost of the same will be recovered from you by the company."],
    ta: () => ["உங்களிடம் ஒப்படைக்கப்படும் நிறுவனத்தின் பொருட்கள், டிஸ்ப்ளே ஸ்டாக் மற்றும் சாதனங்களை மிகுந்த கவனத்துடன் பராமரிக்க வேண்டும். வேலையிலிருந்து விலகும்போது நிறுவனத்தின் அனைத்துப் பொருட்களையும் திரும்ப ஒப்படைக்க வேண்டும்."] },
  { h: "Professional Conduct",
    en: () => ["You shall:", "• Maintain honesty and integrity in all dealings.", "• Not accept gifts, monetary benefits, or personal favors from customers or vendors.", "• Adhere to Company rules, policies, and ethical standards."],
    ta: () => ["நீங்கள்:", "• அனைத்து நடவடிக்கைகளிலும் நேர்மையையும் நாணயத்தையும் பேண வேண்டும்.", "• வாடிக்கையாளர்கள் அல்லது வெண்டர்களிடம் இருந்து எந்தவொரு பரிசுகளையோ, பணப் பலன்களையோ பெறக்கூடாது.", "• நிறுவனத்தின் விதிகள், கொள்கைகள் மற்றும் ஒழுக்க நெறிமுறைகளைப் பின்பற்ற வேண்டும்."] },
  { h: "Confidentiality and Non-Engagement",
    en: () => [
      "10.1 During your employment, you shall devote your full professional time, attention, and skill exclusively to the business of the Company. You shall not engage, directly or indirectly, in any other business, employment, consultancy, part-time work, or academic pursuit without prior written approval of the Company.",
      "10.2 You are required to maintain the highest degree of confidentiality with respect to all information relating to the Company's business, customers, pricing, sales data, operational processes, vendor relationships, strategies, and internal policies.",
      "10.3 You shall not remove any confidential documents, records, or data from the premises without prior written permission.",
      "10.4 Your obligation to protect confidential information shall continue even after termination of your employment.",
      "10.5 Any breach of confidentiality shall be treated as serious misconduct and may result in disciplinary action.",
    ],
    ta: () => [
      "10.1 நிறுவனத்தில் பணியாற்றும் காலத்தில், உங்களது முழு பணி நேரத்தையும் திறமையையும் நிறுவனத்தின் வளர்ச்சிக்கு மட்டுமே பயன்படுத்த வேண்டும். முன் அனுமதி பெறாமல் நேரடியாகவோ மறைமுகமாகவோ வேறு எந்த சொந்தத் தொழிலிலோ, பகுதிநேர வேலையிலோ, கன்சல்டன்சியிலோ அல்லது படிப்பிலோ ஈடுபடக்கூடாது.",
      "10.2 நிறுவனத்தின் வாடிக்கையாளர் விவரங்கள், விலைப்பட்டியல், விற்பனைத் தரவுகள் மற்றும் ரகசியங்களைப் பாதுகாப்பது உங்கள் கடமையாகும்.",
      "10.3 நிறுவனத்தின் எழுத்துப்பூர்வ அனுமதியின்றி எந்தவொரு ரகசிய ஆவணங்களையோ அல்லது தரவுகளையோ வளாகத்திற்கு வெளியே கொண்டு செல்லக்கூடாது.",
      "10.4 வேலையிலிருந்து விலகிய பிறகும் இந்த ரகசியங்களைப் பாதுகாக்கும் பொறுப்பு உங்களுக்கு உண்டு.",
      "10.5 ரகசியங்களை வெளியேற்றுவது கடுமையான ஒழுங்கு நடவடிக்கைக்கு வழிவகுக்கும்.",
    ] },
];

const MEDIA: Clause = { h: MEDIA_CONSENT.title, en: () => [MEDIA_CONSENT.en], ta: () => [MEDIA_CONSENT.ta] };

const CLOSING: Clause[] = [
  { h: "Notices & Policies",
    en: () => ["Any notice by you to the Company shall be addressed to its registered office. The Company may frame, amend, or withdraw policies from time to time relating to employee benefits, working hours, transfer, conduct, and other employment matters."],
    ta: () => ["நிறுவனத்தின் ஊழியர் சலுகைகள், வேலை நேரம், இடமாற்றம், ஒழுக்க முறைகள் போன்ற விஷயங்களில் அவ்வப்போது புதிய விதிகளை உருவாக்கவோ, மாற்றவோ அல்லது ரத்து செய்யவோ நிறுவனத்திற்கு முழு உரிமை உண்டு."] },
  { h: "Governing Law and Jurisdiction",
    en: () => ["This employment shall be governed by the laws of India. Any dispute arising out of or in connection with this employment shall be subject exclusively to the jurisdiction of the Courts at Theni District, Tamil Nadu."],
    ta: () => ["இந்தப் பணி நியமனம் இந்திய சட்டங்களுக்கு உட்பட்டது. இது தொடர்பான ஏதேனும் சட்டப் பிரச்சனைகள் எழுந்தால், அது பிரத்தியேகமாகத் தமிழ்நாட்டின் தேனி மாவட்ட நீதிமன்ற எல்லைக்கு உட்பட்டது."] },
  { h: "Acceptance",
    en: () => ["Please confirm your acceptance of the terms and conditions of this appointment by signing and returning a copy of this letter."],
    ta: () => ["இந்த பணி நியமனக் கடிதத்தின் நிபந்தனைகளை ஏற்றுக்கொண்டதை உறுதிப்படுத்த இதன் நகலில் கையொப்பமிடுமாறு கேட்டுக்கொள்ளப்படுகிறீர்கள்."] },
];

const Lines = ({ lines }: { lines: string[] }) => <>{lines.map((l, i) => <div key={i}>{l}</div>)}</>;

export default async function AppointmentLetter({ params }: Props) {
  const { token } = await params;
  const letter = await loadLetter(token);
  if (letter.expired) return <ExpiredLink />;
  const { c, branch, address } = letter;
  if (c.pipeline_status !== "Joined" || !c.actual_joining_date) notFound();
  const jewellery = isJewellery(branch, address);
  const v: V = {
    doj: formatDate(c.actual_joining_date), probEnd: formatDate(probationEnd(c.actual_joining_date)),
    designation: (c.designation ?? c.posts[0] ?? "Staff").toUpperCase(), address,
    gross: calculateSalary(c.basic_salary, c.allowances).gross.toLocaleString("en-IN"), jewellery,
  };
  const clauses = [...CLAUSES, ...(jewellery ? [] : [MEDIA]), ...CLOSING];

  return (
    <Letterhead>
      <div className="mb-2 text-right">Date: {formatDate(todayIst())}</div>
      <Addresses stacked from={address} name={c.name} address={c.address} phone={c.mobile} />
      <h1 className="my-3 text-center font-bold uppercase">Appointment Letter</h1>
      <p className="mb-2">Dear {c.name},</p>
      <p className="mb-1">We are pleased to appoint you to employment with Balasanka Group of Companies ({address}), effective from your date of joining ({v.doj}), subject to the terms and conditions outlined below.</p>
      <Tamil>({address}) பணிபுரிவதற்கான உங்களை முறைப்படி பணி நியமனம் செய்வதில் மகிழ்ச்சியடைகிறோம். நீங்கள் பணியில் சேரும் நாள் ({v.doj}) முதல் இக்கடிதத்தில் குறிப்பிடப்பட்டுள்ள நிபந்தனைகளுக்கு உட்பட்டு இந்த வேலைவாய்ப்பு வழங்கப்படுகிறது.</Tamil>
      {clauses.map((cl, i) => (
        <div key={cl.h} className="mb-2">
          <b>{i + 1}. {cl.h}</b>
          <Lines lines={cl.en(v)} />
          <Tamil><Lines lines={cl.ta(v)} /></Tamil>
        </div>
      ))}
      <SalarySchedule basic={c.basic_salary} allowances={c.allowances} grossLabel="Consolidated Salary" />
      <p className="text-[9.5pt] italic">(Note: Incentive eligibility and structures will be applicable after successful completion of the probation period as per Company Policy.)</p>
      <Tamil>(குறிப்பு: பயிற்சி காலம் முடிவடைந்த பிறகே நிறுவனத்தின் கொள்கைப்படி இன்சென்டிவ் சலுகைகளுக்குத் தகுதி பெற முடியும்).</Tamil>
      <div className="break-inside-avoid">
        <p className="mt-8">Yours sincerely,<br />For Balasanka Group of Companies<br />HR Team</p>
        <p className="mt-8">ACCEPTANCE OF APPOINTMENT<br />I have read, understood, and accept all the terms and conditions outlined in this appointment letter.</p>
        <p className="mt-8">Candidate Signature &amp; Date: Mr/Ms. {c.name}<br />Date:</p>
      </div>
    </Letterhead>
  );
}
