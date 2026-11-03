/**
 * Drawings of what each business sells, made in code to the rulebook in art-kit.tsx (no photographs).
 */
import { GOLD, GOLD_PALE, INK, Line, RED, Stage, circle, rect } from "./art-kit";
import { WatchFace } from "./watch-face";

/** A temple jhumka hanging in its arch: ruby stud, short chain, a gold dome and a fringe of pearls. */
export function Jhumka() {
  const domePearls = [140, 160, 180, 200, 220, 240, 260];
  const fringe = Array.from({ length: 10 }, (_, i) => 128 + i * 16);
  return (
    <svg viewBox="0 0 400 400" role="img" aria-label="Drawing of a gold jhumka earring with pearls" className="w-full">
      <Stage />
      <g className="g-sway">
        <Line d={circle(200, 92, 24)} fill={GOLD_PALE} />
        <Line d={circle(200, 92, 11)} fill={RED} />
        {[126, 140, 154].map((y) => <Line key={y} d={`M200 ${y - 7}c7 0 7 14 0 14c-7 0-7-14 0-14Z`} />)}
        <Line d={circle(200, 170, 8)} fill={RED} />
        <Line d="M122 290C122 214 156 180 200 180C244 180 278 214 278 290Z" fill={GOLD_PALE} />
        <Line d="M150 214C166 208 183 205 200 205C217 205 234 208 250 214" />
        <Line d="M136 248C156 241 178 238 200 238C222 238 244 241 264 248" />
        {domePearls.map((x) => <Line key={x} d={circle(x, 268, 5)} fill="#ffffff" width={3} />)}
        <Line d={rect(114, 288, 172, 12, 6)} fill={GOLD} />
        {fringe.map((x, i) => {
          const end = i % 2 ? 314 : 326;
          return (
            <g key={x}>
              <Line d={`M${x} 300V${end}`} width={3} />
              <Line d={circle(x, end + 7, 7)} fill="#ffffff" width={3} className="g-shimmer" style={{ "--d": `${i * 300}ms` } as React.CSSProperties} />
            </g>
          );
        })}
        <Line d="M200 300V338" width={3} />
        <Line d="M200 336C212 350 214 362 200 374C186 362 188 350 200 336Z" fill={RED} />
      </g>
    </svg>
  );
}

/** A scooter in side view standing in its arch: red body, indigo seat and tyres, wheels that turn. */
export function Scooter() {
  const wheel = (cx: number) => (
    <g key={cx}>
      <Line d={circle(cx, 330, 38)} fill={INK} />
      <Line d={circle(cx, 330, 22)} fill="#ffffff" />
      <g className="g-spin">
        <path d={`M${cx - 16} 330H${cx + 16}M${cx} 314V346`} stroke={INK} strokeWidth={4} strokeLinecap="round" />
        <circle cx={cx} cy={330} r={5} fill={INK} />
      </g>
    </g>
  );
  return (
    <svg viewBox="0 0 400 400" role="img" aria-label="Drawing of a scooter" className="w-full">
      <Stage />
      {wheel(105)}
      {wheel(300)}
      <Line d="M264 320A38 38 0 0 1 338 316" />
      <Line d="M58 312C60 262 100 240 160 238L235 240C246 241 250 252 246 262L238 312Z" fill={RED} />
      <Line d={rect(236, 300, 66, 14, 4)} fill={RED} />
      <Line d="M282 312C286 268 292 236 304 210L322 210C318 246 322 282 340 312Z" fill={RED} />
      <Line d="M314 214L300 330" />
      <Line d="M108 236C112 220 140 216 170 217L228 220C238 221 238 235 228 236Z" fill={INK} />
      <Line d="M292 200L344 194" />
      <Line d={circle(313, 228, 7)} fill="#ffffff" width={3} />
      <Line d={rect(52, 280, 12, 10, 3)} fill="#ffffff" width={3} />
    </svg>
  );
}

/**
 * A brass bowl heaped with split toor dhal, with a block of seedless tamarind beside it.
 * Dhal yellow and tamarind brown are the products' own colours, so the picture reads as food at a glance.
 */
export function DhalBowl() {
  const DHAL = "#f2c230";
  const TAMARIND = "#6e3a1c";
  // Split dhal grains scattered over the heap at random (fixed seed, so the server and browser draw the same picture).
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const grains: [number, number, number, string][] = [];
  const shades = ["#ffd84d", "#f7c62f", "#ffe07a", "#f0b92a"];
  while (grains.length < 120) {
    const x = 96 + rnd() * 160, y = 200 + rnd() * 58;
    if (((x - 176) / 82) ** 2 + ((y - 262) / 62) ** 2 < 0.92) grains.push([x, y, rnd() * 180, shades[grains.length % 4]]);
  }
  return (
    <svg viewBox="0 0 400 400" role="img" aria-label="Drawing of a bowl of toor dhal and a block of seedless tamarind" className="w-full">
      <Stage />
      <Line d="M90 262C102 220 138 198 176 196C214 198 250 220 262 262Z" fill={DHAL} />
      <g className="g-fill">
        {grains.map(([x, y, r, c], i) => (
          <ellipse key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} rx={5.5} ry={3.8} fill={c} stroke="#b8860b" strokeWidth={1.2} transform={`rotate(${r.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})`} />
        ))}
      </g>
      <Line d={rect(80, 254, 192, 18, 9)} fill={GOLD_PALE} />
      <Line d="M88 272H264C258 330 226 362 176 362C126 362 94 330 88 272Z" fill={GOLD} />
      <Line d="M140 362L130 376H222L212 362" fill={GOLD} />
      <Line d="M108 300C130 310 222 310 244 300" stroke="#ffffff" width={3} />
      <Line d="M268 320C270 306 282 300 300 300H338C350 300 356 308 356 320V360C356 370 350 376 338 376H286C274 376 266 370 266 360Z" fill={TAMARIND} />
      <Line d="M278 318C292 312 312 320 326 314C334 311 342 314 346 318" stroke="#b07448" width={3} />
      <Line d="M276 338C294 332 314 342 332 334C338 332 344 334 348 338" stroke="#b07448" width={3} />
      <Line d="M278 358C296 352 316 360 340 354" stroke="#b07448" width={3} />
      {[[72, 368], [86, 374], [66, 378], [100, 378], [58, 370]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx={6.5} ry={4.5} fill="#ffd95a" stroke="#b8860b" strokeWidth={1.5} className="g-fill" />
      ))}
    </svg>
  );
}

/** The picture for each business, keyed like SHOWROOM_GROUPS. Outlines draw once on arrival; loops run only while on screen. */
export function BusinessArt({ k, className = "" }: { k: string; className?: string }) {
  return (
    <div data-reveal="draw" data-live className={`w-full max-w-[10rem] md:max-w-[20rem] ${className}`}>
      {k === "jewellery" ? <Jhumka /> : k === "watches" ? <WatchFace /> : k === "foods" ? <DhalBowl /> : <Scooter />}
    </div>
  );
}
