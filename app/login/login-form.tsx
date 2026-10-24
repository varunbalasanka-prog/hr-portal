"use client";
import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4 text-left">
      {state?.error && <div role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input id="username" name="username" className="input h-11" placeholder="Enter username" autoComplete="username" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input h-11" autoComplete="current-password" required />
      </div>
      <button className="btn-primary h-11 w-full" disabled={pending}>{pending ? "Signing in…" : "Log in to dashboard"}</button>
    </form>
  );
}
