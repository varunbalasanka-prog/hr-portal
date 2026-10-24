"use client";
import { useEffect, useState, useTransition } from "react";
import { confirmMfa, disableMfa, mfaStatus, startMfa, type MfaState } from "@/app/actions/mfa";
import { Flash } from "./ui";

/** Turn on a 6-digit code from an authenticator app at every login. Strongly suggested for admins,
 *  whose accounts can see every candidate. */
export function TwoStepLogin({ admin }: { admin: boolean }) {
  const [state, setState] = useState<MfaState | null>(null);
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => { mfaStatus().then(setState); }, []);
  if (!state) return null;
  return (
    <section className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm">
      <h3 className="font-bold">Two-step login</h3>
      {state.enabled ? (
        <>
          <p className="text-green-800">On. You enter a code from your authenticator app each time you log in.</p>
          <button className="btn-outline" disabled={pending} onClick={() => { if (confirm("Turn off two-step login?")) start(async () => { const r = await disableMfa(state.factorId!); setMsg(r); if (r.ok) setState({ enabled: false, factorId: null }); }); }}>Turn off</button>
        </>
      ) : setup ? (
        <>
          <p>1. Open Google Authenticator or Microsoft Authenticator and scan this code.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="QR code for the authenticator app" className="h-44 w-44 rounded border border-slate-200" />
          <p className="text-xs text-slate-500">Can&apos;t scan? Enter this key in the app: <code className="break-all">{setup.secret}</code></p>
          <p>2. Type the 6-digit code it shows.</p>
          <div className="flex gap-2">
            <input className="input !w-36 text-center tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} aria-label="6-digit code" />
            <button className="btn-primary" disabled={pending || code.replace(/\D/g, "").length !== 6} onClick={() => start(async () => { const r = await confirmMfa(setup.factorId, code); setMsg(r); if (r.ok) { setSetup(null); setState({ enabled: true, factorId: setup.factorId }); } })}>Turn on</button>
          </div>
        </>
      ) : (
        <>
          <p className={admin ? "font-semibold text-amber-800" : "text-slate-600"}>
            {admin ? "Recommended for your account: admins can see every candidate's details." : "Adds a 6-digit code from your phone at login, so a stolen password alone can't get in."}
          </p>
          <button className="btn-outline" disabled={pending} onClick={() => start(async () => { const r = await startMfa(); if (r.ok) setSetup(r); else setMsg(r); })}>Set up</button>
        </>
      )}
      <Flash msg={msg} />
    </section>
  );
}
