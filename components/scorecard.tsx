"use client";
import { useState, useTransition } from "react";
import { deleteScore, saveScore } from "@/app/actions/talent";
import { SCORE_AREAS, type ScoreRow } from "@/lib/scorecard";
import { formatDateTime } from "@/lib/dates";
import { Badge, Flash } from "./ui";

const REC = { hire: ["Hire", "green"], hold: ["Hold", "amber"], reject: ["Reject", "red"] } as const;

/** Each interviewer rates the candidate 1-5 on a few areas and recommends hire / hold / reject. */
export function Scorecard({ candidateId, me, scores, onSaved }: { candidateId: string; me: string; scores?: ScoreRow[]; onSaved: () => void }) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [rec, setRec] = useState<"" | "hire" | "hold" | "reject">("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  if (!scores) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-4 text-sm">
      <section className="space-y-2 rounded border border-slate-200 p-3">
        <h3 className="font-bold">Your scorecard</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SCORE_AREAS.map((a) => (
            <div key={a} className="flex items-center justify-between gap-2">
              <span>{a}</span>
              <span className="flex gap-1" role="radiogroup" aria-label={a}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={ratings[a] === n}
                    className={`h-8 w-8 rounded border text-sm font-semibold ${ratings[a] === n ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 bg-white"}`}
                    onClick={() => setRatings((r) => ({ ...r, [a]: n }))}>{n}</button>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(REC) as (keyof typeof REC)[]).map((k) => (
            <button key={k} type="button" className={`btn-outline ${rec === k ? "!border-sky-600 !bg-sky-50 font-bold" : ""}`} onClick={() => setRec(k)}>{REC[k][0]}</button>
          ))}
        </div>
        <textarea className="input" rows={2} placeholder="Notes (strengths, concerns, salary asked)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Flash msg={msg} />
        <button className="btn-primary" disabled={pending || !rec} onClick={() => start(async () => {
          const r = await saveScore(candidateId, { ratings, recommendation: rec as "hire", notes }); setMsg(r);
          if (r.ok) { setRatings({}); setRec(""); setNotes(""); onSaved(); }
        })}>Save scorecard</button>
      </section>

      {scores.length === 0 && <p className="text-slate-500">No scorecards yet.</p>}
      {scores.map((s) => (
        <div key={s.id} className="rounded border border-slate-200 p-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <b className="text-slate-800">{s.interviewer}</b> · {formatDateTime(s.created_at)}
            <Badge tone={REC[s.recommendation][1]}>{REC[s.recommendation][0]}</Badge>
            {s.overall && <span>Overall {s.overall}/5</span>}
            {s.interviewer === me && <button className="ml-auto text-red-700 underline" onClick={() => start(async () => { await deleteScore(s.id); onSaved(); })}>delete</button>}
          </div>
          <div className="mt-1 text-xs">{Object.entries(s.ratings).map(([k, v]) => `${k} ${v}`).join(" · ")}</div>
          {s.notes && <div className="mt-1">“{s.notes}”</div>}
        </div>
      ))}
    </div>
  );
}
