"use client";
import { useState } from "react";
import Link from "next/link";
import { BLOOD_GROUPS, DETAIL_LABELS, DOC_LABELS, FIELD_FLAG, RELATIONSHIPS, familyRequirements } from "@/lib/onboarding";
import { AadhaarCheck } from "./aadhaar-check";
import { splitBilingual } from "@/lib/apply-questions";
import { browserStorage, checkFile, extFor, shrinkImage } from "@/lib/upload-client";
import { submitOnboarding } from "./actions";

type Cand = { name: string; mobile: string; branch: string; address: string; father_name: string; marital_status: "Married" | "Unmarried" | ""; email: string };

const SELECT = "-- Select / தேர்வு செய்க --";
const en = (label: string) => splitBilingual(label)[0];
const YES_NO = ["Yes / ஆம்", "No / இல்லை"];

/** Files upload from the browser into "<token>/" in private storage; the server only receives their paths.
 *  ESI (gross up to ₹21,000) or UAN (above): a candidate who already has the number skips the family section;
 *  otherwise the family details and their documents are required. A re-upload link shows only what HR flagged. */
export function OnboardingForm({ token, cand, flagged, question, aadhaarCheck, digilocker, fetched, fetchError }: {
  token: string; cand: Cand; flagged: string[] | null; question: "esi" | "uan"; aadhaarCheck: boolean; digilocker: boolean; fetched: Record<string, string>; fetchError: boolean;
}) {
  const [marital, setMarital] = useState<string>(cand.marital_status);
  const [relation, setRelation] = useState("");
  const [has, setHas] = useState("");
  const [kids, setKids] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState("");

  if (done) {
    return (
      <div className="py-6 text-center" role="status">
        <h2 className="mb-2 text-lg font-bold text-green-700">Submitted successfully / வெற்றிகரமாகச் சமர்ப்பிக்கப்பட்டது</h2>
        <p className="text-sm text-slate-700">Thank you, {cand.name}. HR will verify your documents. You can close this page.</p>
        <p className="text-sm text-slate-600">நன்றி. HR உங்கள் ஆவணங்களைச் சரிபார்ப்பார்கள். இந்தப் பக்கத்தை மூடலாம்.</p>
      </div>
    );
  }

  const fail = (msg: string) => { setError(msg); setProgress(""); window.scrollTo({ top: 0, behavior: "smooth" }); };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (progress) return;
    setError("");
    const fd = new FormData(e.currentTarget);
    if (relation.startsWith("Other")) fd.set("emergency_relationship", String(fd.get("other_relationship") ?? "Other"));
    const picked = Object.keys(DOC_LABELS).map((k) => [k, fd.get(k)] as const).filter((x): x is [string, File] => x[1] instanceof File && x[1].size > 0);
    for (const k of Object.keys(DOC_LABELS)) fd.delete(k);

    const storage = browserStorage();
    for (const [i, [key, raw]] of picked.entries()) {
      setProgress(`Uploading ${i + 1} of ${picked.length}… / பதிவேற்றம் ${i + 1}/${picked.length}…`);
      const f = await shrinkImage(raw);
      const bad = checkFile(f, DOC_LABELS[key]);
      if (bad) return fail(bad);
      const path = `${token}/${key}_${Date.now()}.${extFor(f.type)}`;
      const { error: upErr } = await storage.from("onboarding-docs").upload(path, f, { contentType: f.type });
      if (upErr) return fail(`Upload failed / பதிவேற்றம் தோல்வி: ${DOC_LABELS[key]}. Please check your internet and try again.`);
      fd.set(`path_${key}`, path);
    }
    setProgress("Saving… / சேமிக்கிறது…");
    try {
      const r = await submitOnboarding(token, fd);
      if (r.ok) setDone(true); else fail(r.message);
    } catch {
      fail("Could not save. Please check your internet and try again. / இணையத்தைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.");
    }
  }

  const footer = (
    <>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="text-slate-700">We use these details and documents only for your employment: payroll, PF, ESI, emergencies and legal records. Only HR and administrators can see them.
          <Link href="/privacy" target="_blank" className="ml-1 text-sky-800 underline">Privacy notice</Link></p>
        <p className="mt-1 text-slate-600">இந்த விவரங்களும் ஆவணங்களும் உங்கள் பணிக்காக மட்டுமே (சம்பளம், PF, ESI, அவசரநிலை, சட்டப் பதிவுகள்) பயன்படுத்தப்படும். HR மற்றும் நிர்வாகிகள் மட்டுமே பார்க்க முடியும்.</p>
        <label className="mt-2 flex items-start gap-2 font-semibold">
          <input type="checkbox" name="consent" value="yes" required className="mt-1 h-5 w-5 shrink-0" />
          <span>I agree. / நான் ஒப்புக்கொள்கிறேன். <span className="text-red-700">*</span></span>
        </label>
      </div>
      <p className="text-xs text-slate-600">Photos or PDFs only, up to 5 MB each. Large photos are made smaller on your phone first.
        <br />புகைப்படம் அல்லது PDF மட்டும், ஒவ்வொன்றும் 5 MB வரை.</p>
      <button className="btn-primary h-11 w-full" disabled={!!progress} aria-live="polite">
        {progress || (flagged ? "Re-submit / மீண்டும் சமர்ப்பிக்கவும்" : "Submit / சமர்ப்பிக்கவும்")}
      </button>
    </>
  );

  // Re-upload link: only the items HR flagged.
  if (flagged) {
    return (
      <form className="space-y-5" onSubmit={onSubmit}>
        {error && <div role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <Section n={1} title="Items HR asked for / HR கேட்டவை">
          {flagged.map((k) => k.startsWith(FIELD_FLAG) ? <FlaggedField key={k} name={k.slice(FIELD_FLAG.length)} /> : (
            <div key={k}>
              <FileIn name={k} label={DOC_LABELS[k] ?? k} required />
              {k === "aadhar" && <AadhaarHint />}
            </div>
          ))}
          {flagged.includes("aadhar") && <div className="sm:col-span-2"><AadhaarCheck token={token} enabled={aadhaarCheck} /></div>}
        </Section>
        {footer}
      </form>
    );
  }

  const label = question === "esi" ? "ESI" : "UAN (PF)";
  const family = has === "No" ? familyRequirements(marital, Number(kids || 0)) : null;
  const need = (k: string) => !!family && (family.docs.includes(k) || family.fields.includes(k));

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      {error && <div role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Section n={1} title="Basic information / அடிப்படை விவரங்கள்">
        <Static label="Name / பெயர்" value={cand.name} />
        <Static label="Mobile / கைபேசி" value={cand.mobile} />
        <Static label="Branch / கிளை" value={cand.branch} />
        <Static label="Address / முகவரி" value={cand.address || "-"} />
        <Input name="father_name" label="Father's / husband's name / தந்தை / கணவர் பெயர்" defaultValue={cand.father_name} required />
        {cand.marital_status ? (
          <>
            <Static label="Marital status / திருமண நிலை" value={cand.marital_status === "Married" ? "Married / திருமணம் ஆனவர்" : "Unmarried / திருமணம் ஆகாதவர்"} />
            <input type="hidden" name="marital_status" value={cand.marital_status} />
          </>
        ) : (
          <Choice name="marital_status" label="Marital status / திருமண நிலை" value={marital} onChange={setMarital}
            options={["Married / திருமணம் ஆனவர்", "Unmarried / திருமணம் ஆகாதவர்"]} required />
        )}
        {marital === "Married" && <Input name="wedding_date" label="Wedding date / திருமண தேதி" type="date" />}
        <Input name="email" label="Email / மின்னஞ்சல்" type="email" defaultValue={cand.email} required />
      </Section>

      <Section n={2} title="Emergency contact / அவசரத் தொடர்பு">
        <Choice name="blood_group" label="Blood group / இரத்த வகை" options={BLOOD_GROUPS} required />
        <Input name="emergency_name" label="Contact person name / தொடர்பு நபர் பெயர்" required />
        <Choice name="emergency_relationship" label="Relationship / உறவு" value={relation} onChange={setRelation} options={RELATIONSHIPS} required />
        {relation === "Other" && <Input name="other_relationship" label="Specify relationship / உறவைக் குறிப்பிடவும்" required />}
        <Input name="emergency_mobile" label="Contact mobile / தொடர்பு கைபேசி" inputMode="tel" pattern="[0-9+ ]{10,14}" required />
      </Section>

      {Object.entries(fetched).map(([k, p]) => <input key={k} type="hidden" name={`path_${k}`} value={p} />)}
      {(digilocker || fetchError || Object.keys(fetched).length > 0) && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm">
          {Object.keys(fetched).length > 0 ? (
            <p role="status" className="font-semibold text-green-800">From DigiLocker / டிஜிலாக்கரிலிருந்து: {Object.keys(fetched).map((k) => DOC_LABELS[k]?.split(" / ")[0] ?? k).join(", ")} ✓</p>
          ) : fetchError ? (
            <p role="alert" className="text-red-700">Could not get documents from DigiLocker. Please upload photos instead. / டிஜிலாக்கரிலிருந்து பெற முடியவில்லை, புகைப்படங்களைப் பதிவேற்றவும்.</p>
          ) : (
            <>
              <p>Have DigiLocker? Get your 10th/12th certificate, PAN and driving licence directly, with no photos needed.</p>
              <p className="text-xs text-slate-600">டிஜிலாக்கர் உள்ளதா? சான்றிதழ்கள், PAN, ஓட்டுநர் உரிமத்தை நேரடியாகப் பெறலாம்.</p>
              <a className="btn-primary mt-2 inline-block" href={`/api/digilocker/start?token=${token}`}>Get from DigiLocker / டிஜிலாக்கர்</a>
            </>
          )}
        </div>
      )}

      <Section n={3} title="Mandatory documents / கட்டாய ஆவணங்கள்">
        <AadhaarHint />
        <FileIn name="aadhar" label={DOC_LABELS.aadhar} required />
        <div className="sm:col-span-2"><AadhaarCheck token={token} enabled={aadhaarCheck} /></div>
        <FileIn name="school_certificate" label={DOC_LABELS.school_certificate} required={!fetched.school_certificate} done={!!fetched.school_certificate} />
        <FileIn name="passport_photo" label={DOC_LABELS.passport_photo} required />
      </Section>

      <Section n={4} title="Other documents (optional) / மற்ற ஆவணங்கள் (விருப்பம்)">
        <FileIn name="bank_passbook" label={DOC_LABELS.bank_passbook} />
        <FileIn name="pan_card" label={DOC_LABELS.pan_card} done={!!fetched.pan_card} />
        <FileIn name="driving_license" label={DOC_LABELS.driving_license} done={!!fetched.driving_license} />
      </Section>

      <Section n={5} title={question === "esi" ? "ESI" : "PF (UAN)"}>
        <Choice name={`${question}_status`} label={`Do you already have a${question === "esi" ? "n" : ""} ${label} number? / ${label} எண் ஏற்கனவே உள்ளதா?`} value={has} onChange={setHas} options={YES_NO} required />
        {has === "Yes" && <Input name={`${question}_number`} label={`${label} number / ${label} எண்`} required />}
        {has === "Yes" && <p className="text-xs text-slate-600 sm:col-span-2">Family details are not needed. / குடும்ப விவரங்கள் தேவையில்லை.</p>}
      </Section>

      {family && (
        <Section n={6} title={`Family details for ${label} / ${label}-க்கான குடும்ப விவரங்கள்`}>
          <p className="text-xs text-slate-600 sm:col-span-2">Needed to register you for {label}. Upload the full Aadhaar and a photo of each person.
            <br />{label} பதிவுக்குத் தேவை. ஒவ்வொருவரின் முழு ஆதார் மற்றும் புகைப்படத்தைப் பதிவேற்றவும்.</p>
          {marital !== "Married" ? (
            <>
              <FileIn name="father_aadhar" label={DOC_LABELS.father_aadhar} required={need("father_aadhar")} />
              <FileIn name="father_photo" label={DOC_LABELS.father_photo} required={need("father_photo")} />
              <Input name="mother_name" label="Mother name / தாய் பெயர்" required={need("mother_name")} />
              <FileIn name="mother_aadhar" label={DOC_LABELS.mother_aadhar} required={need("mother_aadhar")} />
              <FileIn name="mother_photo" label={DOC_LABELS.mother_photo} required={need("mother_photo")} />
            </>
          ) : (
            <>
              <Input name="spouse_name" label="Spouse name / வாழ்க்கைத் துணை பெயர்" required />
              <FileIn name="spouse_aadhar" label={DOC_LABELS.spouse_aadhar} required />
              <FileIn name="spouse_photo" label={DOC_LABELS.spouse_photo} required />
              <label className="block">
                <Label text="Number of children / குழந்தைகள் எண்ணிக்கை" required />
                <select name="kids_count" className="input" value={kids} required onChange={(e) => setKids(e.target.value)}>
                  <option value="">{SELECT}</option>
                  {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              {Array.from({ length: Number(kids || 0) }, (_, i) => i + 1).map((i) => (
                <div key={i} className="space-y-2 rounded border border-slate-200 p-2 sm:col-span-2">
                  <div className="text-xs font-bold">Child {i} / குழந்தை {i}</div>
                  <Input name={`kid_${i}_name`} label="Name / பெயர்" required />
                  <FileIn name={`kid_${i}_aadhar`} label={DOC_LABELS[`kid_${i}_aadhar`]} required />
                  <FileIn name={`kid_${i}_photo`} label={DOC_LABELS[`kid_${i}_photo`]} required />
                </div>
              ))}
            </>
          )}
        </Section>
      )}

      {footer}
    </form>
  );
}

