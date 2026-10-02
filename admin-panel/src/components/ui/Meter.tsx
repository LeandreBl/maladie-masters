import { cn } from "../../lib/utils";

/**
 * The labelled 9px meter of the "Plan mix" panel: a name, its value, and a
 * pill-shaped fill. `depth` steps down the accent ramp so several meters in a
 * row stay distinguishable without leaving the palette.
 */
export function Meter({
  label,
  value,
  sharePct,
  depth = 0,
  className,
}: {
  label: string;
  value: string;
  sharePct: number;
  depth?: 0 | 1 | 2;
  className?: string;
}) {
  const FILLS = [
    "var(--color-accent)",
    "var(--color-accent-700)",
    "var(--color-accent-400)",
  ];

  return (
    <div className={className}>
      <div className="mb-1 flex justify-between text-[13px]">
        <span className="truncate">{label}</span>
        <span className="num flex-none pl-2 text-[15px]">{value}</span>
      </div>
      <div className="meter">
        <span
          style={{
            // Clamped: a share can round above 100 across several meters, and
            // a fill wider than its track escapes the rounded clip.
            width: `${Math.min(100, Math.max(0, sharePct))}%`,
            background: FILLS[depth],
          }}
        />
      </div>
    </div>
  );
}

/** A single unlabelled bar, for a rate shown next to its own number. */
export function MiniMeter({
  sharePct,
  tone = "accent",
}: {
  sharePct: number;
  tone?: "accent" | "sage";
}) {
  return (
    <div className={cn("meter")}>
      <span
        style={{
          width: `${Math.min(100, Math.max(0, sharePct))}%`,
          background:
            tone === "sage" ? "var(--color-accent-2)" : "var(--color-accent)",
        }}
      />
    </div>
  );
}
