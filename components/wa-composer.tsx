"use client";
import { useMemo, useState, useTransition } from "react";
import { WA_TEMPLATES, waLink, type WaContext } from "@/lib/wa-templates";
import { sendCandidateWhatsApp } from "@/app/actions/whatsapp";
import { Flash, Modal } from "./ui";

/** Pick a ready-made Tamil + English message, adjust it, then open WhatsApp (or send through the API when set up). */
export function WaComposer({ candidateId, mobile, ctx, links, apiEnabled, onSent }: {
  candidateId: string; mobile: string; ctx: Omit<WaContext, "link" | "when">; links: Record<string, string>; apiEnabled: boolean; onSent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(WA_TEMPLATES[0].key);
  const [when, setWhen] = useState("");
  const [text, setText] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const t = WA_TEMPLATES.find((x) => x.key === key)!;
  const link = links[key === "resubmit" ? "onboarding" : key] ?? "";
  const filled = useMemo(() => t.text({ ...ctx, when: when || "____", link: link || "____" }), [t, ctx, when, link]);
  const body = text ?? filled;
  const missingLink = t.needs?.includes("link") && !link;

  return (
    <>
      <button className="btn-outline !py-1 text-xs" onClick={() => setOpen(true)}>WhatsApp ▾</button>
      <Modal open={open} onClose={() => setOpen(false)} title="WhatsApp message">
        <div className="space-y-3 text-sm">
          <label className="block"><span className="label">Message</span>
            <select className="input" value={key} onChange={(e) => { setKey(e.target.value); setText(null); }}>
              {WA_TEMPLATES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </select>
          </label>
          {t.needs?.includes("when") && (
            <label className="block"><span className="label">Date and time to show</span>
              <input className="input" value={when} onChange={(e) => { setWhen(e.target.value); setText(null); }} placeholder="e.g. Mon 27 Oct, 11:00 AM" />
            </label>
          )}
          {missingLink && <p className="rounded bg-amber-50 p-2 text-amber-800">This message needs the candidate&apos;s link, which isn&apos;t available at this stage yet.</p>}
          <label className="block"><span className="label">Text (you can edit it)</span>
            <textarea className="input font-sans" rows={10} value={body} onChange={(e) => setText(e.target.value)} />
          </label>
          <Flash msg={msg} />
          <div className="flex flex-wrap gap-2">
            <a className="btn-success" href={waLink(mobile, body)} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>Open in WhatsApp</a>
            {apiEnabled && (
              <button className="btn-primary" disabled={pending} onClick={() => start(async () => {
                const r = await sendCandidateWhatsApp(candidateId, body, t.label); setMsg(r); if (r.ok) onSent();
              })}>Send now (Business API)</button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
