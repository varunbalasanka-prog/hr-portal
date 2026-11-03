"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveContent, uploadLogo } from "@/app/actions/website";
import { Field, Flash } from "@/components/ui";
import { BUSINESS_KEYS, checkContent, type BrandChip, type ContentKey, type Showroom, type SiteContent } from "@/lib/site";

type Msg = { ok: boolean; message: string } | null;

/** One part of the site's words with its own Save button. Nothing changes on the site until Save. */
function Part<K extends ContentKey>({ k, title, help, value, ready, children }: {
  k: K; title: string; help?: React.ReactNode; value: SiteContent[K]; ready: boolean; children: React.ReactNode;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-3 p-4 text-sm sm:p-5">
      <div>
        <h2 className="text-sm font-bold">{title}</h2>
        {help && <p className="mt-0.5 text-slate-600">{help}</p>}
      </div>
      {children}
      <Flash msg={msg} />
      <button className="btn-primary" disabled={!ready || pending} onClick={() => {
        const problem = checkContent(k, value);
        if (problem) return setMsg({ ok: false, message: problem });
        start(async () => { const r = await saveContent(k, value); setMsg(r); if (r.ok) router.refresh(); });
      }}>{pending ? "Saving…" : "Save"}</button>
    </section>
  );
}

const Text = ({ label, value, onChange, rows = 1, max }: { label: string; value: string; onChange: (v: string) => void; rows?: number; max?: number }) => (
  <Field label={label}>
    {rows > 1
      ? <textarea className="input" rows={rows} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
      : <input className="input" maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />}
  </Field>
);

/** A list of items that can be added, removed and moved up or down. */
function List<T>({ items, onChange, blank, render, addLabel, max = 40 }: {
  items: T[]; onChange: (xs: T[]) => void; blank: () => T; render: (x: T, set: (x: T) => void, i: number) => React.ReactNode; addLabel: string; max?: number;
}) {
  const move = (i: number, by: number) => { const xs = [...items]; [xs[i], xs[i + by]] = [xs[i + by], xs[i]]; onChange(xs); };
  return (
    <div className="space-y-2">
      {items.map((x, i) => (
        <div key={i} className="flex gap-2 rounded-lg border border-slate-200 p-2.5">
          <div className="min-w-0 flex-1">{render(x, (v) => onChange(items.map((y, j) => (j === i ? v : y))), i)}</div>
          <div className="flex shrink-0 flex-col gap-1">
            <button type="button" className="btn-ghost !min-h-7 !px-2" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="btn-ghost !min-h-7 !px-2" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className="btn-ghost !min-h-7 !px-2 text-red-600" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
          </div>
        </div>
      ))}
      {items.length < max && <button type="button" className="btn-outline" onClick={() => onChange([...items, blank()])}>+ {addLabel}</button>}
    </div>
  );
}

const COUNTS = <>You can write <code>{"{showrooms}"}</code>, <code>{"{towns}"}</code> or <code>{"{town list}"}</code> and the site fills in today&apos;s numbers.</>;

