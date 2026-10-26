"use client";
import { useMemo, useState } from "react";
import { REPORT_REASONS } from "@/lib/pipeline";
import { Modal } from "@/components/ui";

export type ReportRow = {
  name: string; mobile: string; hr: string; source: "online" | "walkin"; received: string; location: string; status: string; reason: string;
  bucket: "in_followup" | "completed" | "dropped";
  channel: string; referred: boolean; contacted: boolean; interviewed: boolean; offered: boolean; joined: string | null; offer: "accepted" | "declined" | null;
};

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "-");
type Bucket = "received" | ReportRow["bucket"];

const CARDS: { key: Bucket; title: string; color: string }[] = [
  { key: "received", title: "Total received", color: "border-l-sky-600" },
  { key: "completed", title: "Completed / joined", color: "border-l-green-600" },
  { key: "dropped", title: "Dropped / rejected", color: "border-l-red-600" },
  { key: "in_followup", title: "In follow-up", color: "border-l-amber-500" },
];

export function Reports({ rows, branches, hrs }: { rows: ReportRow[]; branches: string[]; hrs: string[] }) {
  const [f, setF] = useState({ from: "", to: "", hr: "", location: "", reason: "", source: "" });
  const [drill, setDrill] = useState<Bucket | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const filtered = useMemo(() => rows.filter((r) =>
    (!f.from || r.received >= f.from) && (!f.to || r.received <= f.to) && (!f.hr || r.hr === f.hr)
    && (!f.location || r.location === f.location) && (!f.source || r.source === f.source)
    && (!f.reason || r.reason.toLowerCase().includes(f.reason.toLowerCase()))), [rows, f]);

  const inBucket = (r: ReportRow, b: Bucket) => b === "received" || r.bucket === b;
  const count = (b: Bucket, src?: string) => filtered.filter((r) => inBucket(r, b) && (!src || r.source === src)).length;

  const byLocation = useMemo(() => {
    const m = new Map<string, ReportRow[]>();
    filtered.forEach((r) => m.set(r.location, [...(m.get(r.location) ?? []), r]));
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const metrics = useMemo(() => {
    const joined = filtered.filter((r) => r.joined);
    const tth = joined.map((r) => daysBetween(r.received, r.joined!)).filter((d) => d >= 0);
    const answered = filtered.filter((r) => r.offer);
    const byChannel = new Map<string, ReportRow[]>();
    filtered.forEach((r) => byChannel.set(r.channel, [...(byChannel.get(r.channel) ?? []), r]));
    return {
      funnel: [
        ["Received", filtered.length], ["Contacted", filtered.filter((r) => r.contacted).length], ["Interviewed", filtered.filter((r) => r.interviewed).length],
        ["Selected / offered", filtered.filter((r) => r.offered).length], ["Joined", joined.length],
      ] as [string, number][],
      medianDays: median(tth),
      offerAccept: pct(answered.filter((r) => r.offer === "accepted").length, answered.length),
      referred: filtered.filter((r) => r.referred).length,
      channels: [...byChannel.entries()].sort((a, b) => b[1].length - a[1].length),
    };
  }, [filtered]);
  const exportHref = `/api/export?${new URLSearchParams({ from: f.from, to: f.to }).toString()}`;

  return (
    <div className="space-y-4 px-4 sm:px-6">
      <div className="flex justify-end"><a className="btn-outline" href={exportHref}>⬇ Download for Excel (CSV)</a></div>
      <div className="card grid grid-cols-2 gap-3 p-3 md:grid-cols-6">
        <label><span className="label">From</span><input type="date" className="input" value={f.from} onChange={set("from")} /></label>
        <label><span className="label">To</span><input type="date" className="input" value={f.to} onChange={set("to")} /></label>
        <label><span className="label">HR</span><select className="input" value={f.hr} onChange={set("hr")}><option value="">All</option>{hrs.map((h) => <option key={h}>{h}</option>)}</select></label>
        <label><span className="label">Location</span><select className="input" value={f.location} onChange={set("location")}><option value="">All</option>{branches.map((b) => <option key={b}>{b}</option>)}</select></label>
        <label><span className="label">Drop / reject reason</span><select className="input" value={f.reason} onChange={set("reason")}><option value="">All</option>{REPORT_REASONS.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label><span className="label">Source</span><select className="input" value={f.source} onChange={set("source")}><option value="">Online &amp; walk-in</option><option value="online">Online</option><option value="walkin">Walk-in</option></select></label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c) => (
          <button key={c.key} onClick={() => setDrill(c.key)} className={`card border-l-4 ${c.color} p-3 text-left hover:shadow-md`}>
            <div className="text-xs font-bold uppercase text-slate-500">{c.title}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{count(c.key)}</div>
            <div className="text-xs text-slate-600">Online {count(c.key, "online")} · Walk-in {count(c.key, "walkin")}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="card p-3">
          <h2 className="mb-2 text-sm font-bold">Hiring funnel</h2>
          {metrics.funnel.map(([label, n], i) => (
            <div key={label} className="mb-1.5">
              <div className="flex justify-between text-xs"><span>{label}</span><span className="tabular-nums">{n}{i > 0 && <span className="text-slate-500"> · {pct(n, metrics.funnel[i - 1][1])} of previous</span>}</span></div>
              <div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-sky-600" style={{ width: pct(n, metrics.funnel[0][1]) === "-" ? 0 : pct(n, metrics.funnel[0][1]) }} /></div>
            </div>
          ))}
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded bg-slate-50 p-2"><dt className="text-slate-500">Days to hire (median)</dt><dd className="text-xl font-bold tabular-nums">{metrics.medianDays ?? "-"}</dd></div>
            <div className="rounded bg-slate-50 p-2"><dt className="text-slate-500">Offers accepted online</dt><dd className="text-xl font-bold tabular-nums">{metrics.offerAccept}</dd></div>
            <div className="rounded bg-slate-50 p-2"><dt className="text-slate-500">Referred by staff</dt><dd className="text-xl font-bold tabular-nums">{metrics.referred}</dd></div>
          </dl>
        </div>
        <div className="card overflow-x-auto p-3">
          <h2 className="mb-2 text-sm font-bold">Where applicants come from</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-1.5">Source</th><th className="text-right">Applicants</th><th className="text-right">Joined</th><th className="text-right">Join rate</th></tr></thead>
            <tbody>{metrics.channels.map(([ch, rs]) => {
              const j = rs.filter((r) => r.joined).length;
              return <tr key={ch} className="border-b last:border-0"><td className="py-1.5">{ch}</td><td className="text-right tabular-nums">{rs.length}</td><td className="text-right tabular-nums">{j}</td><td className="text-right tabular-nums">{pct(j, rs.length)}</td></tr>;
            })}</tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-x-auto p-3">
        <h2 className="mb-2 text-sm font-bold">By branch / location</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-1.5">Branch</th><th className="text-right">Received</th><th className="text-right">Completed</th><th className="text-right">Dropped</th><th className="text-right">In follow-up</th><th className="text-right">Join rate</th></tr></thead>
          <tbody>{byLocation.map(([loc, rs]) => {
            const comp = rs.filter((r) => r.bucket === "completed").length;
            return (
              <tr key={loc} className="border-b last:border-0">
                <td className="py-1.5 font-medium">{loc}</td>
                <td className="text-right tabular-nums">{rs.length}</td>
                <td className="text-right tabular-nums">{comp}</td>
                <td className="text-right tabular-nums">{rs.filter((r) => r.bucket === "dropped").length}</td>
                <td className="text-right tabular-nums">{rs.filter((r) => r.bucket === "in_followup").length}</td>
                <td className="text-right tabular-nums">{rs.length ? Math.round((comp / rs.length) * 100) : 0}%</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>

      <Modal open={!!drill} onClose={() => setDrill(null)} title={CARDS.find((c) => c.key === drill)?.title ?? ""} wide>
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-left text-slate-500"><th>Name</th><th>Mobile</th><th>Location</th><th>HR</th><th>Status / reason</th><th>Source</th></tr></thead>
            <tbody>{drill && filtered.filter((r) => inBucket(r, drill)).map((r) => (
              <tr key={r.mobile} className="border-b"><td className="py-1 font-semibold">{r.name}</td><td>{r.mobile}</td><td>{r.location}</td><td>{r.hr}</td><td>{r.status}{r.reason ? ` (${r.reason})` : ""}</td><td>{r.source}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
