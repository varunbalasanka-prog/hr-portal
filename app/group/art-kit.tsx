/**
 * The drawing rulebook for the company site, shared by every picture:
 * - one 400 x 400 canvas, so every drawing is the same size and every line the same weight (5);
 * - indigo outlines with round ends, white or one pale fill, and one accent (red, or gold for jewellery);
 * - each object stands in a white temple arch edged with kolam dots;
 * - outlines are paths marked .g-line (pathLength 1) so they can draw themselves once on arrival.
 */
export const INK = "#2b2177";
export const RED = "#d9261c";
export const GOLD = "#c99a3a";
export const GOLD_PALE = "#f3e3b8";
export const PALE = "#e9e7f4";
export const W = 5;

/** A circle written as a path, because outline drawing needs paths in every browser. */
export const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
/** A rounded rectangle written as a path. */
export const rect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;

/** One outlined shape. fill="none" draws a bare line. */
export function Line({ d, fill = "none", stroke = INK, width = W, className = "", style }: { d: string; fill?: string; stroke?: string; width?: number; className?: string; style?: React.CSSProperties }) {
  return <path d={d} fill={fill} stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className={`g-line ${className}`} style={style} />;
}

/** The white arch every drawing stands in, with a row of kolam dots around it. */
export function Stage() {
  return (
    <g>
      <path d="M50 386V214A150 150 0 0 1 350 214V386Z" fill="#ffffff" />
      <path d="M34 386V214A166 166 0 0 1 366 214V386" fill="none" stroke={RED} strokeOpacity={0.45} strokeWidth={5} strokeLinecap="round" strokeDasharray="0 17" />
    </g>
  );
}
