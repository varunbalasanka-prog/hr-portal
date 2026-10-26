import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-brand p-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/5" aria-hidden />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-accent/15" aria-hidden />
        <div className="relative flex items-center gap-3">
          <span className="rounded-xl bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/balasanka_logo.png" alt="" className="h-9 w-auto" />
          </span>
          <span className="text-lg font-semibold">Balasanka Group</span>
        </div>
        <div className="relative max-w-md">
          <p className="text-3xl font-bold leading-tight">Every candidate, every call, every joining, in one place.</p>
          <p className="mt-3 text-sm text-white/70">The HR portal for our showrooms across South Tamil Nadu.</p>
        </div>
        <p className="relative text-xs text-white/50">Staff only. Candidates apply at the careers page.</p>
      </section>

      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/balasanka_logo.png" alt="Balasanka logo" className="mb-6 h-14 w-auto lg:hidden" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">HR recruitment portal</p>
          <LoginForm />
          <p className="mt-5 text-xs text-slate-500">Forgot your password? Ask the admin to reset it.</p>
        </div>
      </section>
    </main>
  );
}
