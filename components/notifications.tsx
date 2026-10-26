"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isAdminRole, type NotificationRow, type Profile } from "@/lib/types";
import { formatDateTime } from "@/lib/dates";
import { clearNotification, markNotificationViewed, notificationFileUrl, sendNotification } from "@/app/actions/notifications";
import { Field, Flash, Modal, Select, tooBig } from "./ui";
import { Icon } from "./icons";

export function NotificationBell({ me, items }: { me: Profile; items: NotificationRow[] }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const unread = items.filter((n) => !n.viewed_at && n.recipient === me.username).length;

  return (
    <div className="relative">
      <button className="btn-outline relative !px-2.5" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} aria-expanded={open}>
        <Icon name="bell" />{unread > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-brand-accent px-1 text-center text-[11px] font-bold leading-5 text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 max-h-96 w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-pop">
          <div className="mb-1 border-b pb-1 text-xs font-bold">Notifications{isAdminRole(me.role) && " (all, admin view)"}</div>
          {items.length === 0 && <p className="py-3 text-center text-xs text-slate-500">No notifications.</p>}
          {items.map((n) => (
            <div key={n.id} className="border-b py-2 text-xs last:border-0">
              <div className="flex justify-between gap-2">
                <span className={`font-semibold ${n.viewed_at ? "text-slate-500" : "text-sky-700"}`}>{n.sender}{isAdminRole(me.role) && ` → ${n.recipient}`}</span>
                <button className="text-slate-400 hover:text-red-600" title="Dismiss" onClick={() => start(async () => { await clearNotification(n.id); router.refresh(); })}>✕</button>
              </div>
              <p className="my-1 text-slate-800">{n.message}</p>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{formatDateTime(n.created_at)}</span>
                <span className="flex gap-2">
                  {n.file_path && <button className="text-sky-700 underline" onClick={async () => { const u = await notificationFileUrl(n.file_path!); if (u) window.open(u, "_blank"); }}>file</button>}
                  {!n.viewed_at && n.recipient === me.username && <button className="text-sky-700 underline" onClick={() => start(async () => { await markNotificationViewed(n.id); router.refresh(); })}>mark read</button>}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SendNotification({ me, people, onClose }: { me: Profile; people: Profile[]; onClose: () => void }) {
  const [recipient, setRecipient] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const options = people.filter((p) => p.username !== me.username).map((p) => ({ value: p.username, label: `${p.full_name} (${p.role})` }));
  return (
    <Modal open onClose={onClose} title="Send notification">
      <form action={(fd) => start(async () => { const r = await sendNotification(fd); setMsg(r); if (r.ok) { router.refresh(); setTimeout(onClose, 700); } })} className="space-y-3">
        <Field label="To *"><Select name="recipient" value={recipient} onChange={setRecipient} options={options} /></Field>
        <Field label="Message *"><textarea name="message" className="input" rows={3} required /></Field>
        <Field label="Attach file (optional, max 4 MB)"><input name="file" type="file" className="input" onChange={tooBig} /></Field>
        <Flash msg={msg} />
        <button className="btn-primary" disabled={pending}>{pending ? "Sending…" : "Send"}</button>
      </form>
    </Modal>
  );
}
