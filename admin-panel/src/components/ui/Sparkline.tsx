import { cn } from "../../lib/utils";

/**
 * The 28px trend line under a metric card.
 *
 * Stretched with `preserveAspectRatio="none"` so it fills whatever width the
 * card has; `vector-effect` keeps the stroke 2.75px after that stretch, which
 * is what the design system asks for.
 */
export function Sparkline({
  values,
  tone = "accent",
  height = 28,
  className,
}: {
  values: number[];
  /** `neutral` for a metric that is flat or falling. */
  tone?: "accent" | "neutral";
  height?: number;
  className?: string;
}) {
  if (values.length < 2) {
    return <div style={{ height }} className={className} aria-hidden="true" />;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  // A flat series would divide by zero; draw it as a centred line instead.
  const span = max - min || 1;
  const step = 120 / (values.length - 1);

  const points = values
    .map((value, index) => {
      const y = 26 - ((value - min) / span) * 24;
      return `${(index * step).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 120 28"
      preserveAspectRatio="none"
      style={{ height }}
      className={cn("w-full", className)}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={
          tone === "accent"
            ? "var(--color-accent)"
            : "var(--color-neutral-600)"
        }
        strokeWidth="2.75"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
