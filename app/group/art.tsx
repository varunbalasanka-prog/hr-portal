/**
 * Flat drawings of what each business sells, made in code in the site's own colours (no photographs).
 * One language throughout: filled shapes, round line ends, ink #1b1640, the logo red as the one accent.
 */
import { WatchFace } from "./watch-face";

const INK = "#1b1640";
const RED = "#d9261c";
const GOLD = "#c79a3b";
const GOLD_DARK = "#9c7424";
const PEARL = "#fbfaf6";

/** A temple jhumka: ruby stud, short chain, a domed bell and a fringe of pearls. */
export function Jhumka({ className = "" }: { className?: string }) {
  const dome = [-58, -44, -30, -15, 0, 15, 30, 44, 58];
  const fringe = Array.from({ length: 11 }, (_, i) => 46 + i * 10.8);
  const petals = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  return (
    <svg viewBox="0 0 200 380" role="img" aria-label="Drawing of a gold jhumka earring with pearls" className={className}>
      {petals.map((a, i) => <circle key={i} cx={100 + Math.cos(a) * 24} cy={44 + Math.sin(a) * 24} r={10} fill={GOLD} />)}
      <circle cx={100} cy={44} r={22} fill={GOLD_DARK} />
      <circle cx={100} cy={44} r={13} fill={RED} />
      {[78, 92, 106].map((y) => <ellipse key={y} cx={100} cy={y} rx={6} ry={8} fill="none" stroke={GOLD} strokeWidth={4} />)}
      <circle cx={100} cy={124} r={9} fill={RED} />
      <path d="M36 248 C36 168 64 132 100 132 C136 132 164 168 164 248 Z" fill={GOLD} />
      <path d="M50 214 C64 206 82 202 100 202 C118 202 136 206 150 214" fill="none" stroke={GOLD_DARK} strokeWidth={5} strokeLinecap="round" />
      <path d="M62 176 C74 170 87 167 100 167 C113 167 126 170 138 176" fill="none" stroke={GOLD_DARK} strokeWidth={5} strokeLinecap="round" />
      {dome.map((dx) => <circle key={dx} cx={100 + dx} cy={232 - Math.abs(dx) * 0.05} r={4.5} fill={PEARL} />)}
      <rect x={30} y={246} width={140} height={12} rx={6} fill={GOLD_DARK} />
      {fringe.map((x, i) => (
        <g key={x}>
          <line x1={x} y1={258} x2={x} y2={i % 2 ? 286 : 300} stroke={GOLD} strokeWidth={2.5} />
          <circle cx={x} cy={i % 2 ? 292 : 306} r={6.5} fill={PEARL} stroke={GOLD_DARK} strokeWidth={1.5} />
        </g>
      ))}
      <line x1={100} y1={258} x2={100} y2={326} stroke={GOLD} strokeWidth={3} />
      <path d="M100 322 C112 338 114 352 100 366 C86 352 88 338 100 322 Z" fill={RED} />
    </svg>
  );
}

/** Round spectacles, drawn in one line weight. */
export function Spectacles({ className = "", color = "#ffffff" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 300 120" role="img" aria-label="Drawing of a pair of spectacles" className={className}>
      <circle cx={84} cy={66} r={46} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={9} />
      <circle cx={216} cy={66} r={46} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={9} />
      <path d="M130 60 Q150 44 170 60" fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" />
      <path d="M38 56 L8 36 M262 56 L292 36" stroke={color} strokeWidth={9} strokeLinecap="round" />
    </svg>
  );
}

/** A scooter in side view: white body, ink seat and wheels, a red tail lamp. */
export function Scooter({ className = "", color = "#ffffff" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 520 300" role="img" aria-label="Drawing of a scooter" className={className}>
      <circle cx={112} cy={238} r={50} fill={INK} />
      <circle cx={112} cy={238} r={19} fill={color} />
      <circle cx={424} cy={238} r={50} fill={INK} />
      <circle cx={424} cy={238} r={19} fill={color} />
      <path d="M366 226 A60 60 0 0 1 482 226" fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" />
      <path d="M38 206 C42 150 96 126 178 124 L290 126 C304 127 309 140 304 154 L294 206 Z" fill={color} />
      <rect x={290} y={192} width={96} height={16} rx={6} fill={color} />
      <path d="M358 206 C364 150 372 112 386 80 L410 80 C404 124 410 170 436 206 Z" fill={color} />
      <line x1={404} y1={86} x2={424} y2={238} stroke={color} strokeWidth={11} strokeLinecap="round" />
      <path d="M120 122 C124 100 160 94 204 96 L282 100 C296 101 296 120 282 122 Z" fill={INK} />
      <line x1={364} y1={72} x2={436} y2={64} stroke={INK} strokeWidth={9} strokeLinecap="round" />
      <ellipse cx={424} cy={96} rx={15} ry={11} fill="#ffe08a" />
      <rect x={30} y={168} width={18} height={12} rx={4} fill={RED} stroke={color} strokeWidth={3} />
    </svg>
  );
}

/** A bicycle in a single line weight. */
export function Bicycle({ className = "", color = "#ffffff" }: { className?: string; color?: string }) {
  const line = { stroke: color, strokeWidth: 8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <svg viewBox="0 0 300 190" role="img" aria-label="Drawing of a bicycle" className={className}>
      <circle cx={60} cy={132} r={50} {...line} />
      <circle cx={240} cy={132} r={50} {...line} />
      <path d="M60 132 L140 132 L120 62 L214 64 L140 132 M60 132 L120 62 M214 64 L240 132 M214 64 L212 42 L232 40" {...line} />
      <path d="M104 52 L136 52" {...line} strokeWidth={11} />
      <circle cx={140} cy={132} r={10} fill={color} />
    </svg>
  );
}

/** The picture for each business, keyed like SHOWROOM_GROUPS. */
export function BusinessArt({ k, className = "" }: { k: string; className?: string }) {
  if (k === "jewellery") return <Jhumka className={className} />;
  if (k === "watches") {
    return (
      <div className={`flex items-center gap-6 ${className}`}>
        <WatchFace className="w-[38%] shrink-0" />
        <Spectacles className="w-[62%]" />
      </div>
    );
  }
  return (
    <div className={`flex flex-col items-end gap-4 ${className}`}>
      <Scooter className="w-full" />
      <Bicycle className="w-[52%]" />
    </div>
  );
}
