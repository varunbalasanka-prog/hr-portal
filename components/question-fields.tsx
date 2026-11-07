"use client";
import { useState } from "react";
import { fieldName, latestDate, MAX_ANSWER, splitBilingual, todayInIndia, type ApplyQuestion } from "@/lib/apply-questions";

/** Form pieces shared by the apply page (/apply) and the after-interview details page (/details/<link>). */

export const SELECT = "-- Select / தேர்வு செய்க --";

// long questions get the full row so their answer box isn't squeezed
const wide = (q: ApplyQuestion) =>
  q.type === "long_text" || splitBilingual(q.label)[0].length > 42 || q.options.some((o) => o.length > 24);

export /** The browser's own "Please fill in this field" bubbles are English only, so give every box a Tamil + English message. */
function bilingualMessage(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  const v = el.validity;
  if (v.valueMissing) {
    if (el instanceof HTMLInputElement && el.type === "checkbox") return "Please tick this box to continue. / தொடர இந்தப் பெட்டியில் டிக் செய்யவும்.";
    if (el instanceof HTMLInputElement && el.type === "file") return "Please attach this file. / இந்தக் கோப்பை இணைக்கவும்.";
    if (el instanceof HTMLSelectElement) return "Please choose one. / ஒன்றைத் தேர்வு செய்யவும்.";
    return "Please fill this in. / இதை நிரப்பவும்.";
  }
  if (v.typeMismatch && el.type === "email") return "Please enter a valid email, like name@gmail.com. / சரியான மின்னஞ்சலை உள்ளிடவும்.";
  if (v.tooLong) return "This answer is too long. / இந்தப் பதில் மிக நீளம்.";
  return "Please check this answer. / இந்தப் பதிலைச் சரிபார்க்கவும்.";
}

export function Question({ q, value, error, onChoose }: { q: ApplyQuestion; value: string; error?: string; onChoose: (v: string) => void }) {
  const name = fieldName(q);
  const field = (control: React.ReactNode) => <Field label={q.label} required={q.required} wide={wide(q)} error={error}>{control}</Field>;
  switch (q.type) {
    case "choice":
      return field(
        <select name={name} className="input h-10" required={q.required} value={value} onChange={(e) => onChoose(e.target.value)}>
          <option value="">{SELECT}</option>
          {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>,
      );
    case "long_text":
      return field(<textarea name={name} className="input" rows={3} required={q.required} maxLength={MAX_ANSWER.long_text} />);
    case "file":
      return field(
        <input type="file" name={name} accept="image/*,application/pdf" required={q.required}
          className="block h-10 w-full overflow-hidden rounded-md border border-slate-300 bg-white text-sm text-slate-700 file:mr-3 file:h-full file:cursor-pointer file:border-0 file:border-r file:border-slate-300 file:bg-slate-100 file:px-3 file:text-sm file:font-semibold file:text-slate-800 hover:file:bg-slate-200" />,
      );
    case "date":
      return field(q.min_age
        ? <DateParts name={name} required={q.required} latest={latestDate(q.min_age, todayInIndia())} />
        : <input name={name} className="input h-10" type="date" required={q.required} />);
    case "number":
      return field(<input name={name} className="input h-10" inputMode="numeric" required={q.required} maxLength={MAX_ANSWER.number} />);
    default:
      return field(<input name={name} className="input h-10" required={q.required} maxLength={MAX_ANSWER.text} />);
  }
}

const MONTHS = ["Jan / ஜன", "Feb / பிப்", "Mar / மார்", "Apr / ஏப்", "May / மே", "Jun / ஜூன்", "Jul / ஜூலை", "Aug / ஆக", "Sep / செப்", "Oct / அக்", "Nov / நவ", "Dec / டிச"];

/** Day / month / year dropdowns: phones show the native date box as mm/dd/yyyy, which confuses Indian users. */
export function DateParts({ name, required, latest }: { name: string; required: boolean; latest: string }) {
  const [d, setD] = useState("");
  const [m, setM] = useState("");
  const [y, setY] = useState("");
  const maxYear = Number(latest.slice(0, 4));
  const years = Array.from({ length: 60 }, (_, i) => maxYear - i);
  // Only days that exist in the chosen month (no 31 February); 29 Feb only in leap years.
  const daysIn = (mm: string, yy: string) => (mm ? new Date(Number(yy) || 2000, Number(mm), 0).getDate() : 31);
  const maxDay = daysIn(m, y);
  const pick = (mm: string, yy: string) => { if (Number(d) > daysIn(mm, yy)) setD(""); };
  const value = d && m && y ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : "";
  return (
    <div className="grid grid-cols-[1fr_1.4fr_1.2fr] gap-2">
      <select className="input h-10" aria-label="Day / நாள்" required={required} value={d} onChange={(e) => setD(e.target.value)}>
        <option value="">Day</option>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <select className="input h-10" aria-label="Month / மாதம்" required={required} value={m} onChange={(e) => { setM(e.target.value); pick(e.target.value, y); }}>
        <option value="">Month</option>
        {MONTHS.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
      </select>
      <select className="input h-10" aria-label="Year / ஆண்டு" required={required} value={y} onChange={(e) => { setY(e.target.value); pick(m, e.target.value); }}>
        <option value="">Year</option>
        {years.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

/** English on the first line, Tamil under it, and the box pinned to the bottom so boxes in a row line up. */
export function Field({ label, required, wide, error, children }: { label: string; required?: boolean; wide?: boolean; error?: string; children: React.ReactNode }) {
  const [en, ta] = splitBilingual(label);
  return (
    <label className={`flex flex-col ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 flex-1">
        <span className="block text-sm font-semibold text-slate-800">{en}{required && <span className="ml-0.5 text-red-700">*</span>}</span>
        {ta && <span className="block text-xs text-slate-600">{ta}</span>}
      </span>
      {children}
      {error && <span role="alert" className="mt-1 text-xs font-semibold text-red-700">{error}</span>}
    </label>
  );
}

export function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  const [en, ta] = splitBilingual(title);
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white" aria-hidden>{n}</span>
        <h2>
          <span className="block text-sm font-bold text-brand">{en}</span>
          {ta && <span className="block text-xs font-semibold text-slate-600">{ta}</span>}
        </h2>
      </header>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 p-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
