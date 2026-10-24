"use client";
import { useState, useTransition } from "react";
import { previewCleanup, savePrivacySettings } from "@/app/actions/privacy";
import { cleanRetention, type PrivacyContact } from "@/lib/privacy";
import { Field, Flash } from "@/components/ui";

/** Who candidates contact about their data (shown on /privacy), and how long closed records keep their details. */
export function PrivacyAdmin({ contact, months }: { contact: PrivacyContact; months: number | null }) {
  const [c, setC] = useState(contact);
  const [m, setM] = useState(months === null ? "" : String(months));
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof PrivacyContact) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: e.target.value });
  const valid = cleanRetention(m);
  return (
    <section className="card space-y-3 p-3 text-sm">
      <h2 className="text-sm font-bold">Privacy &amp; data retention</h2>
      <p className="text-slate-600">Shown to candidates on the <a className="text-sky-700 underline" href="/privacy" target="_blank">privacy page</a>. India&apos;s DPDP rules require a contact person who answers data requests.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Contact name or team *"><input className="input" value={c.name} onChange={set("name")} /></Field>
        <Field label="Phone"><input className="input" value={c.phone} onChange={set("phone")} inputMode="tel" /></Field>
        <Field label="Email"><input className="input" value={c.email} onChange={set("email")} type="email" /></Field>
        <Field label="Address"><input className="input" value={c.address} onChange={set("address")} /></Field>
      </div>
      <Field label="Remove details of closed candidates after (months, 6 or more; blank switches clean-up off)">
        <input className="input !w-32" value={m} onChange={(e) => setM(e.target.value)} inputMode="numeric" />
      </Field>
      <p className="text-xs text-slate-500">Each night, rejected, dropped and left candidates untouched for this long lose their address, answers, files and onboarding form. Name, mobile and status stay so re-apply rules still work.</p>
      <Flash msg={msg} />
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={pending} onClick={() => start(async () => setMsg(await savePrivacySettings(c, m)))}>Save</button>
        <button className="btn-outline" disabled={pending || valid === null} onClick={() => start(async () => setMsg(await previewCleanup(valid!)))}>How many would be cleaned?</button>
      </div>
    </section>
  );
}
