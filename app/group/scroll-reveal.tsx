"use client";
import { useEffect } from "react";

/**
 * Fades [data-reveal] elements up as they scroll into view. Content is only hidden once this has run,
 * so without JavaScript (or with reduced motion, handled in CSS) everything shows straight away.
 */
export function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    root.classList.add("reveal-ready");
    items.forEach((el) => io.observe(el));
    return () => { io.disconnect(); root.classList.remove("reveal-ready"); };
  }, []);
  return null;
}
