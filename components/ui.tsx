"use client";
import { useEffect } from "react";
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

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-6" onMouseDown={onClose}>
      <div role="dialog" aria-label={title} className={`card w-full ${wide ? "max-w-4xl" : "max-w-xl"} my-4`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between rounded-t-lg bg-brand px-4 py-2.5 text-white">
          <h2 className="text-sm font-bold">{title}</h2>
          <button onClick={onClose} className="text-xl leading-none text-white/80 hover:text-white" aria-label="Close">×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
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
  return <div className={`mb-3 rounded px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.message}</div>;
}
