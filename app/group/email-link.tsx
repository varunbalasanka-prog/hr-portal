"use client";
import { useState } from "react";

const LINK = "underline decoration-[0.08em] underline-offset-[0.2em] hover:decoration-[0.16em]";

/**
 * Our email address as one link: a tap opens the visitor's mail app with the address in To, and also copies
 * the address, so a computer with no mail app set up still gets it (a short "Address copied" note shows).
 */
export function EmailLink({ email, className = "" }: { email: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = () => {
    navigator.clipboard?.writeText(email).then(() => { setCopied(true); setTimeout(() => setCopied(false), 3000); }, () => {});
  };
  return (
    <>
      <a className={`${className} ${LINK}`} href={`mailto:${email}`} onClick={onClick}>{email}</a>
      <span role="status" className="ml-2 text-[15px] font-normal text-[#4a4666]">{copied ? "Address copied" : ""}</span>
    </>
  );
}
