"use client";
import { useState, useTransition } from "react";
import { submitApplication } from "./actions";
import { POSTS } from "./fields";

export type BranchOption = { id: string; name: string; town: string; business_type: string };

export function ApplyForm({ branches }: { branches: BranchOption[] }) {
  const [experienced, setExperienced] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const towns = [...new Set(branches.map((b) => b.town))];

  if (done) {
    return (
      <div className="py-6 text-center">
        <h2 className="mb-2 text-lg font-bold text-green-700">Application submitted</h2>
        <p className="text-sm text-slate-600">Thank you. Our HR team will call you soon.</p>
        <p className="mt-1 text-sm text-slate-600">நன்றி. எங்கள் HR குழு விரைவில் உங்களைத் தொடர்பு கொள்ளும்.</p>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      action={(fd) => start(async () => {
        const r = await submitApplication(fd);
        if (r.ok) setDone(true); else { setError(r.message); window.scrollTo({ top: 0, behavior: "smooth" }); }
      })}
    >
      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Section n={1} title="Job you are applying for">
        <label className="block sm:col-span-2">
          <span className="label">Branch / கிளை *</span>
          <select name="branch_id" className="input" required defaultValue="">
            <option value="">-- Select --</option>
            {towns.map((t) => (
              <optgroup key={t} label={t}>
                {branches.filter((b) => b.town === t).map((b) => <option key={b.id} value={b.id}>{b.name} ({b.business_type})</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Post applying for / பதவி *</span>
          <input name="post" className="input" list="posts" required maxLength={120} placeholder="Choose or type" />
          <datalist id="posts">{POSTS.map((p) => <option key={p} value={p} />)}</datalist>
        </label>
      </Section>

      <Section n={2} title="About you">
        <Input name="name" label="Full name / பெயர் *" required maxLength={120} />
        <Input name="mobile" label="Mobile number *" inputMode="tel" pattern="[0-9+ ]{10,14}" required />
        <Input name="father_name" label="Father's / husband's name *" required maxLength={120} />
        <Choice name="gender" label="Gender *" options={["Male", "Female", "Other"]} required />
        <Input name="dob" label="Date of birth *" type="date" required />
        <Choice name="marital_status" label="Marital status *" options={["Single", "Married"]} required />
        <Input name="email" label="Email" type="email" maxLength={120} />
        <Input name="qualification" label="Educational qualification *" required maxLength={200} />
        <label className="block sm:col-span-2">
          <span className="label">Address *</span>
          <textarea name="address" className="input" rows={2} required maxLength={500} />
        </label>
      </Section>

      <Section n={3} title="Experience">
        <Choice name="experience_level" label="Fresher or experienced? *" options={["Fresher", "Experienced"]} value={experienced} onChange={setExperienced} required />
        <Input name="expected_salary" label="Expected salary (per month)" inputMode="numeric" maxLength={40} />
        {experienced === "Experienced" && (
          <>
            <Input name="last_company" label="Last company & total experience *" required maxLength={300} />
            <Input name="last_salary" label="Last drawn salary *" inputMode="numeric" required maxLength={40} />
            <FileIn name="experience_certificate" label="Experience certificate" />
            <FileIn name="salary_proof" label="Salary proof (payslip / bank statement)" />
          </>
        )}
      </Section>

      <Section n={4} title="Documents">
        <FileIn name="photo" label="Passport size photo * (take a photo or upload)" required />
        <FileIn name="resume" label="Resume / biodata" />
      </Section>

      <p className="text-xs text-slate-500">Photos or PDFs only, up to 8 MB each. Your details are stored privately and only our HR team can see them.</p>
      <button className="btn-primary h-11 w-full" disabled={pending}>{pending ? "Submitting… please wait" : "Submit application"}</button>
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