export function WordsEditor({ content, showrooms, ready }: { content: SiteContent; showrooms: Showroom[]; ready: boolean }) {
  const [c, setC] = useState(content);
  const put = <K extends ContentKey>(k: K, v: SiteContent[K]) => setC((x) => ({ ...x, [k]: v }));
  const brands = [...new Set([...showrooms.map((s) => s.brand), ...Object.keys(c.brand_notes)])].sort();

  return (
    <div className="space-y-4">
      <Part k="home" title="Homepage" value={c.home} ready={ready} help={COUNTS}>
        <Text label="Introduction under the group name" rows={3} max={600} value={c.home.intro} onChange={(v) => put("home", { ...c.home, intro: v })} />
        <Text label="'Work with us' box" rows={2} max={600} value={c.home.careers} onChange={(v) => put("home", { ...c.home, careers: v })} />
      </Part>

      <Part k="businesses" title="Business titles and descriptions" value={c.businesses} ready={ready}
        help="Shown on the homepage, the menu and each business page. The page addresses stay the same.">
        {BUSINESS_KEYS.map((k) => (
          <div key={k} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
            <Text label="Title" max={60} value={c.businesses[k].title} onChange={(v) => put("businesses", { ...c.businesses, [k]: { ...c.businesses[k], title: v } })} />
            <Text label="Tamil" max={80} value={c.businesses[k].tamil} onChange={(v) => put("businesses", { ...c.businesses, [k]: { ...c.businesses[k], tamil: v } })} />
            <div className="sm:col-span-2"><Text label="Description" rows={2} max={400} value={c.businesses[k].blurb} onChange={(v) => put("businesses", { ...c.businesses, [k]: { ...c.businesses[k], blurb: v } })} /></div>
          </div>
        ))}
      </Part>

      <Part k="brand_notes" title="Brand lines" value={c.brand_notes} ready={ready}
        help="One plain line under each brand on its business page. Facts only, no claims like 'best' or 'biggest'.">
        {brands.map((b) => (
          <Text key={b} label={`${b}${showrooms.some((s) => s.brand === b) ? "" : " (no showroom now)"}`} max={300} value={c.brand_notes[b] ?? ""}
            onChange={(v) => put("brand_notes", { ...c.brand_notes, [b]: v })} />
        ))}
      </Part>

      <Part k="brand_strip" title="Brand strip and logos" value={c.brand_strip} ready={ready}
        help="The slowly moving row of brands on the homepage. Upload the official logo file from the brand's dealer kit (PNG, JPG or WebP, under 1 MB), never a redrawn or recoloured copy.">
        <List items={c.brand_strip} onChange={(v) => put("brand_strip", v)} blank={() => ({ name: "", note: "" })} addLabel="Add brand"
          render={(b, set) => <StripItem b={b} set={set} ready={ready} />} />
      </Part>

      <Part k="foods" title="Dhal and tamarind page" value={c.foods} ready={ready}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Text label="Title" max={60} value={c.foods.title} onChange={(v) => put("foods", { ...c.foods, title: v })} />
          <Text label="Tamil" max={80} value={c.foods.tamil} onChange={(v) => put("foods", { ...c.foods, tamil: v })} />
        </div>
        <Text label="Description" rows={2} max={400} value={c.foods.blurb} onChange={(v) => put("foods", { ...c.foods, blurb: v })} />
        <Field label="Products (one per line)">
          <textarea className="input" rows={4} value={c.foods.products.join("\n")} onChange={(e) => put("foods", { ...c.foods, products: e.target.value.split("\n") })}
            onBlur={() => put("foods", { ...c.foods, products: c.foods.products.map((x) => x.trim()).filter(Boolean) })} />
        </Field>
        <p className="label">Brand and factories (the first one is the brand everything is sold under)</p>
        <List items={c.foods.brands} onChange={(v) => put("foods", { ...c.foods, brands: v })} blank={() => ({ name: "", note: "" })} addLabel="Add line" max={12}
          render={(b, set) => <div className="grid gap-2 sm:grid-cols-2"><Text label="Name" max={40} value={b.name} onChange={(v) => set({ ...b, name: v })} /><Text label="Line under it" max={200} value={b.note} onChange={(v) => set({ ...b, note: v })} /></div>} />
      </Part>

      <Part k="about" title="About page" value={c.about} ready={ready} help={COUNTS}>
        <p className="label">Introduction paragraphs</p>
        <List items={c.about.intro} onChange={(v) => put("about", { ...c.about, intro: v })} blank={() => ""} addLabel="Add paragraph" max={6}
          render={(t, set) => <textarea className="input" rows={3} maxLength={1000} value={t} onChange={(e) => set(e.target.value)} aria-label="Paragraph" />} />
        <p className="label pt-2">Our story (timeline)</p>
        <List items={c.about.story} onChange={(v) => put("about", { ...c.about, story: v })} blank={() => ({ year: "", title: "", text: "" })} addLabel="Add year"
          render={(s, set) => (
            <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
              <Text label="Year" max={20} value={s.year} onChange={(v) => set({ ...s, year: v })} />
              <Text label="Title" max={80} value={s.title} onChange={(v) => set({ ...s, title: v })} />
              <div className="sm:col-span-2"><Text label="What happened" rows={2} max={600} value={s.text} onChange={(v) => set({ ...s, text: v })} /></div>
            </div>
          )} />
        <p className="label pt-2">What we stand for</p>
        <List items={c.about.values} onChange={(v) => put("about", { ...c.about, values: v })} blank={() => ({ title: "", text: "" })} addLabel="Add value" max={6}
          render={(s, set) => <div className="grid gap-2"><Text label="Title" max={80} value={s.title} onChange={(v) => set({ ...s, title: v })} /><Text label="Line" rows={2} max={600} value={s.text} onChange={(v) => set({ ...s, text: v })} /></div>} />
      </Part>

      <Part k="contact" title="Contact details" value={c.contact} ready={ready} help="The email shows on the Contact page, the footer, the Dhal and tamarind page and in Google's details.">
        <Text label="Email address" max={120} value={c.contact.email} onChange={(v) => put("contact", { ...c.contact, email: v.trim() })} />
        <Text label="'Write to us' line" rows={2} max={600} value={c.contact.write} onChange={(v) => put("contact", { ...c.contact, write: v })} />
        <Text label="'Visit a showroom' line" rows={2} max={600} value={c.contact.visit} onChange={(v) => put("contact", { ...c.contact, visit: v })} />
        <Text label="'Find a job' line" rows={2} max={600} value={c.contact.jobs} onChange={(v) => put("contact", { ...c.contact, jobs: v })} />
      </Part>
    </div>
  );
}

function StripItem({ b, set, ready }: { b: BrandChip; set: (b: BrandChip) => void; ready: boolean }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <Text label="Brand" max={40} value={b.name} onChange={(v) => set({ ...b, name: v })} />
      <Text label="Small line under it" max={60} value={b.note} onChange={(v) => set({ ...b, note: v })} />
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {b.logo && <img src={b.logo} alt={`${b.name} logo`} className="h-9 w-auto max-w-[7rem] object-contain" />}
        <label className={`btn-outline cursor-pointer ${!ready || pending ? "pointer-events-none opacity-50" : ""}`}>
          {pending ? "Uploading…" : b.logo ? "Change logo" : "Upload logo"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (file.size > 1024 * 1024) return setMsg({ ok: false, message: "Logo must be under 1 MB." });
            const form = new FormData();
            form.set("file", file);
            form.set("brand", b.name);
            start(async () => { const r = await uploadLogo(form); setMsg(r); if (r.ok && r.url) set({ ...b, logo: r.url }); });
          }} />
        </label>
        {b.logo && <button type="button" className="btn-ghost text-red-600" onClick={() => set({ name: b.name, note: b.note })}>Remove logo</button>}
      </div>
      {msg && <div className="sm:col-span-3"><Flash msg={msg} /></div>}
    </div>
  );
}
