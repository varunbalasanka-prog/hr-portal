"use client";
import { useEffect, useState } from "react";
import { INK, Line, PALE, RED, Stage, circle, rect } from "./art-kit";

/**
 * A wristwatch in its arch, with a pair of spectacles folded in front. The hands show the visitor's own
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
  const hand = (deg: number, len: number, w: number, color: string) => (
    <line x1={200} y1={212} x2={200} y2={212 - len} stroke={color} strokeWidth={w} strokeLinecap="round" transform={`rotate(${deg} 200 212)`} />
  );
  const label = now
    ? `Drawing of a wristwatch showing your time, ${now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}, with a pair of spectacles`
    : "Drawing of a wristwatch with a pair of spectacles";
  return (
    <svg viewBox="0 0 400 400" role="img" aria-label={label} className="w-full">
      <Stage />
      <Line d={rect(168, 70, 64, 76, 10)} fill={INK} />
      <Line d={rect(168, 278, 64, 40, 10)} fill={INK} />
      <Line d={rect(280, 201, 14, 22, 4)} fill={PALE} />
      <Line d={circle(200, 212, 80)} fill={PALE} />
      <Line d={circle(200, 212, 66)} fill="#ffffff" />
      <g className="g-fill">
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1={200} y1={i % 3 ? 152 : 150} x2={200} y2={i % 3 ? 158 : 166} stroke={INK} strokeWidth={i % 3 ? 3 : 5} strokeLinecap="round" transform={`rotate(${i * 30} 200 212)`} />
        ))}
        {hand(h * 30 + m / 2, 36, 7, INK)}
        {hand(m * 6 + s / 10, 52, 5, INK)}
        {hand(s * 6, 56, 2.5, RED)}
        <circle cx={200} cy={212} r={5} fill={RED} />
      </g>
      <clipPath id="g-lenses"><circle cx={152} cy={344} r={28} /><circle cx={248} cy={344} r={28} /></clipPath>
      <Line d={circle(152, 344, 30)} fill={PALE} />
      <Line d={circle(248, 344, 30)} fill={PALE} />
      <g clipPath="url(#g-lenses)">
        <g transform="rotate(25 200 344)">
          <rect x={140} y={290} width={10} height={110} fill="#ffffff" className="g-glint" opacity={0} />
          <rect x={236} y={290} width={10} height={110} fill="#ffffff" className="g-glint" opacity={0} />
        </g>
      </g>
      <Line d="M182 338Q200 324 218 338" />
      <Line d="M122 336L100 322M278 336L300 322" />
    </svg>
  );
}
