import { useT } from "../i18n";
import type { Rarity } from "../lib/api";
import { cn } from "../lib/utils";

const KEY: Record<Rarity, string> = {
  COMMON: "common",
  UNCOMMON: "uncommon",
  RARE: "rare",
  EPIC: "epic",
  LEGENDARY: "legendary",
};

export function rarityColors(rarity: Rarity) {
  return {
    background: `var(--rarity-${KEY[rarity]}-bg)`,
    color: `var(--rarity-${KEY[rarity]}-fg)`,
  };
}

/** A rarity, as a tinted pill. */
export function RarityTag({
  rarity,
  className,
}: {
  rarity: Rarity;
  className?: string;
}) {
  const t = useT();
  return (
    <span className={cn("rarity-tag", className)} style={rarityColors(rarity)}>
      {t.rarity[rarity]}
    </span>
  );
}

/** The rarity's colour alone, for a legend or a meter. */
export function RarityDot({ rarity }: { rarity: Rarity }) {
  return (
    <span
      className="rarity-dot"
      style={{ background: `var(--rarity-${KEY[rarity]}-fg)` }}
    />
  );
}

/** A card's Wikipedia thumbnail, or an empty tile in its place. */
export function CardThumb({
  src,
  size = 36,
}: {
  src: string | null;
  size?: number;
}) {
  return src ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="card-thumb"
      style={{ width: size, height: size }}
    />
  ) : (
    <span className="card-thumb" style={{ width: size, height: size }} />
  );
}
