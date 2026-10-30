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
    `rounded-full border px-4 py-2 text-sm font-medium transition ${active ? "border-[#120e2e] bg-[#120e2e] text-white" : "border-[#1d1a2e]/15 bg-transparent text-[#4a4560] hover:border-[#c9a96e] hover:text-[#120e2e]"}`;
  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter by town">
        <button type="button" className={chip(town === null)} aria-pressed={town === null} onClick={() => setTown(null)}>All towns</button>
        {towns.map((t) => (
          <button key={t} type="button" className={chip(town === t)} aria-pressed={town === t} onClick={() => setTown(t)}>{t}</button>
        ))}
      </div>
      <ul className="grid overflow-hidden rounded-3xl border-l border-t border-[#1d1a2e]/10 bg-[#fbf8f2] sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((s) => (
          <li key={`${s.brand}-${s.town}`} className="group -mb-px -mr-px flex flex-col border-b border-r border-[#1d1a2e]/10 bg-[#fbf8f2] p-7 transition hover:bg-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9a7a45]">{s.town} · {s.kind}</p>
            <h3 className="mt-3 font-['Fraunces',Georgia,serif] text-xl font-medium text-[#120e2e]">{s.brand}</h3>
            <address className="mt-2 flex-1 text-sm not-italic leading-relaxed text-[#4a4560]">
              {s.street}, {s.town}, Tamil Nadu {s.pin}
            </address>
            <a href={mapLink(s)} target="_blank" rel="noopener" className="mt-5 inline-flex items-center gap-1.5 self-start text-sm font-medium text-[#120e2e] underline-offset-4 group-hover:underline">
              Get directions <span aria-hidden>→</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
