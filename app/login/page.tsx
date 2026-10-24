import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/balasanka_logo.png" alt="Balasanka logo" className="mx-auto mb-3 h-16 w-auto" />
        <div className="font-serif text-lg font-extrabold uppercase tracking-wide">Balasanka Group of Companies</div>
        <div className="mb-6 text-[11px] font-bold uppercase tracking-[0.15em] text-brand-accent">HR Recruitment Portal</div>
        <LoginForm />
        <p className="mt-4 text-xs text-slate-500">Forgot your password? Ask the admin to reset it.</p>
      </div>
    </main>
  );
}
