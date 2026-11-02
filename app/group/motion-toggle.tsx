"use client";
import { useEffect, useState } from "react";

/** The footer's "Pause animations" switch. The choice is remembered on this device and applied before the next page paints. */
export function MotionToggle() {
  const [calm, setCalm] = useState(false);
  useEffect(() => setCalm(document.documentElement.dataset.motion === "calm"), []);
  const flip = () => {
    const next = !calm;
    setCalm(next);
    const root = document.documentElement;
    if (next) root.dataset.motion = "calm";
    else delete root.dataset.motion;
    try { localStorage.setItem("bs-motion", next ? "calm" : "full"); } catch {}
  };
  return (
    <button type="button" onClick={flip} aria-pressed={calm} className="underline decoration-[0.08em] underline-offset-[0.2em] hover:decoration-[0.16em]">
      {calm ? "Play animations" : "Pause animations"}
    </button>
  );
}
