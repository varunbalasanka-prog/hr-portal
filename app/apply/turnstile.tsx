"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window { turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; remove: (id: string) => void } }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Cloudflare's free "are you human" check. Renders nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    let id: string | undefined;
    const render = () => {
      if (!box.current || !window.turnstile) return;
      id = window.turnstile.render(box.current, {
        sitekey: SITE_KEY, language: "auto", size: "flexible",
        callback: onToken, "expired-callback": () => onToken(""), "error-callback": () => onToken(""),
      });
    };
    if (window.turnstile) render();
    else {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = render;
      document.head.appendChild(s);
    }
    return () => { if (id && window.turnstile) window.turnstile.remove(id); };
  }, [onToken]);
  if (!SITE_KEY) return null;
  return <div ref={box} className="min-h-[65px]" />;
}
