import type { Metadata } from "next";
import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import { CONSENT_VERSION, DEFAULT_CONTACT, cleanRetention, type PrivacyContact } from "@/lib/privacy";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Privacy notice · Balasanka Group",
  description: "How Balasanka Group of Companies uses the details of job applicants and new employees.",
};

/** Plain-language notice for applicants and new joiners (DPDP Act 2023 and Rules 2025), in English and Tamil. */
export default async function PrivacyPage() {
  const { data } = await createPublicClient().rpc("public_privacy_info");
  const info = (data ?? {}) as { contact?: PrivacyContact; retention_months?: unknown };
  const contact = { ...DEFAULT_CONTACT, ...(info.contact ?? {}) };
  const months = cleanRetention(info.retention_months);
  const keep = months ? `${months} months` : "the period we set for closed applications";
  const keepTa = months ? `${months} மாதங்கள்` : "நாங்கள் நிர்ணயிக்கும் காலம்";

  const rows: [string, string, string, string][] = [
    ["What we collect", "Your name, mobile, address, family name, date of birth, education, work history, salary details, photo and the documents you upload. If you join, also Aadhaar, bank, PF/ESI, family (for ESI / PF nomination) and emergency contact details. If you check your Aadhaar with its QR code or e-KYC file, we keep only the name, date of birth, gender and last 4 digits from it.",
      "நாங்கள் சேகரிப்பவை", "உங்கள் பெயர், கைபேசி எண், முகவரி, குடும்பப் பெயர், பிறந்த தேதி, கல்வி, பணி அனுபவம், சம்பள விவரம், புகைப்படம் மற்றும் நீங்கள் பதிவேற்றும் ஆவணங்கள். பணியில் சேர்ந்தால் ஆதார், வங்கி, PF/ESI, குடும்ப விவரங்கள் (ESI / PF நியமனத்திற்கு) மற்றும் அவசரத் தொடர்பு விவரங்கள். ஆதார் QR அல்லது e-KYC கோப்பு மூலம் சரிபார்த்தால், பெயர், பிறந்த தேதி, பாலினம், கடைசி 4 இலக்கங்கள் மட்டுமே வைத்திருப்போம்."],
    ["Why", "To consider you for the job you applied for, contact you, arrange interviews, prepare offer and appointment letters, and, if you join, for payroll, PF, ESI and legal records.",
      "ஏன்", "நீங்கள் விண்ணப்பித்த வேலைக்கு உங்களைப் பரிசீலிக்க, தொடர்பு கொள்ள, நேர்காணல் ஏற்பாடு செய்ய, பணி வாய்ப்பு மற்றும் நியமனக் கடிதங்கள் தயாரிக்க, பணியில் சேர்ந்தால் சம்பளம், PF, ESI மற்றும் சட்டப் பதிவுகளுக்காக."],
    ["Who can see it", "Only our HR team, the store you applied to, and our administrators. Files are kept in private storage in India (Mumbai). We do not sell or share your details with anyone else, except where the law requires.",
      "யார் பார்க்கலாம்", "எங்கள் HR குழு, நீங்கள் விண்ணப்பித்த கிளை மற்றும் நிர்வாகிகள் மட்டும். கோப்புகள் இந்தியாவில் (மும்பை) தனிப்பட்ட சேமிப்பில் வைக்கப்படும். சட்டம் கோரும் இடங்களைத் தவிர யாருடனும் பகிர மாட்டோம், விற்க மாட்டோம்."],
    ["How long", `If you are not selected or you leave, we remove your files and personal details ${keep} after the last update, keeping only your name, mobile and the result. Employee records are kept as long as labour and tax laws require.`,
      "எவ்வளவு காலம்", `தேர்வாகவில்லை அல்லது பணியிலிருந்து விலகினால், கடைசி மாற்றத்திலிருந்து ${keepTa} கழித்து உங்கள் கோப்புகளும் தனிப்பட்ட விவரங்களும் நீக்கப்படும்; பெயர், கைபேசி எண், முடிவு மட்டும் வைக்கப்படும். பணியாளர் பதிவுகள் தொழிலாளர் மற்றும் வரிச் சட்டங்கள் கோரும் காலம் வரை வைக்கப்படும்.`],
    ["Your rights", "You can ask to see, correct or delete your details, withdraw your consent for the future, or complain. Contact us below. If we don't resolve it, you can complain to the Data Protection Board of India.",
      "உங்கள் உரிமைகள்", "உங்கள் விவரங்களைப் பார்க்க, திருத்த, நீக்கக் கேட்கலாம்; இனிமேல் பயன்படுத்த வேண்டாம் என ஒப்புதலைத் திரும்பப் பெறலாம்; புகார் செய்யலாம். கீழே உள்ள முகவரியில் தொடர்பு கொள்ளவும். தீர்வு கிடைக்கவில்லை எனில் இந்திய தரவுப் பாதுகாப்பு வாரியத்திடம் புகார் செய்யலாம்."],
  ];

  return (
    <main className="mx-auto max-w-2xl p-3 sm:p-6">
      <div className="card overflow-hidden">
        <div className="bg-brand px-4 py-3 text-center text-white">
          <h1 className="font-serif font-extrabold uppercase tracking-wide">Balasanka Group of Companies</h1>
          <div className="text-xs text-slate-300">Privacy notice for applicants and new employees / தனியுரிமை அறிவிப்பு</div>
        </div>
        <div className="space-y-4 p-4 text-sm leading-relaxed">
          {rows.map(([h, en, hTa, ta]) => (
            <section key={h}>
              <h2 className="font-bold text-brand">{h} / {hTa}</h2>
              <p className="text-slate-800">{en}</p>
              <p className="text-slate-600">{ta}</p>
            </section>
          ))}
          <section className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <h2 className="font-bold text-brand">Contact for privacy questions and complaints / தொடர்புக்கு</h2>
            <p className="font-semibold">{contact.name}</p>
            {contact.address && <p>{contact.address}</p>}
            {contact.phone && <p>Phone / தொலைபேசி: <span className="select-all">{contact.phone}</span></p>}
            {contact.email && <p>Email / மின்னஞ்சல்: <span className="select-all">{contact.email}</span></p>}
            {!contact.phone && !contact.email && <p>Please speak to the HR person at any of our stores. / எந்தக் கிளையிலும் உள்ள HR-இடம் பேசவும்.</p>}
          </section>
          <p className="text-xs text-slate-500">Notice version {CONSENT_VERSION}. · <Link className="underline" href="/apply">Apply for a job / வேலைக்கு விண்ணப்பிக்க</Link></p>
        </div>
      </div>
    </main>
  );
}
