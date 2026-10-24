import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../actions";
import { VerifyForm } from "./verify-form";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel !== "aal2" || aal.currentLevel === "aal2") redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-2xl">
        <h1 className="mb-1 text-lg font-bold">Two-step login</h1>
        <p className="mb-5 text-sm text-slate-600">Open your authenticator app and enter the 6-digit code for Balasanka HR.</p>
        <VerifyForm />
        <form action={logout} className="mt-4"><button className="text-sm text-slate-500 underline">Use a different account</button></form>
      </div>
    </main>
  );
}
