"use client";
import { useEffect, useState } from "react";
import { INK, Line, PALE, RED, Stage, circle, rect } from "./art-kit";

/**
 * A wristwatch standing in its arch. The hands show the visitor's own
 * time (10:10 until the page has loaded) and keep ticking even when animations are paused.
 */
export function WatchFace() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const h = now ? now.getHours() % 12 : 10, m = now ? now.getMinutes() : 10, s = now ? now.getSeconds() : 30;
  const C = 226; // centre of the dial
  const hand = (deg: number, len: number, w: number, color: string) => (
    <line x1={200} y1={C} x2={200} y2={C - len} stroke={color} strokeWidth={w} strokeLinecap="round" transform={`rotate(${deg} 200 ${C})`} />
  );
  const label = now
    ? `Drawing of a wristwatch showing your time, ${now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`
    : "Drawing of a wristwatch";
  return (
    <svg viewBox="0 0 400 400" role="img" aria-label={label} className="w-full">
      <Stage />
      <Line d={rect(164, 66, 72, 86, 12)} fill={INK} />
      <Line d={rect(164, 300, 72, 86, 12)} fill={INK} />
      {[322, 344, 366].map((y) => <circle key={y} cx={200} cy={y} r={4.5} fill="#ffffff" className="g-fill" />)}
      <Line d={rect(286, C - 13, 16, 26, 5)} fill={PALE} />
      <Line d={circle(200, C, 90)} fill={PALE} />
      <Line d={circle(200, C, 74)} fill="#ffffff" />
      <g className="g-fill">
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1={200} y1={C - 66} x2={200} y2={C - (i % 3 ? 58 : 50)} stroke={INK} strokeWidth={i % 3 ? 3 : 5} strokeLinecap="round" transform={`rotate(${i * 30} 200 ${C})`} />
        ))}
        {hand(h * 30 + m / 2, 38, 7, INK)}
        {hand(m * 6 + s / 10, 56, 5, INK)}
        {hand(s * 6, 60, 2.5, RED)}
        <circle cx={200} cy={C} r={5} fill={RED} />
      </g>
    </svg>
  );
}
