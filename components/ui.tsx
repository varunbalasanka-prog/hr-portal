"use client";
import { useEffect, useRef } from "react";
import type { Tone } from "@/lib/categorize";

const TONES: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  sky: "bg-sky-50 text-sky-800 ring-sky-200",
  indigo: "bg-violet-50 text-violet-800 ring-violet-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  zinc: "bg-zinc-100 text-zinc-700 ring-zinc-300",
  purple: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200",
};
const DOTS: Record<Tone, string> = {
  slate: "bg-slate-400", sky: "bg-sky-500", indigo: "bg-violet-500", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", zinc: "bg-zinc-500", purple: "bg-fuchsia-500",
};

export function Badge({ tone = "slate", children, dot }: { tone?: Tone; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TONES[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOTS[tone]}`} aria-hidden />}{children}
    </span>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** `locked`: no close button, Escape or outside click (for steps that must be finished, like the store's joining details).
 *  `side`: a full-height panel from the right (full screen on phones), for records you read while working. */
export function Modal({ open, onClose, title, subtitle, children, wide, locked, side }: { open: boolean; onClose: () => void; title: string; subtitle?: React.ReactNode; children: React.ReactNode; wide?: boolean; locked?: boolean; side?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    // Keep keyboard focus inside the dialog, and give it back to whatever opened it.
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return locked ? undefined : close.current();
      if (e.key !== "Tab" || !box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); opener?.focus?.(); };
  }, [open, locked]);
  if (!open) return null;
  const head = (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {subtitle && <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {!locked && <button onClick={onClose} className="-mr-1.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>}
    </div>
  );
  if (side) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onMouseDown={locked ? undefined : onClose}>
        <div ref={box} role="dialog" aria-modal="true" aria-label={title} className="flex h-full w-full flex-col bg-white shadow-pop sm:max-w-3xl sm:rounded-l-2xl" onMouseDown={(e) => e.stopPropagation()}>
          {head}
          <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-2 sm:p-6" onMouseDown={locked ? undefined : onClose}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} className={`w-full rounded-2xl bg-white shadow-pop ${wide ? "max-w-4xl" : "max-w-xl"} my-4 sm:my-10`} onMouseDown={(e) => e.stopPropagation()}>
        {head}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/** Server actions run on Vercel, which refuses request bodies over 4.5 MB; stop bigger files in the browser. */
export const MAX_ACTION_FILE = 4 * 1024 * 1024;
export function tooBig(e: React.ChangeEvent<HTMLInputElement>) {
  const f = e.target.files?.[0];
  if (f && f.size > MAX_ACTION_FILE) { alert("File must be under 4 MB."); e.target.value = ""; }
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}

export function Select({ value, onChange, options, placeholder = "-- Select --", name }: { value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; placeholder?: string; name?: string }) {
  return (
    <select name={name} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Flash({ msg }: { msg: { ok: boolean; message: string } | null }) {
  if (!msg) return null;
  return <div role={msg.ok ? "status" : "alert"} className={`mb-3 rounded-lg px-3 py-2 text-sm ring-1 ring-inset ${msg.ok ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"}`}>{msg.message}</div>;
}
