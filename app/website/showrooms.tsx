"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteShowroom, orderShowrooms, saveShowroom } from "@/app/actions/website";
import { Field, Flash, Modal } from "@/components/ui";
import { BUSINESS_KEYS, checkShowroom, phoneText, type BusinessKey, type Showroom, type SiteContent } from "@/lib/site";

type Msg = { ok: boolean; message: string } | null;
const EMPTY: Showroom = { business: "jewellery", brand: "", town: "", company: "", street: "", pin: "", phone: "" };

/** Every showroom on balasanka.in, by business: add, change, remove and reorder. Changes are live on save. */
export function ShowroomsEditor({ rows, businesses, ready }: { rows: Showroom[]; businesses: SiteContent["businesses"]; ready: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Showroom | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const sorted = useMemo(() => [...rows].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)), [rows]);
  const pick = (k: keyof Showroom) => [...new Set(rows.map((r) => String(r[k] ?? "")).filter(Boolean))].sort();
  const lists = { brand: pick("brand"), town: pick("town"), company: pick("company") };

  const act = (fn: () => Promise<{ ok: boolean; message: string }>, after?: () => void) => start(async () => {
    const r = await fn();
    setMsg(r);
    if (r.ok) { after?.(); router.refresh(); }
  });
  const move = (key: BusinessKey, i: number, by: -1 | 1) => {
    const ids = sorted.filter((s) => s.business === key).map((s) => s.id!);
    const j = i + by;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    act(() => orderShowrooms(ids));
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">{rows.length} showrooms in {lists.town.length} towns, {rows.filter((r) => r.phone).length} with a phone number. Town pages, counts, the footer and Google&apos;s shop details update by themselves.</p>
        <button className="btn-primary" disabled={!ready} onClick={() => { setMsg(null); setEdit({ ...EMPTY }); }}>+ Add showroom</button>
      </div>
      {!edit && <Flash msg={msg} />}
      {BUSINESS_KEYS.map((key) => {
        const list = sorted.filter((s) => s.business === key);
        return (
          <div key={key} className="card p-4 sm:p-5">
            <h2 className="mb-2 text-sm font-bold">{businesses[key].title} <span className="font-normal text-slate-500">({list.length})</span></h2>
            {list.length === 0 && <p className="py-3 text-sm text-slate-500">No showrooms. This business page will say so until you add one.</p>}
            <ul className="divide-y divide-slate-100">
              {list.map((s, i) => (
                <li key={s.id ?? `${s.brand}${s.street}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{s.brand} <span className="font-normal text-slate-500">· {s.town}</span></p>
                    <p className="truncate text-slate-600">{s.street}, {s.pin}{s.company ? ` · ${s.company}` : ""}</p>
                    <p className={s.phone ? "text-slate-600" : "text-amber-700"}>{s.phone ? `Phone ${phoneText(s.phone)}` : "No phone yet"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="btn-ghost !px-2" aria-label={`Move ${s.brand} ${s.town} up`} disabled={!ready || pending || i === 0} onClick={() => move(key, i, -1)}>↑</button>
                    <button className="btn-ghost !px-2" aria-label={`Move ${s.brand} ${s.town} down`} disabled={!ready || pending || i === list.length - 1} onClick={() => move(key, i, 1)}>↓</button>
                    <button className="btn-outline" disabled={!ready} onClick={() => { setMsg(null); setEdit({ ...s }); }}>Edit</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.brand}, ${edit.town}` : "Add a showroom"}
        subtitle="Saved changes are live on balasanka.in straight away.">
        {edit && <ShowroomForm s={edit} lists={lists} businesses={businesses} pending={pending} msg={msg}
          onSave={(s) => act(() => saveShowroom(s), () => setEdit(null))}
          onDelete={edit.id ? () => { if (confirm(`Remove ${edit.brand}, ${edit.town} from the website?`)) act(() => deleteShowroom(edit.id!), () => setEdit(null)); } : undefined} />}
      </Modal>
    </section>
  );
}

function ShowroomForm({ s: start, lists, businesses, pending, msg, onSave, onDelete }: {
  s: Showroom; lists: Record<"brand" | "town" | "company", string[]>; businesses: SiteContent["businesses"]; pending: boolean; msg: Msg;
  onSave: (s: Showroom) => void; onDelete?: () => void;
}) {
  const [s, setS] = useState(start);
  const [local, setLocal] = useState<Msg>(null);
  const set = (k: keyof Showroom) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setS({ ...s, [k]: e.target.value });
  const newBrand = s.brand.trim() && !lists.brand.includes(s.brand.trim());
  return (
    <form className="space-y-3 text-sm" onSubmit={(e) => {
      e.preventDefault();
      const c = checkShowroom(s);
      if (!c.ok) return setLocal(c);
      setLocal(null);
      onSave({ ...c.value, id: s.id, sort: s.sort });
    }}>
      <Field label="Business *">
        <select className="input" value={s.business} onChange={set("business")}>
          {BUSINESS_KEYS.map((k) => <option key={k} value={k}>{businesses[k].title}</option>)}
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Brand on the board *"><input className="input" list="ws-brands" value={s.brand} onChange={set("brand")} placeholder="Akshaya Velli" /></Field>
        <Field label="Town *"><input className="input" list="ws-towns" value={s.town} onChange={set("town")} placeholder="Theni" /></Field>
      </div>
      {newBrand && <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">New brand. After saving, add its one-line description under <b>Page words &amp; logos &gt; Brand lines</b>.</p>}
      <Field label="Street address *"><input className="input" value={s.street} onChange={set("street")} placeholder="No 441/2A Balasanka Plaza, Periyakulam Road" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="PIN code *"><input className="input" value={s.pin} onChange={set("pin")} inputMode="numeric" maxLength={7} placeholder="625531" /></Field>
        <Field label="Company that runs it"><input className="input" list="ws-companies" value={s.company} onChange={set("company")} placeholder="Balasanka Jewellery LLP" /></Field>
      </div>
      <Field label="Phone number">
        <input className="input" type="tel" inputMode="tel" maxLength={20} value={s.phone ?? ""} onChange={set("phone")} placeholder="98765 43210 or 04546 252525" />
      </Field>
      <datalist id="ws-brands">{lists.brand.map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="ws-towns">{lists.town.map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="ws-companies">{lists.company.map((x) => <option key={x} value={x} />)}</datalist>
      <p className="text-xs text-slate-500">The phone shows under the address as a tap-to-call link, and in Google&apos;s shop details. Leave it empty to show no phone. The Google Maps link is made from the brand and address. The company name appears in the footer and on the About page.</p>
      <Flash msg={local ?? msg} />
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {onDelete && <button type="button" className="btn-danger ml-auto" disabled={pending} onClick={onDelete}>Remove showroom</button>}
      </div>
    </form>
  );
}
