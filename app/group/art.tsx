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

/** A jute sack of dhal standing in its arch, heaped with gold grains, with a seedless tamarind block and a brass measure beside it. */
export function DhalSack() {
  const grains = [
    [168, 186], [184, 176], [200, 170], [216, 176], [232, 186], [176, 194], [192, 188], [208, 188], [224, 194], [200, 182],
  ];
  return (
    <svg viewBox="0 0 400 400" role="img" aria-label="Drawing of a sack of dhal and a block of seedless tamarind" className="w-full">
      <Stage />
      <Line d="M128 372C116 312 122 252 146 212L254 212C278 252 284 312 272 372Z" fill={GOLD_PALE} />
      <Line d="M150 300C182 294 218 294 250 300" width={3} />
      <Line d="M146 330C182 324 218 324 254 330" width={3} />
      <Line d={rect(172, 244, 56, 36, 6)} fill={RED} />
      <Line d="M140 214C150 194 176 166 200 162C224 166 250 194 260 214Z" fill={GOLD_PALE} />
      {grains.map(([x, y], i) => (
        <Line key={i} d={circle(x, y, 5)} fill={GOLD} width={3} className="g-shimmer" style={{ "--d": `${i * 350}ms` } as React.CSSProperties} />
      ))}
      <Line d="M134 216C170 206 230 206 266 216" />
      <Line d={rect(284, 330, 58, 42, 8)} fill="#ffffff" />
      <Line d="M292 344C304 340 316 348 328 342" width={3} />
      <Line d="M292 358C306 354 318 362 334 356" width={3} />
      <Line d="M64 372L70 324H118L124 372Z" fill={GOLD} />
      <Line d="M66 324C80 316 108 316 122 324" />
    </svg>
  );
}

/** The picture for each business, keyed like SHOWROOM_GROUPS. Outlines draw once on arrival; loops run only while on screen. */
export function BusinessArt({ k, className = "" }: { k: string; className?: string }) {
  return (
    <div data-reveal="draw" data-live className={`w-full max-w-[10rem] md:max-w-[20rem] ${className}`}>
      {k === "jewellery" ? <Jhumka /> : k === "watches" ? <WatchFace /> : k === "foods" ? <DhalSack /> : <Scooter />}
    </div>
  );
}
