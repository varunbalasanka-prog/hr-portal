"use client";
import { useState, useTransition } from "react";
import { respondToOffer } from "./actions";

/** Accept / decline buttons under the offer letter. Hidden when printing. */
export function OfferReply({ token, answered }: { token: string; answered: "accepted" | "declined" | null }) {
  const [done, setDone] = useState<string | null>(answered ? (answered === "accepted"
    ? "You accepted this offer. We look forward to you joining! / இந்த வாய்ப்பை ஏற்றுக்கொண்டீர்கள்."
    : "You declined this offer. / இந்த வாய்ப்பை மறுத்துவிட்டீர்கள்.") : null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const send = (accept: boolean) => start(async () => {
    const r = await respondToOffer(token, accept, reason);
    if (r.ok) setDone(r.message); else setErr(r.message);
  });

  return (
    <section className="mt-6 rounded-lg border-2 border-sky-600 p-4 font-sans print:hidden">
      {done ? <p role="status" className="font-semibold text-green-800">{done}</p> : (
        <>
          <p className="mb-3 font-semibold">Do you accept this offer? / இந்த வேலை வாய்ப்பை ஏற்கிறீர்களா?</p>
          {err && <p role="alert" className="mb-2 text-sm text-red-700">{err}</p>}
          {!declining ? (
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md bg-green-700 px-5 py-2.5 font-bold text-white" disabled={pending} onClick={() => send(true)}>Yes, I accept / ஏற்கிறேன்</button>
              <button className="rounded-md border border-slate-400 px-5 py-2.5 font-semibold" disabled={pending} onClick={() => setDeclining(true)}>No / இல்லை</button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm">Reason (optional) / காரணம் (விருப்பம்)
                <input className="mt-1 w-full rounded border border-slate-300 px-2 py-2" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
              </label>
              <div className="flex gap-2">
                <button className="rounded-md bg-red-700 px-5 py-2.5 font-bold text-white" disabled={pending} onClick={() => send(false)}>Decline offer / மறுக்கிறேன்</button>
                <button className="rounded-md border border-slate-400 px-4 py-2.5" onClick={() => setDeclining(false)}>Back</button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
