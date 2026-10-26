"use client";
import { useState, useTransition } from "react";
import { saveBranchPosts } from "@/app/actions/questions";
import { Badge, Flash } from "@/components/ui";

type Branch = { id: string; name: string; town: string; business_type: string };

/** Pick a store, tick the posts it is hiring for. Stores with nothing ticked don't appear on the apply page. */
export function BranchPostsAdmin({ branches, posts, open }: { branches: Branch[]; posts: string[]; open: Record<string, string[]> }) {
  const [selected, setSelected] = useState(branches[0]?.id ?? "");
  const [ticked, setTicked] = useState<string[]>(open[branches[0]?.id] ?? []);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const towns = [...new Set(branches.map((b) => b.town))];
  const branch = branches.find((b) => b.id === selected);
  const saved = open[selected] ?? [];
  const dirty = ticked.length !== saved.length || ticked.some((p) => !saved.includes(p));
  const sameType = branches.filter((b) => b.business_type === branch?.business_type && b.id !== selected);

  const pick = (id: string) => {
    if (dirty && !confirm("Discard the unsaved changes for this store?")) return;
    setSelected(id); setTicked(open[id] ?? []); setMsg(null);
  };
  const toggle = (p: string) => setTicked((t) => t.includes(p) ? t.filter((x) => x !== p) : [...t, p]);
  const save = (ids: string[]) => start(async () => setMsg(await saveBranchPosts(ids, ticked)));

  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-1 text-sm font-bold">Posts open at each store</h2>
      <p className="mb-2 text-xs text-slate-500">
        Applicants pick a store, then choose only from the posts ticked for it. A store with nothing ticked is hidden from the apply page.
        To add a brand-new post, add it to the post list below first.
      </p>
      <Flash msg={msg} />
      <div className="grid gap-3 md:grid-cols-[16rem_1fr]">
        <ul className="max-h-[28rem] overflow-y-auto rounded border border-slate-200 text-sm">
          {towns.map((t) => (
            <li key={t}>
              <div className="bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500">{t}</div>
              {branches.filter((b) => b.town === t).map((b) => {
                const n = (open[b.id] ?? []).length;
                return (
                  <button key={b.id} onClick={() => pick(b.id)}
                    className={`flex w-full items-center justify-between px-2 py-1.5 text-left hover:bg-sky-50 ${b.id === selected ? "bg-sky-100 font-semibold" : ""}`}>
                    <span>{b.name}</span>
                    {n ? <Badge tone="green">{n}</Badge> : <Badge tone="red">hidden</Badge>}
                  </button>
                );
              })}
            </li>
          ))}
        </ul>
        {branch && (
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div><b>{branch.name}</b> <Badge tone="slate">{branch.business_type}</Badge></div>
              <div className="flex gap-2 text-xs">
                <button className="text-sky-700 underline" onClick={() => setTicked(posts)}>Tick all</button>
                <button className="text-sky-700 underline" onClick={() => setTicked([])}>Clear all</button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-3">
              {posts.map((p) => (
                <label key={p} className={`flex items-center gap-2 rounded border px-2 py-1.5 text-sm ${ticked.includes(p) ? "border-green-300 bg-green-50" : "border-slate-200"}`}>
                  <input type="checkbox" checked={ticked.includes(p)} onChange={() => toggle(p)} /> {p}
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-primary" disabled={pending || !dirty} onClick={() => save([selected])}>{pending ? "Saving…" : dirty ? "Save this store" : "Saved"}</button>
              {sameType.length > 0 && (
                <button className="btn-outline" disabled={pending}
                  onClick={() => confirm(`Give all ${sameType.length + 1} ${branch.business_type} stores exactly these ${ticked.length} posts?`) && save([selected, ...sameType.map((b) => b.id)])}>
                  Copy to all {branch.business_type} stores
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
