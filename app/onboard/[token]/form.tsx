"use client";
import { useState, useTransition } from "react";
import { BLOOD_GROUPS, RELATIONSHIPS } from "@/lib/onboarding";
import { submitOnboarding } from "./actions";

type Cand = { name: string; mobile: string; branch: string; address: string; father_name: string; marital_status: string; email: string };

export function OnboardingForm({ token, cand, resubmit }: { token: string; cand: Cand; resubmit: boolean }) {
  const [marital, setMarital] = useState(cand.marital_status);
  const [relation, setRelation] = useState("");
  const [esi, setEsi] = useState("");
  const [uan, setUan] = useState("");
  const [kids, setKids] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const req = !resubmit; // on re-submission, already-uploaded files are kept

  if (done) {
    return (
      <div className="py-6 text-center">
        <h2 className="mb-2 text-lg font-bold text-green-700">Submitted successfully</h2>
        <p className="text-sm text-slate-600">Thank you, {cand.name}. HR will verify your documents. You can close this page.</p>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      action={(fd) => start(async () => {
        if (relation === "Other") fd.set("emergency_relationship", String(fd.get("other_relationship") ?? "Other"));
        const r = await submitOnboarding(token, fd);
        if (r.ok) setDone(true); else { setError(r.message); window.scrollTo({ top: 0, behavior: "smooth" }); }
      })}
    >
      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Section n={1} title="Basic information">
        <Static label="Name" value={cand.name} />
        <Static label="Mobile" value={cand.mobile} />
        <Static label="Branch" value={cand.branch} />
        <Static label="Address" value={cand.address || "-"} />
        <Input name="father_name" label="Father's / husband's name *" defaultValue={cand.father_name} required />
        <Choice name="marital_status" label="Marital status *" value={marital} onChange={setMarital} options={["Married", "Unmarried"]} required />
        {marital === "Married" && <Input name="wedding_date" label="Wedding date" type="date" />}
        <Input name="email" label="Email *" type="email" defaultValue={cand.email} required />
      </Section>

      <Section n={2} title="Emergency contact">
        <Choice name="blood_group" label="Blood group *" options={BLOOD_GROUPS} required />
        <Input name="emergency_name" label="Contact person name *" required />
        <Choice name="emergency_relationship" label="Relationship *" value={relation} onChange={setRelation} options={RELATIONSHIPS} required />
        {relation === "Other" && <Input name="other_relationship" label="Specify relationship *" required />}
        <Input name="emergency_mobile" label="Contact mobile *" inputMode="tel" pattern="[0-9+ ]{10,14}" required />
      </Section>

      <Section n={3} title="Mandatory documents">
        <FileIn name="aadhar" label="Aadhar card *" required={req} />
        <FileIn name="school_certificate" label="School / college certificate *" required={req} />
        <FileIn name="passport_photo" label="Passport size photo * (take a photo or upload)" required={req} />
      </Section>

      <Section n={4} title="Other documents (optional)">
        <FileIn name="bank_passbook" label="Bank pass book" />
        <FileIn name="pan_card" label="PAN card" />
        <FileIn name="driving_license" label="Driving license" />
      </Section>

      <Section n={5} title="PF & ESI">
        <Choice name="esi_status" label="Do you have an ESI number? *" value={esi} onChange={setEsi} options={["Yes", "No"]} required />
        {esi === "Yes" && <Input name="esi_number" label="ESI number *" required />}
        <Choice name="uan_status" label="Do you have a UAN (PF) number? *" value={uan} onChange={setUan} options={["Yes", "No"]} required />
        {uan === "Yes" && <Input name="uan_number" label="UAN number *" required />}
      </Section>

      <Section n={6} title="Family details">
        {marital !== "Married" ? (
          <>
            <FileIn name="father_aadhar" label="Father Aadhar card *" required={req} />
            <FileIn name="father_photo" label="Father photo *" required={req} />
            <Input name="mother_name" label="Mother name *" required />
            <FileIn name="mother_aadhar" label="Mother Aadhar card *" required={req} />
            <FileIn name="mother_photo" label="Mother photo *" required={req} />
          </>
        ) : (
          <>
            <Input name="spouse_name" label="Spouse name" />
            <FileIn name="spouse_aadhar" label="Spouse Aadhar card" />
            <FileIn name="spouse_photo" label="Spouse photo" />
            <label className="block">
              <span className="label">Number of kids *</span>
              <select name="kids_count" className="input" value={kids} onChange={(e) => setKids(Number(e.target.value))}>
                {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            {Array.from({ length: kids }, (_, i) => i + 1).map((i) => (
              <div key={i} className="space-y-2 rounded border border-slate-200 p-2 sm:col-span-2">
                <div className="text-xs font-bold">Kid {i}</div>
                <Input name={`kid_${i}_name`} label="Name *" required />
                <FileIn name={`kid_${i}_aadhar`} label="Aadhar card *" required={req} />
                <FileIn name={`kid_${i}_photo`} label="Photo *" required={req} />
              </div>
            ))}
          </>
        )}
      </Section>

      <p className="text-xs text-slate-500">Photos or PDFs only, up to 8 MB each. Your documents are stored privately and only HR can see them.</p>
      <button className="btn-primary h-11 w-full" disabled={pending}>{pending ? "Uploading… please wait" : resubmit ? "Re-submit documents" : "Submit"}</button>
    </form>
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
  return <div><span className="label">{label}</span><div className="rounded-md bg-slate-100 px-2.5 py-1.5 text-sm">{value}</div></div>;
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block"><span className="label">{label}</span><input className="input" {...props} /></label>;
}

function Choice({ name, label, options, value, onChange, required }: { name: string; label: string; options: string[]; value?: string; onChange?: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select name={name} className="input" required={required} {...(onChange ? { value: value ?? "", onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value) } : {})}>
        <option value="">-- Select --</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function FileIn({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input type="file" name={name} className="input" accept="image/*,application/pdf" required={required} />
    </label>
  );
}
