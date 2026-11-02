"use client";
import { useEffect } from "react";

/**
 * Two jobs, both with one IntersectionObserver each:
 * - [data-reveal] elements play their entrance once as they scroll into view. Content is only hidden once
 *   this has run, so without JavaScript everything shows straight away.
 * - [data-live] elements get .is-live only while on screen, so looping drawings rest when nobody sees them.
 */
export function ScrollReveal() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    const reveal = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        reveal.unobserve(e.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    const live = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle("is-live", e.isIntersecting);
    });
    root.classList.add("reveal-ready");
    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
      // Anything already on screen at load (the top of the page) shows at once, with no entrance.
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && el.dataset.reveal !== "draw") el.classList.add("is-in");
      else reveal.observe(el);
    });
    document.querySelectorAll<HTMLElement>("[data-live]").forEach((el) => live.observe(el));
    return () => { reveal.disconnect(); live.disconnect(); root.classList.remove("reveal-ready"); };
  }, []);
  return null;
}
