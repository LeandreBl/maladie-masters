const HEIGHT = 120;

/**
 * The 12-bar activity chart. The last bar is solid accent and the rest sit at
 * 55%, so "now" reads without a legend — the design's own device.
 */
export function BarChart({
  values,
  height = 130,
  ticks,
}: {
  values: number[];
  height?: number;
  ticks?: string[];
}) {
  if (values.length === 0) {
    return <div style={{ height }} aria-hidden="true" />;
  }

  const max = Math.max(...values, 1);
  const slot = 100 / values.length;
  // A tenth of the slot on each side keeps the bars from touching.
  const barWidth = slot * 0.7;

  return (
    <>
      <svg
        viewBox={`0 0 100 ${HEIGHT}`}
        preserveAspectRatio="none"
        style={{ height }}
        className="w-full"
        aria-hidden="true"
      >
        <g stroke="var(--color-divider)" strokeWidth="0.5">
          {[30, 60, 90, HEIGHT - 1].map((y) => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} />
          ))}
        </g>
        {values.map((value, index) => {
          const barHeight = ((value / max) * (HEIGHT - 8)) || 0;
          const isLast = index === values.length - 1;
          return (
            <rect
              key={index}
              x={index * slot + (slot - barWidth) / 2}
              y={HEIGHT - 1 - barHeight}
              width={barWidth}
              height={barHeight}
              fill={
                isLast
                  ? "var(--color-accent)"
                  : "color-mix(in srgb, var(--color-accent) 55%, transparent)"
              }
            />
          );
        })}
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

export type StackedBar = { label: string; lower: number; upper: number };

/**
 * FIG. 03 — revenue per month, monthly plans stacked under annual ones.
 *
 * Both segments of a month share the column's total, so the bar heights
 * compare across months as well as within one.
 */
export function StackedBarChart({
  bars,
  height = 160,
  ticks,
}: {
  bars: StackedBar[];
  height?: number;
  ticks?: string[];
}) {
  if (bars.length === 0) {
    return <div style={{ height }} aria-hidden="true" />;
  }

  const max = Math.max(...bars.map((bar) => bar.lower + bar.upper), 1);
  const slot = 100 / bars.length;
  const barWidth = slot * 0.55;
  const plot = HEIGHT - 8;

  return (
    <>
      <svg
        viewBox={`0 0 100 ${HEIGHT}`}
        preserveAspectRatio="none"
        style={{ height }}
        className="w-full"
        aria-hidden="true"
      >
        <g stroke="var(--color-divider)" strokeWidth="0.5">
          {[30, 60, 90, HEIGHT - 1].map((y) => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} />
          ))}
        </g>
        {bars.map((bar, index) => {
          const lowerHeight = (bar.lower / max) * plot;
          const upperHeight = (bar.upper / max) * plot;
          const x = index * slot + (slot - barWidth) / 2;
          const base = HEIGHT - 1;

          return (
            <g key={bar.label}>
              <rect
                x={x}
                y={base - lowerHeight}
                width={barWidth}
                height={lowerHeight}
                fill="color-mix(in srgb, var(--color-accent) 50%, transparent)"
              />
              <rect
                x={x}
                y={base - lowerHeight - upperHeight}
                width={barWidth}
                height={upperHeight}
                fill="var(--color-accent-2-600)"
              />
            </g>
          );
        })}
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

/** The legend for the stacked chart's two voices. */
export function StackedLegend({
  lower,
  upper,
}: {
  lower: string;
  upper: string;
}) {
  return (
    <div className="flex gap-[14px] text-xs text-muted">
      <span className="flex items-center gap-[6px]">
        <span
          className="h-[10px] w-[10px] rounded-full"
          style={{
            background:
              "color-mix(in srgb, var(--color-accent) 50%, transparent)",
          }}
        />
        {lower}
      </span>
      <span className="flex items-center gap-[6px]">
        <span className="h-[10px] w-[10px] rounded-full bg-sage-600" />
        {upper}
      </span>
    </div>
  );
}
