"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { isAdminRole, type Profile, type Role } from "@/lib/types";
export { staffSections, type NavCounts } from "@/lib/nav";
import { logout } from "@/app/login/actions";
import { updateMyProfile } from "@/app/actions/users";
import { Icon } from "./icons";
import type { NavSection } from "@/lib/nav";
import { TwoStepLogin } from "./two-step";
import { PushToggle } from "./push-toggle";
import { Field, Flash, Modal, tooBig } from "./ui";

const ROLE_LABEL: Record<Role, string> = { superadmin: "Super admin", admin: "Admin", hr: "HR", branch: "Store" };

export function AppShell({ me, photoUrl, sections, active, onPick, actions, children }: {
  me: Profile; photoUrl?: string | null; sections: NavSection[]; active: string;
  /** Dashboard lists switch in place instead of reloading the page. */
  onPick?: (key: string) => void;
  /** Extra buttons in the phone top bar (search, notifications). */
  actions?: React.ReactNode; children: React.ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const [settings, setSettings] = useState(false);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const nav = (
    <Sidebar me={me} photoUrl={photoUrl} sections={sections} active={active}
      onPick={(k) => { setDrawer(false); onPick?.(k); }} onSettings={() => { setDrawer(false); setSettings(true); }} hasPick={!!onPick} />
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{nav}</aside>

      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
        <button className="btn-ghost !px-2" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}><Icon name="menu" className="h-5 w-5" /></button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/balasanka_logo.png" alt="Balasanka" className="h-7 w-auto" />
        <div className="ml-auto flex min-w-0 items-center gap-1.5">{actions}</div>
      </header>

      {drawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 lg:hidden" onMouseDown={() => setDrawer(false)}>
          <div className="h-full w-72 max-w-[85vw] bg-white shadow-pop" role="dialog" aria-modal="true" aria-label="Menu" onMouseDown={(e) => e.stopPropagation()}>{nav}</div>
        </div>
      )}

      <div className="lg:pl-64">{children}</div>
      {settings && <Settings me={me} onClose={() => setSettings(false)} />}
    </div>
  );
}

function Sidebar({ me, photoUrl, sections, active, onPick, onSettings, hasPick }: {
  me: Profile; photoUrl?: string | null; sections: NavSection[]; active: string; onPick: (k: string) => void; onSettings: () => void; hasPick: boolean;
}) {
  return (
    <nav className="flex h-full flex-col" aria-label="Main menu">
      <Link href="/dashboard" className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3.5" onClick={(e) => { if (hasPick) { e.preventDefault(); onPick("followup"); } }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/balasanka_logo.png" alt="" className="h-8 w-auto" />
        <span className="leading-tight">
          <span className="block text-sm font-bold text-brand">Balasanka Group</span>
          <span className="block text-xs text-slate-500">HR portal</span>
        </span>
      </Link>
      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {sections.map((s) => (
          <div key={s.title}>
            <div className="section-title mb-1.5 px-2">{s.title}</div>
            <ul className="space-y-0.5">
              {s.items.map((it) => {
                const on = active === it.key || active.startsWith(`${it.key}.`);
                const cls = `group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition ${on ? "bg-sky-50 font-semibold text-brand" : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"}`;
                const inner = (
                  <>
                    <Icon name={it.icon} className={`h-[18px] w-[18px] shrink-0 ${on ? "text-brand" : "text-slate-400 group-hover:text-slate-600"}`} />
                    <span className="flex-1 truncate text-left">{it.label}</span>
                    {it.count !== undefined && (
                      <span className={`min-w-6 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums ${it.alert ? "bg-brand-accent text-white" : on ? "bg-white text-brand" : "bg-slate-100 text-slate-600"}`}>{it.count}</span>
                    )}
                  </>
                );
                const isList = it.href?.startsWith("/dashboard?list=");
                return (
                  <li key={it.key}>
                    {hasPick && isList
                      ? <button className={cls} aria-current={on ? "page" : undefined} onClick={() => onPick(it.key)}>{inner}</button>
                      : <Link className={cls} aria-current={on ? "page" : undefined} href={it.href!}>{inner}</Link>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 p-3">
        <button className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-slate-50" onClick={onSettings} title="Profile, password, notifications">
          <Avatar name={me.full_name || me.username} photoUrl={photoUrl} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold">{me.full_name || me.username}</span>
            <span className="block text-xs text-slate-500">{ROLE_LABEL[me.role]} · settings</span>
          </span>
          <Icon name="settings" className="h-4 w-4 text-slate-400" />
        </button>
        <form action={logout}><button className="btn-ghost mt-1 w-full !justify-start !px-2 text-slate-600"><Icon name="logout" /> Log out</button></form>
      </div>
    </nav>
  );
}

export function Avatar({ name, photoUrl, size = "h-9 w-9 text-sm" }: { name: string; photoUrl?: string | null; size?: string }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  const initials = name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-sky-100 font-semibold text-brand`}>{initials || "?"}</span>;
}

/** A page heading with optional actions on the right. */
export function PageHeader({ title, subtitle, children }: { title: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-3 pt-5 sm:px-6">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

function Settings({ me, onClose }: { me: Profile; onClose: () => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Modal open onClose={onClose} title="Profile settings">
      <form action={(fd) => start(async () => setMsg(await updateMyProfile(fd)))} className="space-y-3">
        <p className="text-sm text-slate-600">Signed in as <b className="text-slate-900">{me.username}</b> ({ROLE_LABEL[me.role]})</p>
        <Field label="Mobile (used in SMS so candidates can call you back)"><input name="mobile" className="input" inputMode="tel" defaultValue={me.mobile ?? ""} /></Field>
        <Field label="New password (leave blank to keep, min 8 characters)"><input name="password" type="password" className="input" autoComplete="new-password" /></Field>
        <Field label="Current password (needed only to change the password)"><input name="current_password" type="password" className="input" autoComplete="current-password" /></Field>
        <Field label="Profile photo"><input name="photo" type="file" accept="image/*" className="input" onChange={tooBig} /></Field>
        <Flash msg={msg} />
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      </form>
      <PushToggle />
      <TwoStepLogin admin={isAdminRole(me.role)} />
    </Modal>
  );
}
