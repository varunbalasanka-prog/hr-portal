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

/** The picture for each business, keyed like SHOWROOM_GROUPS. Outlines draw once on arrival; loops run only while on screen. */
export function BusinessArt({ k, className = "" }: { k: string; className?: string }) {
  return (
    <div data-reveal="draw" data-live className={`w-full max-w-[10rem] md:max-w-[20rem] ${className}`}>
      {k === "jewellery" ? <Jhumka /> : k === "watches" ? <WatchFace /> : <Scooter />}
    </div>
  );
}
