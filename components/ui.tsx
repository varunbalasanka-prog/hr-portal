"use client";
import { useEffect, useRef } from "react";
import type { Tone } from "@/lib/categorize";

const TONES: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 border-slate-300",
  sky: "bg-sky-50 text-sky-800 border-sky-300",
  indigo: "bg-indigo-50 text-indigo-800 border-indigo-300",
  green: "bg-green-50 text-green-800 border-green-300",
  amber: "bg-amber-50 text-amber-800 border-amber-300",
  red: "bg-red-50 text-red-700 border-red-300",
  zinc: "bg-zinc-800 text-white border-zinc-800",
  purple: "bg-purple-50 text-purple-800 border-purple-300",
};

export function Badge({ tone = "slate", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-semibold ${TONES[tone]}`}>{children}</span>;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    // Keep keyboard focus inside the dialog, and give it back to whatever opened it.
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close.current();
      if (e.key !== "Tab" || !box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); opener?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-6" onMouseDown={onClose}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} className={`card w-full ${wide ? "max-w-4xl" : "max-w-xl"} my-4`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between rounded-t-lg bg-brand px-4 py-2.5 text-white">
          <h2 className="text-sm font-bold">{title}</h2>
          <button onClick={onClose} className="text-xl leading-none text-white/80 hover:text-white" aria-label="Close">×</button>
        </div>
        <div className="p-4">{children}</div>
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
  return <div role={msg.ok ? "status" : "alert"} className={`mb-3 rounded px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.message}</div>;
}
