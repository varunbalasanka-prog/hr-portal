"use client";
import { useMemo, useState, useTransition } from "react";
import { saveDivisions } from "@/app/actions/staff";
import { addDays, formatDate } from "@/lib/dates";
import { CHANGE_LABEL, EXIT_LABEL, divisionOf, placement, tenureLabel, type BranchLite, type Placement, type Scope, type StaffStint } from "@/lib/staff";
import type { Branch, Profile } from "@/lib/types";
import { Badge, Flash, Modal } from "@/components/ui";
import { kindFor, type Appraisal, type AppraisalForm, type FormKind } from "@/lib/appraisal";
import { AppraisalSheet, AppraisalsBlock, PendingAppraisals, type SheetTarget } from "./appraisals";
import { FormEditor } from "./form-editor";

type Tab = Placement["tab"];
type Row = { s: StaffStint; p: Placement };

const money = (n: number | null) => (n == null ? null : `₹${Number(n).toLocaleString("en-IN")}`);

/** Current, past and moved-out staff of a store (or a division, or every store), from the dated staff register. */
export function StaffRegister({ me, admin, stints, appraisals, forms, branches, today }: {
  me: Profile; admin: boolean; stints: StaffStint[]; appraisals: Appraisal[] | null; forms: Record<FormKind, AppraisalForm>; branches: Branch[]; today: string;
}) {
  const store = me.role === "branch";
  const byId = useMemo(() => new Map<string, BranchLite>(branches.map((b) => [b.id, b])), [branches]);
  const divisions = useMemo(() => [...new Set(branches.map((b) => divisionOf(b)))].sort(), [branches]);
  const [scopeKey, setScopeKey] = useState(store ? `b:${me.branch_id}` : "all");
  const [tab, setTab] = useState<Tab>("current");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<StaffStint | null>(null);
  const [editDivisions, setEditDivisions] = useState(false);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [editForms, setEditForms] = useState(false);
  const branchOf = (s: StaffStint) => branches.find((b) => b.id === s.positions.find((p) => p.to_date === null)?.branch_id);

  const scope: Scope = scopeKey.startsWith("b:") ? { kind: "branch", id: scopeKey.slice(2) }
    : scopeKey.startsWith("d:") ? { kind: "division", name: scopeKey.slice(2) } : { kind: "all" };
  const multiStore = scope.kind !== "branch";

  const rows = useMemo(() => stints.flatMap((s) => {
    const p = placement(s, scope, byId);
    return p ? [{ s, p }] : [];
  }), [stints, scopeKey, byId]); // eslint-disable-line react-hooks/exhaustive-deps

  const needle = q.trim().toLowerCase();
  const matches = (r: Row) => !needle || [r.s.name, r.s.employee_code, r.s.mobile].some((v) => v?.toLowerCase().includes(needle));
  const count = (t: Tab) => rows.filter((r) => r.p.tab === t).length;
  const yearAgo = addDays(today, -365);
  const leftThisYear = rows.filter((r) => r.p.tab === "past" && (r.p.position.to_date ?? "") >= yearAgo).length;
  const shown = rows.filter((r) => r.p.tab === tab && matches(r))
    .sort((a, b) => tab === "current" ? a.s.name.localeCompare(b.s.name) : (b.p.position.to_date ?? "").localeCompare(a.p.position.to_date ?? ""));
  const bName = (id: string) => byId.get(id)?.name ?? "-";

  const tabs: { key: Tab; label: string }[] = [
    { key: "current", label: "Current" },
    { key: "past", label: scope.kind === "all" ? "Left the company" : "Past" },
    ...(scope.kind === "branch" ? [{ key: "moved" as Tab, label: "Moved out" }] : []),
  ];
  const tabHelp: Record<Tab, string> = {
    current: "Working here today.",
    past: scope.kind === "branch" ? "Left the company while at this store, or moved to a store in another division."
      : scope.kind === "division" ? "Left the company, or moved to a store outside this division." : "No longer working at any Balasanka store.",
    moved: "Moved to another store in the same division. Not counted as a loss.",
  };

  return (
    <div className="space-y-4 px-4 sm:px-6">
      <div className="flex flex-wrap items-end gap-3">
        {!store && (
          <label className="min-w-0 flex-1 sm:max-w-sm">
            <span className="section-title">Showing</span>
            <select className="input mt-1" value={scopeKey} onChange={(e) => { setScopeKey(e.target.value); if (!e.target.value.startsWith("b:") && tab === "moved") setTab("current"); }}>
              <option value="all">All stores</option>
              <optgroup label="Divisions">{divisions.map((d) => <option key={d} value={`d:${d}`}>{d} (division)</option>)}</optgroup>
              {divisions.map((d) => (
                <optgroup key={d} label={d}>
                  {branches.filter((b) => divisionOf(b) === d).map((b) => <option key={b.id} value={`b:${b.id}`}>{b.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        )}
        <label className="min-w-0 flex-1 sm:max-w-xs">
          <span className="section-title">Search</span>
          <input className="input mt-1" placeholder="Name, employee code or mobile" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {admin && <button className="btn-outline" onClick={() => setEditDivisions(true)}>Divisions</button>}
        {admin && appraisals && <button className="btn-outline" onClick={() => setEditForms(true)}>Appraisal forms</button>}
      </div>

      {admin && appraisals && <PendingAppraisals list={appraisals} stints={stints} bName={(s) => branchOf(s)?.name ?? "-"} onOpen={setSheet} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-3"><div className="section-title">Working now</div><div className="text-2xl font-bold tabular-nums">{count("current")}</div></div>
        <div className="card p-3"><div className="section-title">Lost in last 12 months</div><div className="text-2xl font-bold tabular-nums">{leftThisYear}</div></div>
        {scope.kind === "branch" && <div className="card p-3"><div className="section-title">Moved to sister stores</div><div className="text-2xl font-bold tabular-nums">{count("moved")}</div></div>}
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={`chip ${tab === t.key ? "chip-on" : ""}`} onClick={() => setTab(t.key)}>
            {t.label} <span className="tabular-nums opacity-80">{count(t.key)}</span>
          </button>
        ))}
      </div>
      <p className="-mt-2 text-xs text-slate-500">{tabHelp[tab]}</p>

      <div className="card overflow-x-auto">
        {shown.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">
            {stints.length === 0 ? "No staff in the register yet. People appear here when they join through the portal, or after the staff list from the Excel template is imported." : "Nobody here."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-500">
                <th className="px-3 py-2">Name</th>
                {(multiStore || tab !== "current") && <th className="px-2">Store</th>}
                <th className="px-2">Role</th>
                <th className="px-2">Joined</th>
                {tab === "current" && <><th className="px-2">With us</th><th className="px-2">Status</th></>}
                {tab === "past" && <><th className="px-2">Last day</th><th className="px-2">With us</th><th className="px-2">How they left</th></>}
                {tab === "moved" && <><th className="px-2">Here until</th><th className="px-2">Moved to</th></>}
              </tr>
            </thead>
            <tbody>
              {shown.map(({ s, p }) => (
                <tr key={s.id} className="cursor-pointer border-b align-top last:border-0 hover:bg-slate-50" onClick={() => setOpen(s)}>
                  <td className="px-3 py-2">
                    <button className="text-left font-semibold text-slate-900 hover:underline" onClick={(e) => { e.stopPropagation(); setOpen(s); }}>{s.name}</button>
                    {s.employee_code && <div className="text-xs text-slate-500">{s.employee_code}</div>}
                  </td>
                  {(multiStore || tab !== "current") && <td className="px-2 py-2">{bName(p.position.branch_id)}</td>}
                  <td className="px-2 py-2">{p.position.designation ?? "-"}</td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">{formatDate(s.joined_on)}</td>
                  {p.tab === "current" && <>
                    <td className="whitespace-nowrap px-2 py-2">{tenureLabel(s.joined_on, today)}</td>
                    <td className="px-2 py-2">{s.confirmed ? <Badge tone="green">Confirmed</Badge>
                      : s.confirmation_date && s.confirmation_date <= today ? <Badge tone="amber">Confirmation due</Badge>
                      : s.source === "import" ? <Badge tone="slate">Imported</Badge> : <Badge tone="sky">On probation</Badge>}</td>
                  </>}
                  {p.tab === "past" && <>
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums">{formatDate(p.position.to_date)}</td>
                    <td className="whitespace-nowrap px-2 py-2">{tenureLabel(s.joined_on, p.position.to_date ?? today)}</td>
                    <td className="px-2 py-2">
                      {p.why === "other division" ? <Badge tone="purple">Moved to {p.to}</Badge>
                        : s.exit_type ? <Badge tone={s.exit_type === "absconded" ? "red" : "zinc"}>{EXIT_LABEL[s.exit_type]}</Badge> : "-"}
                      {p.why === "left" && s.exit_reason && <div className="mt-0.5 text-xs text-slate-500">{s.exit_reason}</div>}
                    </td>
                  </>}
                  {p.tab === "moved" && <>
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums">{formatDate(p.position.to_date)}</td>
                    <td className="px-2 py-2">{p.to}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} side title={open?.name ?? ""}
        subtitle={open && <>{[open.employee_code, open.mobile].filter(Boolean).join(" · ")}{open.source === "import" && " · imported from staff list"}</>}>
        {open && <Timeline s={open} bName={bName} today={today} />}
        {open && appraisals && (
          <div className="mt-5 border-t pt-4">
            <AppraisalsBlock s={open} list={appraisals} form={(() => { const k = kindFor(branchOf(open)?.business_type); return k ? forms[k] : null; })()} today={today} onOpen={(t) => { setOpen(null); setSheet(t); }} />
          </div>
        )}
      </Modal>
      {admin && appraisals && <FormEditor open={editForms} onClose={() => setEditForms(false)} forms={forms} />}
      <AppraisalSheet target={sheet} admin={admin} today={today} onClose={() => setSheet(null)} />
      {admin && <DivisionsEditor open={editDivisions} onClose={() => setEditDivisions(false)} branches={branches} />}
    </div>
  );
}

function Timeline({ s, bName, today }: { s: StaffStint; bName: (id: string) => string; today: string }) {
  const lines = [...s.positions].sort((a, b) => a.from_date.localeCompare(b.from_date) || a.id - b.id);
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt className="section-title">Joined</dt><dd>{formatDate(s.joined_on)}</dd></div>
        <div><dt className="section-title">{s.left_on ? "Last day" : "With us"}</dt><dd>{s.left_on ? formatDate(s.left_on) : tenureLabel(s.joined_on, today)}</dd></div>
        <div><dt className="section-title">Confirmation</dt><dd>{s.confirmed ? "Confirmed" : s.confirmation_date ? `Due ${formatDate(s.confirmation_date)}` : "-"}</dd></div>
        {s.left_on && <div><dt className="section-title">How they left</dt><dd>{s.exit_type ? EXIT_LABEL[s.exit_type] : "-"}{s.rehire && ` · rehire: ${s.rehire}`}</dd></div>}
      </dl>
      {s.exit_reason && <p className="text-sm"><span className="font-semibold">Reason given:</span> {s.exit_reason}</p>}
      <ol className="relative space-y-3 border-l border-slate-200 pl-4">
        {lines.map((p) => {
          const pay = [money(p.basic), p.allowances ? `+ ${money(p.allowances)} allowances` : null].filter(Boolean).join(" ");
          return (
            <li key={p.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-white" aria-hidden />
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{CHANGE_LABEL[p.change_type] ?? p.change_type}</span>
                <span className="text-xs tabular-nums text-slate-500">{formatDate(p.from_date)} – {p.to_date ? formatDate(p.to_date) : "now"}</span>
              </div>
              <div className="text-sm">{bName(p.branch_id)} · {p.designation ?? "-"}{pay && <> · {pay}</>}</div>
              {p.reason && <div className="text-xs text-slate-500">{p.reason}</div>}
            </li>
          );
        })}
        {s.left_on && (
          <li className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-400 ring-2 ring-white" aria-hidden />
            <span className="font-semibold">Left</span> <span className="text-xs tabular-nums text-slate-500">{formatDate(s.left_on)}</span>
          </li>
        )}
      </ol>
    </div>
  );
}

function DivisionsEditor({ open, onClose, branches }: { open: boolean; onClose: () => void; branches: Branch[] }) {
  const initial = () => Object.fromEntries(branches.map((b) => [b.id, divisionOf(b)]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const changed = branches.filter((b) => (values[b.id] ?? "").trim() !== divisionOf(b));
  const known = [...new Set(Object.values(values).map((v) => v.trim()).filter(Boolean))].sort();
  return (
    <Modal open={open} onClose={onClose} wide title="Divisions"
      subtitle="Stores in the same division are sister stores: moving between them shows as “moved out”, not as a loss.">
      <Flash msg={msg} />
      <datalist id="division-names">{known.map((d) => <option key={d} value={d} />)}</datalist>
      <div className="max-h-[60vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-1.5">Store</th><th>Division</th></tr></thead>
          <tbody>{branches.map((b) => (
            <tr key={b.id} className="border-b last:border-0">
              <td className="py-1.5 pr-2">{b.name}</td>
              <td className="py-1"><input className="input !py-1" list="division-names" aria-label={`Division of ${b.name}`} value={values[b.id] ?? ""}
                onChange={(e) => setValues({ ...values, [b.id]: e.target.value })} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button className="btn-outline" onClick={() => { setValues(initial()); onClose(); }}>Close</button>
        <button className="btn-primary" disabled={pending || changed.length === 0}
          onClick={() => start(async () => setMsg(await saveDivisions(changed.map((b) => ({ id: b.id, division: values[b.id] })))))}>
          {changed.length ? `Save ${changed.length} change${changed.length > 1 ? "s" : ""}` : "Save"}
        </button>
      </div>
    </Modal>
  );
}
