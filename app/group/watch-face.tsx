"use client";
import { useEffect, useState } from "react";

const INK = "#1b1640";
const RED = "#d9261c";

/** A drawn wristwatch whose hands show the visitor's own time (10:10 until the page has loaded). */
export function WatchFace({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const h = now ? now.getHours() % 12 : 10, m = now ? now.getMinutes() : 10, s = now ? now.getSeconds() : 30;
  const hand = (deg: number, len: number, w: number, color: string) => (
    <line x1={110} y1={210} x2={110} y2={210 - len} stroke={color} strokeWidth={w} strokeLinecap="round" transform={`rotate(${deg} 110 210)`} />
  );
  const label = now ? `Drawing of a wristwatch showing your time, ${now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : "Drawing of a wristwatch";
  return (
    <svg viewBox="0 0 230 420" role="img" aria-label={label} className={className}>
      <rect x={62} y={0} width={96} height={130} rx={12} fill={INK} />
      <rect x={62} y={290} width={96} height={130} rx={12} fill={INK} />
      {[330, 356, 382].map((y) => <circle key={y} cx={110} cy={y} r={5} fill="#d9d6ef" />)}
      <rect x={206} y={198} width={18} height={24} rx={4} fill="#d9d6ef" />
      <circle cx={110} cy={210} r={102} fill="#d9d6ef" />
      <circle cx={110} cy={210} r={88} fill="#ffffff" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={110} y1={i % 3 ? 130 : 128} x2={110} y2={i % 3 ? 138 : 146} stroke={INK} strokeWidth={i % 3 ? 3 : 6} strokeLinecap="round" transform={`rotate(${i * 30} 110 210)`} />
      ))}
      {hand(h * 30 + m / 2, 46, 8, INK)}
      {hand(m * 6 + s / 10, 68, 5, INK)}
      {hand(s * 6, 74, 2.5, RED)}
      <circle cx={110} cy={210} r={6} fill={RED} />
    </svg>
  );
}
