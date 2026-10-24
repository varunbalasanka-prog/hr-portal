"use client";
import { useState } from "react";
import Link from "next/link";
import { BLOOD_GROUPS, DOC_LABELS, RELATIONSHIPS } from "@/lib/onboarding";
import { splitBilingual } from "@/lib/apply-questions";
import { browserStorage, checkFile, extFor, shrinkImage } from "@/lib/upload-client";
import { submitOnboarding } from "./actions";

type Cand = { name: string; mobile: string; branch: string; address: string; father_name: string; marital_status: string; email: string };

const SELECT = "-- Select / தேர்வு செய்க --";
const en = (label: string) => splitBilingual(label)[0];

/** Files upload from the browser into "<token>/" in private storage; the server only receives their paths.
 *  Only the three mandatory documents are required. Family documents are optional and asked only for ESI / PF nomination. */
export function OnboardingForm({ token, cand, resubmit }: { token: string; cand: Cand; resubmit: boolean }) {
  const [marital, setMarital] = useState(cand.marital_status === "Single" ? "Unmarried" : cand.marital_status);
  const [relation, setRelation] = useState("");
  const [esi, setEsi] = useState("");
  const [uan, setUan] = useState("");
  const [kids, setKids] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState("");
  const req = !resubmit; // on re-submission, already-uploaded files are kept

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

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      {error && <div role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Section n={1} title="Basic information / அடிப்படை விவரங்கள்">
        <Static label="Name / பெயர்" value={cand.name} />
        <Static label="Mobile / கைபேசி" value={cand.mobile} />
        <Static label="Branch / கிளை" value={cand.branch} />
        <Static label="Address / முகவரி" value={cand.address || "-"} />
        <Input name="father_name" label="Father's / husband's name / தந்தை / கணவர் பெயர்" defaultValue={cand.father_name} required />
        <Choice name="marital_status" label="Marital status / திருமண நிலை" value={marital} onChange={setMarital}
          options={["Married / திருமணம் ஆனவர்", "Unmarried / திருமணம் ஆகாதவர்"]} required />
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

      <Section n={3} title="Mandatory documents / கட்டாய ஆவணங்கள்">
        <p className="rounded bg-sky-50 p-2 text-xs text-sky-900 sm:col-span-2">
          Please upload a <b>masked Aadhaar</b> (only the last 4 digits visible). Download it free from myaadhaar.uidai.gov.in, or cover the first 8 digits before taking the photo.
          <br />மறைக்கப்பட்ட ஆதாரைப் பதிவேற்றவும் (கடைசி 4 இலக்கங்கள் மட்டும் தெரியும்). myaadhaar.uidai.gov.in-இல் இலவசமாகப் பதிவிறக்கலாம், அல்லது முதல் 8 இலக்கங்களை மறைத்து புகைப்படம் எடுக்கவும்.
        </p>
        <FileIn name="aadhar" label={DOC_LABELS.aadhar} required={req} />
        <FileIn name="school_certificate" label={DOC_LABELS.school_certificate} required={req} />
        <FileIn name="passport_photo" label={DOC_LABELS.passport_photo} required={req} />
      </Section>

      <Section n={4} title="Other documents (optional) / மற்ற ஆவணங்கள் (விருப்பம்)">
        <FileIn name="bank_passbook" label={DOC_LABELS.bank_passbook} />
        <FileIn name="pan_card" label={DOC_LABELS.pan_card} />
        <FileIn name="driving_license" label={DOC_LABELS.driving_license} />
      </Section>

      <Section n={5} title="PF & ESI">
        <Choice name="esi_status" label="Do you have an ESI number? / ESI எண் உள்ளதா?" value={esi} onChange={setEsi} options={["Yes / ஆம்", "No / இல்லை"]} required />
        {esi === "Yes" && <Input name="esi_number" label="ESI number / ESI எண்" required />}
        <Choice name="uan_status" label="Do you have a UAN (PF) number? / UAN (PF) எண் உள்ளதா?" value={uan} onChange={setUan} options={["Yes / ஆம்", "No / இல்லை"]} required />
        {uan === "Yes" && <Input name="uan_number" label="UAN number / UAN எண்" required />}
      </Section>

      <Section n={6} title="Family details for ESI / PF nomination (optional) / ESI / PF நியமனத்திற்கான குடும்ப விவரங்கள் (விருப்பம்)">
        <p className="text-xs text-slate-600 sm:col-span-2">Only fill this if you want them covered under ESI or named as PF nominee. Masked Aadhaar only.
          <br />ESI காப்பீடு அல்லது PF நியமனத்திற்கு மட்டும் நிரப்பவும். மறைக்கப்பட்ட ஆதார் மட்டும்.</p>
        {marital !== "Married" ? (
          <>
            <FileIn name="father_aadhar" label={DOC_LABELS.father_aadhar} />
            <FileIn name="father_photo" label={DOC_LABELS.father_photo} />
            <Input name="mother_name" label="Mother name / தாய் பெயர்" />
            <FileIn name="mother_aadhar" label={DOC_LABELS.mother_aadhar} />
            <FileIn name="mother_photo" label={DOC_LABELS.mother_photo} />
          </>
        ) : (
          <>
            <Input name="spouse_name" label="Spouse name / வாழ்க்கைத் துணை பெயர்" />
            <FileIn name="spouse_aadhar" label={DOC_LABELS.spouse_aadhar} />
            <FileIn name="spouse_photo" label={DOC_LABELS.spouse_photo} />
            <label className="block">
              <span className="label">Number of children / குழந்தைகள் எண்ணிக்கை</span>
              <select name="kids_count" className="input" value={kids} onChange={(e) => setKids(Number(e.target.value))}>
                {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            {Array.from({ length: kids }, (_, i) => i + 1).map((i) => (
              <div key={i} className="space-y-2 rounded border border-slate-200 p-2 sm:col-span-2">
                <div className="text-xs font-bold">Child {i} / குழந்தை {i}</div>
                <Input name={`kid_${i}_name`} label="Name / பெயர்" />
                <FileIn name={`kid_${i}_aadhar`} label={DOC_LABELS[`kid_${i}_aadhar`]} />
                <FileIn name={`kid_${i}_photo`} label={DOC_LABELS[`kid_${i}_photo`]} />
              </div>
            ))}
          </>
        )}
      </Section>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="text-slate-700">We use these details and documents only for your employment: payroll, PF, ESI, emergencies and legal records. Only HR and administrators can see them.
          <Link href="/privacy" target="_blank" className="ml-1 text-sky-800 underline">Privacy notice</Link></p>
        <p className="mt-1 text-slate-600">இந்த விவரங்களும் ஆவணங்களும் உங்கள் பணிக்காக மட்டுமே (சம்பளம், PF, ESI, அவசரநிலை, சட்டப் பதிவுகள்) பயன்படுத்தப்படும். HR மற்றும் நிர்வாகிகள் மட்டுமே பார்க்க முடியும்.</p>
        <label className="mt-2 flex items-start gap-2 font-semibold">
          <input type="checkbox" name="consent" value="yes" required className="mt-1 h-5 w-5 shrink-0" />
          <span>I agree. / நான் ஒப்புக்கொள்கிறேன். <span className="text-red-700">*</span></span>
        </label>
      </div>

      <p className="text-xs text-slate-600">Photos or PDFs only, up to 8 MB each. Large photos are made smaller on your phone first.
        <br />புகைப்படம் அல்லது PDF மட்டும், ஒவ்வொன்றும் 8 MB வரை.</p>
      <button className="btn-primary h-11 w-full" disabled={!!progress} aria-live="polite">
        {progress || (resubmit ? "Re-submit documents / மீண்டும் சமர்ப்பிக்கவும்" : "Submit / சமர்ப்பிக்கவும்")}
      </button>
    </form>
  );
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

function FileIn({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return (
    <label className="block">
      <Label text={label} required={required} />
      <input type="file" name={name} className="input" accept="image/*,application/pdf" required={required} />
    </label>
  );
}
