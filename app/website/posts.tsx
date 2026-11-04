"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePost, savePost } from "@/app/actions/website";
import { Badge, Field, Flash } from "@/components/ui";
import { showDate } from "@/lib/blog-format";
import { RichEditor } from "./rich-editor";
import { POST_CATEGORIES, checkPost, slugFromTitle, type PostCategory, type PostRow } from "@/lib/site";

type Msg = { ok: boolean; message: string } | null;
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const blank = (): PostRow => ({ slug: "", title: "", description: "", category: "jewellery", body: "", published_on: today(), checked_on: null, status: "draft" });

function stateOf(p: PostRow) {
  if (p.status === "draft") return { label: "Draft", tone: "amber" as const };
  if (p.published_on > today()) return { label: `Goes live ${showDate(p.published_on)}`, tone: "sky" as const };
  return { label: "Live", tone: "green" as const };
}

/** The blog: every post with its state, and an editor that shows the post as it will look. Drafts are never shown to visitors. */
export function PostsEditor({ rows, ready, viewBase }: { rows: PostRow[]; ready: boolean; viewBase: string }) {
  const [open, setOpen] = useState<PostRow | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const sorted = useMemo(() => [...rows].sort((a, b) => (a.status === b.status ? b.published_on.localeCompare(a.published_on) : a.status === "draft" ? -1 : 1)), [rows]);
  if (open) return <PostForm key={open.id ?? "new"} start={open} viewBase={viewBase} ready={ready} onClose={(m) => { setOpen(null); setMsg(m ?? null); }} />;
  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">{rows.filter((r) => r.status === "published").length} published, {rows.filter((r) => r.status === "draft").length} drafts.</p>
        <button className="btn-primary" disabled={!ready} onClick={() => setOpen(blank())}>+ New post</button>
      </div>
      <Flash msg={msg} />
      {sorted.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No posts yet.</p>}
      <ul className="divide-y divide-slate-100">
        {sorted.map((p) => {
          const st = stateOf(p);
          return (
            <li key={p.id ?? p.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{p.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Badge tone={st.tone}>{st.label}</Badge>{POST_CATEGORIES[p.category]} · {showDate(p.published_on)}
                </p>
              </div>
              {p.status === "published" && p.published_on <= today() && <a className="btn-ghost" href={`${viewBase}/blog/${p.slug}`} target="_blank" rel="noopener">View</a>}
              <button className="btn-outline" disabled={!ready} onClick={() => { setMsg(null); setOpen(p); }}>Edit</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PostForm({ start, viewBase, ready, onClose }: { start: PostRow; viewBase: string; ready: boolean; onClose: (m?: Msg) => void }) {
  const router = useRouter();
  const [p, setP] = useState(start);
  const [slugTouched, setSlugTouched] = useState(!!start.id);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, run] = useTransition();
  const wasLive = start.status === "published";
  const set = <K extends keyof PostRow>(k: K, v: PostRow[K]) => setP((x) => ({ ...x, [k]: v }));
  const words = p.body.split(/\s+/).filter(Boolean).length;

  const save = (status: PostRow["status"], close = false) => {
    const next = { ...p, status };
    const c = checkPost(next);
    if (!c.ok) return setMsg(c);
    run(async () => {
      const r = await savePost({ ...c.value, id: p.id });
      setMsg(r);
      if (r.ok) {
        setP({ ...next, id: r.id ?? p.id });
        setSlugTouched(true);
        router.refresh();
        if (close) onClose(r);
      }
    });
  };

  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className="btn-ghost" onClick={() => onClose()}>← All posts</button>
        <span className="ml-auto"><Badge tone={stateOf(p).tone}>{stateOf(p).label}</Badge></span>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Title *">
          <input className="input !text-base" value={p.title} maxLength={150} onChange={(e) => { set("title", e.target.value); if (!slugTouched) set("slug", slugFromTitle(e.target.value)); }} />
        </Field></div>
        <div className="sm:col-span-2"><Field label="One-line summary * (Google shows this under the title)">
          <textarea className="input" rows={2} maxLength={300} value={p.description} onChange={(e) => set("description", e.target.value)} />
        </Field></div>
        <Field label="Web address *">
          <div className="flex items-center gap-1"><span className="shrink-0 text-xs text-slate-500">balasanka.in/blog/</span>
            <input className="input" value={p.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")); }} /></div>
        </Field>
        <Field label="Category *">
          <select className="input" value={p.category} onChange={(e) => set("category", e.target.value as PostCategory)}>
            {Object.entries(POST_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Post date * (a future date waits until that day)"><input type="date" className="input" value={p.published_on} onChange={(e) => set("published_on", e.target.value)} /></Field>
        <Field label="Facts last checked on (optional)"><input type="date" className="input" value={p.checked_on ?? ""} onChange={(e) => set("checked_on", e.target.value || null)} /></Field>
      </div>
      {wasLive && p.slug !== start.slug && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Changing the web address of a live post breaks links people and Google already have.</p>}

      <div className="mt-4">
        <p className="label mb-1.5">Post text ({words} words)</p>
        <p className="mb-2 text-xs text-slate-500">Type as normal. Tap <b>Heading</b>, <b>List</b> or <b>Note box</b> for the line you are on, and tap it again to turn it off. It looks here as it does on the website.</p>
        <RichEditor value={start.body} onChange={(md) => set("body", md)} />
      </div>

      <div className="mt-4"><Flash msg={msg} /></div>
      <div className="flex flex-wrap items-center gap-2">
        {!wasLive || p.status === "draft" ? <>
          <button className="btn-outline" disabled={!ready || pending} onClick={() => save("draft")}>Save draft</button>
          <button className="btn-success" disabled={!ready || pending} onClick={() => { if (confirm("Publish this post on balasanka.in?")) save("published", true); }}>Publish</button>
        </> : <>
          <button className="btn-primary" disabled={!ready || pending} onClick={() => save("published")}>Save changes (live)</button>
          <button className="btn-outline" disabled={!ready || pending} onClick={() => { if (confirm("Take this post off the website? It stays here as a draft.")) save("draft"); }}>Unpublish</button>
          {p.published_on <= today() && <a className="btn-ghost" href={`${viewBase}/blog/${start.slug}`} target="_blank" rel="noopener">View live</a>}
        </>}
        {p.id && <button className="btn-danger ml-auto" disabled={!ready || pending} onClick={() => {
          if (confirm(`Delete "${p.title}" for good? This cannot be undone.`)) run(async () => { const r = await deletePost(p.id!); if (r.ok) { router.refresh(); onClose(r); } else setMsg(r); });
        }}>Delete</button>}
      </div>
    </section>
  );
}
