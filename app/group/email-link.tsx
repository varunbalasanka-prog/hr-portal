"use client";
import { useState } from "react";

const LINK = "underline decoration-[0.08em] underline-offset-[0.2em] hover:decoration-[0.16em]";

/**
 * Our email address as a mailto: link (opens the visitor's mail app), plus two fallbacks for computers
 * with no mail app set up: compose in Gmail on the web, or copy the address.
 */
export function EmailLink({ email, className = "" }: { email: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(email); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  return (
    <>
      <a className={`${className} ${LINK}`} href={`mailto:${email}`}>{email}</a>
      <span className="mt-1 flex flex-wrap gap-x-4 text-[15px] text-[#4a4666]">
        <a className={`inline-block py-1 ${LINK}`} href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`} target="_blank" rel="noopener">Open in Gmail</a>
        <button type="button" onClick={copy} className={`py-1 ${LINK}`} aria-live="polite">{copied ? "Copied" : "Copy address"}</button>
      </span>
    </>
  );
}
