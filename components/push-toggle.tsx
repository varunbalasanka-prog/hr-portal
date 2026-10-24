"use client";
import { useEffect, useState, useTransition } from "react";
import { removePushSubscription, savePushSubscription } from "@/app/actions/push";
import { Flash } from "./ui";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Phone notifications for new applications and messages. Hidden until the VAPID keys are set. */
export function PushToggle() {
  const [sub, setSub] = useState<PushSubscription | null | undefined>(undefined);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  useEffect(() => {
    if (!KEY || !supported) return;
    navigator.serviceWorker.register("/sw.js").then((r) => r.pushManager.getSubscription()).then(setSub).catch(() => setSub(null));
  }, [supported]);

  if (!KEY) return null;
  return (
    <section className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm">
      <h3 className="font-bold">Phone notifications</h3>
      {!supported ? (
        <p className="text-slate-600">This browser can&apos;t show notifications. On iPhone, first tap Share → &quot;Add to Home Screen&quot;, then open the portal from the home screen.</p>
      ) : sub ? (
        <button className="btn-outline" disabled={pending} onClick={() => start(async () => { await sub.unsubscribe(); setMsg(await removePushSubscription(sub.endpoint)); setSub(null); })}>Turn off on this device</button>
      ) : (
        <button className="btn-outline" disabled={pending || sub === undefined} onClick={() => start(async () => {
          if ((await Notification.requestPermission()) !== "granted") return setMsg({ ok: false, message: "Notifications are blocked. Allow them in the browser settings." });
          const reg = await navigator.serviceWorker.ready;
          const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) });
          const json = s.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
          setMsg(await savePushSubscription(json));
          setSub(s);
        })}>Turn on for this device</button>
      )}
      <Flash msg={msg} />
    </section>
  );
}
