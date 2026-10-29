"use client";
import { useState } from "react";
import type { Showroom, ShowroomGroup } from "@/lib/group";

const mapLink = (s: Showroom) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.brand} ${s.street}, ${s.town}, Tamil Nadu ${s.pin}`)}`;

/** Town chips over a list of showrooms; "All towns" by default so search engines see every address. */
export function ShowroomFinder({ groups, towns }: { groups: ShowroomGroup[]; towns: string[] }) {
  const [town, setTown] = useState<string | null>(null);
  const rows = groups.flatMap((g) => g.showrooms.map((s) => ({ ...s, kind: g.title })))
    .filter((s) => !town || s.town === town)
    .sort((a, b) => a.town.localeCompare(b.town) || a.brand.localeCompare(b.brand));
  const chip = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm font-semibold transition ${active ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-700 hover:border-brand hover:text-brand"}`;
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by town">
        <button type="button" className={chip(town === null)} aria-pressed={town === null} onClick={() => setTown(null)}>All towns</button>
        {towns.map((t) => (
          <button key={t} type="button" className={chip(town === t)} aria-pressed={town === t} onClick={() => setTown(t)}>{t}</button>
        ))}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((s) => (
          <li key={`${s.brand}-${s.town}`} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand/40 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#d9261c]">{s.town} · {s.kind}</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">{s.brand}</h3>
            <address className="mt-2 flex-1 text-sm not-italic leading-relaxed text-slate-600">
              {s.street}, {s.town}, Tamil Nadu {s.pin}
            </address>
            <a href={mapLink(s)} target="_blank" rel="noopener" className="mt-4 inline-flex items-center gap-1 self-start text-sm font-semibold text-brand hover:underline">
              Get directions <span aria-hidden>→</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
