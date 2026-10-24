"use client";
import { useActionState } from "react";
import { verifyCode } from "../actions";

export function VerifyForm() {
  const [state, action, pending] = useActionState(verifyCode, undefined);
  return (
    <form action={action} className="space-y-4 text-left">
      {state?.error && <div role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
      <div>
        <label className="label" htmlFor="code">Code</label>
        <input id="code" name="code" className="input h-11 text-center text-lg tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus required />
      </div>
      <button className="btn-primary h-11 w-full" disabled={pending}>{pending ? "Checking…" : "Continue"}</button>
    </form>
  );
}