function AadhaarHint() {
  return (
    <p className="rounded bg-sky-50 p-2 text-xs text-sky-900 sm:col-span-2">
      Please upload your <b>full Aadhaar (not masked)</b>: front and back, all 12 digits clearly visible. HR needs it for PF and ESI registration.
      <br />உங்கள் <b>முழு ஆதாரைப்</b> (மறைக்காமல்) பதிவேற்றவும்: முன்பக்கம், பின்பக்கம், 12 இலக்கங்களும் தெளிவாகத் தெரிய வேண்டும். PF, ESI பதிவுக்கு HR-க்குத் தேவை.
    </p>
  );
}

/** A detail HR flagged for correction. */
function FlaggedField({ name }: { name: string }) {
  const text = DETAIL_LABELS[name] ?? name;
  if (name === "blood_group") return <Choice name={name} label={text} options={BLOOD_GROUPS} required />;
  if (name === "emergency_relationship") return <Choice name={name} label={text} options={RELATIONSHIPS} required />;
  return <Input name={name} label={text} required type={name === "wedding_date" ? "date" : name === "email" ? "email" : "text"}
    {...(name === "emergency_mobile" ? { inputMode: "tel" as const, pattern: "[0-9+ ]{10,14}" } : {})} />;
}

function Label({ text, required }: { text: string; required?: boolean }) {
  const [e, t] = splitBilingual(text);
  return (
    <span className="mb-1 block">
      <span className="block text-xs font-semibold text-slate-700">{e}{required && <span className="text-red-700"> *</span>}</span>
      {t && <span className="block text-xs text-slate-600">{t}</span>}
    </span>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-sm font-bold text-brand">{n}. {title}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Static({ label, value }: { label: string; value: string }) {
  return <div><Label text={label} /><div className="rounded-md bg-slate-100 px-2.5 py-1.5 text-sm">{value}</div></div>;
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block"><Label text={label} required={props.required} /><input className="input" {...props} /></label>;
}

/** Options are "English / Tamil"; the saved value is the English part, as before. */
function Choice({ name, label, options, value, onChange, required }: { name: string; label: string; options: string[]; value?: string; onChange?: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <Label text={label} required={required} />
      <select name={name} className="input" required={required} {...(onChange ? { value: value ?? "", onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value) } : {})}>
        <option value="">{SELECT}</option>
        {options.map((o) => <option key={o} value={en(o)}>{o}</option>)}
      </select>
    </label>
  );
}

function FileIn({ name, label, required, done }: { name: string; label: string; required?: boolean; done?: boolean }) {
  return (
    <label className="block">
      <Label text={label} required={required} />
      {done && <span className="mb-1 block text-xs font-semibold text-green-700">Received from DigiLocker. Upload only to replace it. / டிஜிலாக்கரிலிருந்து பெறப்பட்டது.</span>}
      <input type="file" name={name} className="input" accept="image/*,application/pdf" required={required} />
    </label>
  );
}
