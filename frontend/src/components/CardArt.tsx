import { useMemo, type ReactNode } from "react";
import type { Card } from "../api/types";

/**
 * The art of a card whose disease has no picture on Wikimedia (about 40 % of
 * them): a microscope field of made-up cells and a periodic-table tile.
 * Everything is seeded by the card id, so a disease always looks the same.
 */
export function GeneratedArt({ card }: { card: Pick<Card, "id" | "number" | "name" | "lang"> }) {
  const cells = useMemo(() => specimen(card.id), [card.id]);
  const symbol = useMemo(() => elementSymbol(card.name), [card.name]);

  return (
    <div className="mm-art-gen" aria-hidden>
      <svg viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice">
        <defs>
          <clipPath id={`lens-${card.id}`}>
            <circle cx="60" cy="45" r="38" />
          </clipPath>
        </defs>
        <circle cx="60" cy="45" r="38" className="lens-field" />
        <g clipPath={`url(#lens-${card.id})`}>
          <path d="M60 7v76M22 45h76" className="lens-reticle" />
          {cells}
        </g>
        <circle cx="60" cy="45" r="38" className="lens-ring" />
        <circle cx="60" cy="45" r="41" className="lens-ring lens-ring--outer" />
      </svg>
      <div className="mm-element">
        <span className="mm-element-num">{card.number}</span>
        <span className="mm-element-sym" lang={card.lang}>
          {symbol}
        </span>
      </div>
    </div>
  );
}

// Words that say nothing about which disease it is: "Maladie de Lyme" is "Ly".
const FILLER = new Set([
  "maladie", "maladies", "syndrome", "trouble", "troubles", "infection", "de", "du", "des", "d", "la", "le",
  "les", "l", "à", "a", "au", "aux", "en", "et", "par", "type", "disease", "diseases", "disorder", "of",
  "the", "and", "by", "in", "to", "with", "acute", "chronic", "aiguë", "chronique",
]);

/** "Grippe" → "Gr", "Sclérose en plaques" → "Sp", "VIH" → "VIH", "阿尔茨海默病" → "阿". */
export function elementSymbol(name: string): string {
  const han = name.match(/\p{Script=Han}/u);
  if (han) return han[0];
  // "Alzheimer's disease": the possessive is not a word.
  const words = name.replace(/['’]s\b/gu, "").match(/[\p{L}\p{N}]+/gu) ?? [];
  const meaningful = words.filter((w) => !FILLER.has(w.toLocaleLowerCase()));
  const pick = meaningful.length > 0 ? meaningful : words;
  if (pick.length === 0) return "?";
  const [first, second] = pick;
  // An acronym reads better whole than cut in two.
  if (/^\p{Lu}[\p{Lu}\p{N}]{1,4}$/u.test(first)) return first;
  const head = first[0].toLocaleUpperCase();
  const tail = second && /^\p{L}/u.test(second) ? second[0] : first[1] ?? "";
  return head + tail.toLocaleLowerCase();
}

/** mulberry32: tiny, good enough to scatter cells. */
function seeded(text: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Kind = "coccus" | "bacillus" | "virion";
const KINDS: Kind[] = ["coccus", "bacillus", "virion"];

function specimen(id: string) {
  const rnd = seeded(id);
  const between = (min: number, max: number) => min + rnd() * (max - min);
  // One dominant shape per disease, with a few strays so it looks alive.
  const main = KINDS[Math.floor(rnd() * KINDS.length)];
  const count = Math.floor(between(7, 13));
  const placed: { x: number; y: number; r: number }[] = [];
  const nodes: ReactNode[] = [];

  for (let tries = 0; placed.length < count && tries < 200; tries++) {
    const kind = rnd() < 0.82 ? main : KINDS[Math.floor(rnd() * KINDS.length)];
    const r = kind === "virion" ? between(3.5, 6) : between(4.5, 8.5);
    const angle = rnd() * Math.PI * 2;
    const dist = Math.sqrt(rnd()) * 42;
    const x = 60 + Math.cos(angle) * dist;
    const y = 45 + Math.sin(angle) * dist;
    if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < (p.r + r) * 0.95)) continue;
    placed.push({ x, y, r });
    const key = placed.length;
    const rot = Math.round(rnd() * 180);

    if (kind === "coccus") {
      nodes.push(
        <g key={key}>
          <circle cx={x} cy={y} r={r} className="cell" />
          <circle cx={x + between(-0.3, 0.3) * r} cy={y + between(-0.3, 0.3) * r} r={r * 0.34} className="nucleus" />
        </g>,
      );
    } else if (kind === "bacillus") {
      nodes.push(
        <g key={key} transform={`rotate(${rot} ${x} ${y})`}>
          <rect x={x - r * 1.7} y={y - r * 0.6} width={r * 3.4} height={r * 1.2} rx={r * 0.6} className="cell" />
          <circle cx={x - r * 0.7} cy={y} r={r * 0.2} className="nucleus" />
          <circle cx={x + r * 0.6} cy={y} r={r * 0.24} className="nucleus" />
        </g>,
      );
    } else {
      const spikes = Math.floor(between(8, 13));
      const rays = Array.from({ length: spikes }, (_, i) => {
        const a = (i / spikes) * Math.PI * 2 + rot;
        return [x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45];
      });
      nodes.push(
        <g key={key}>
          <path d={rays.map(([x1, y1, x2, y2]) => `M${x1} ${y1}L${x2} ${y2}`).join("")} className="spike" />
          {rays.map(([, , x2, y2], i) => (
            <circle key={i} cx={x2} cy={y2} r={0.7} className="nucleus" />
          ))}
          <circle cx={x} cy={y} r={r} className="cell" />
          <circle cx={x} cy={y} r={r * 0.45} className="nucleus" />
        </g>,
      );
    }
  }

  // Specks of debris between the cells.
  for (let i = 0; i < 14; i++) {
    nodes.push(<circle key={`d${i}`} cx={between(20, 100)} cy={between(6, 84)} r={between(0.3, 0.9)} className="speck" />);
  }
  return nodes;
}
