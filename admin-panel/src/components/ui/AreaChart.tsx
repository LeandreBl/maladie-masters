import { useMemo } from "react";

export type AreaPoint = { date: string; value: number; previous?: number };

const WIDTH = 600;
const HEIGHT = 200;
/** Five horizontal rules, as the design specifies. */
const GRIDLINES = [40, 80, 120, 160, 199];

/**
 * FIG. 01 — the current period as a 2px accent line over a 14% accent fill,
 * the previous one dashed in neutral.
 *
 * Both series share one vertical scale, or the comparison would be a lie: a
 * dashed line drawn against its own maximum always looks level with the solid
 * one.
 */
export function AreaChart({
  points,
  height = 220,
  ticks,
}: {
  points: AreaPoint[];
  height?: number;
  /** Axis labels, rendered as eyebrows under the plot. */
  ticks?: string[];
}) {
  const geometry = useMemo(() => {
    if (points.length < 2) return null;

    const values = points.flatMap((point) =>
      point.previous === undefined
        ? [point.value]
        : [point.value, point.previous],
    );
    const max = Math.max(...values, 1);
    const step = WIDTH / (points.length - 1);
    const y = (value: number) => HEIGHT - 4 - (value / max) * (HEIGHT - 30);

    const path = (pick: (point: AreaPoint) => number) =>
      points
        .map((point, index) => `${(index * step).toFixed(1)},${y(pick(point)).toFixed(1)}`)
        .join(" ");

    const current = path((point) => point.value);
    const hasPrevious = points.some((point) => point.previous !== undefined);

    return {
      current,
      previous: hasPrevious ? path((point) => point.previous ?? 0) : null,
      // The fill closes the line down to the baseline and back.
      area: `${current} ${WIDTH},${HEIGHT} 0,${HEIGHT}`,
    };
  }, [points]);

  if (!geometry) {
    return <div style={{ height }} aria-hidden="true" />;
  }

  return (
    <>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        style={{ height }}
        className="w-full"
        aria-hidden="true"
      >
        <g stroke="var(--color-divider)" strokeWidth="1">
          {GRIDLINES.map((y) => (
            <line key={y} x1="0" y1={y} x2={WIDTH} y2={y} />
          ))}
        </g>

        {geometry.previous ? (
          <polyline
            points={geometry.previous}
            fill="none"
            stroke="var(--color-neutral-500)"
            strokeWidth="2.75"
            strokeDasharray="5 5"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        <polygon
          points={geometry.area}
          fill="color-mix(in srgb, var(--color-accent) 14%, transparent)"
        />
        <polyline
          points={geometry.current}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {ticks && ticks.length > 0 ? (
        <div className="eyebrow mt-[6px] flex justify-between text-muted">
          {ticks.map((tick, index) => (
            <span key={`${tick}-${index}`}>{tick}</span>
          ))}
        </div>
      ) : null}
    </>
  );
}

/** The legend row above the plot. */
export function AreaLegend({
  current,
  previous,
}: {
  current: string;
  previous?: string;
}) {
  return (
    <div className="flex gap-[14px] text-xs text-muted">
      <span className="flex items-center gap-[6px]">
        <span className="h-[3px] w-4 rounded-full bg-accent" />
        {current}
      </span>
      {previous ? (
        <span className="flex items-center gap-[6px]">
          <span className="w-[14px] border-t-[1.5px] border-dashed border-neutral-500" />
          {previous}
        </span>
      ) : null}
    </div>
  );
}
