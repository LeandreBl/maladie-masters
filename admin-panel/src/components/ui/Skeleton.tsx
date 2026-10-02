import type { CSSProperties, ReactNode } from "react";
import { useT } from "../../i18n";
import { cn } from "../../lib/utils";
import { Card } from "./Card";

/**
 * One placeholder block, cut to the shape of the value that is coming.
 *
 * A skeleton is layout, never content: each block is `aria-hidden`, and the
 * region holding them carries the announcement (`SkeletonRegion` below), so a
 * screen reader hears "loading" once instead of a wall of empty boxes.
 *
 * `box` is the line height of the text this stands in for. A bar drawn at the
 * text's full height reads as a slab, and one drawn thin leaves the row
 * shorter than it is about to be — which is the jump a skeleton exists to
 * prevent. Given `box`, the bar stays thin and is centred in the space the
 * words will take.
 */
export function Skeleton({
  className,
  style,
  box,
}: {
  className?: string;
  style?: CSSProperties;
  /** The height of the line box this placeholder holds open. */
  box?: number | string;
}) {
  const bar = (
    <span
      aria-hidden="true"
      className={cn("skeleton block h-4", className)}
      style={style}
    />
  );

  if (box === undefined) return bar;

  return (
    <span
      aria-hidden="true"
      className="flex items-center"
      style={{ height: box }}
    >
      {bar}
    </span>
  );
}

/**
 * The announcement wrapped around a set of placeholders.
 *
 * `aria-busy` says the region is mid-load and the visually hidden label says
 * it in words; `role="status"` keeps it polite, so it never interrupts what
 * the operator is already reading.
 */
export function SkeletonRegion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const t = useT();

  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{t.common.loading}</span>
      {children}
    </div>
  );
}

/**
 * A metric card's kicker, its big number and the meta line under it.
 *
 * Every box here is the one the real card renders — 16px for the kicker,
 * 38px for a `text-4xl` figure on the `.num` face, 17px for `.card-meta` — so
 * the grid this sits in is already the height it will keep. Spacing comes from
 * `.card`'s own flex gap, never from margins here, or the two would stack.
 */
export function SkeletonStat({
  compact = false,
  meta = true,
}: {
  compact?: boolean;
  meta?: boolean;
}) {
  return (
    <>
      <Skeleton className="h-[9px] w-[84px]" box={16} />
      <Skeleton
        className={cn("h-[26px]", compact ? "w-[92px]" : "w-[110px]")}
        box={compact ? 34 : 38}
      />
      {meta ? <Skeleton className="h-[9px] w-[70%]" box={17} /> : null}
    </>
  );
}

/**
 * A chart-shaped placeholder: the plot area at its real height and the axis
 * ticks under it, so the panel keeps the size it will have.
 */
export function SkeletonChart({
  height = 220,
  ticks = 3,
  className,
}: {
  height?: number;
  ticks?: number;
  className?: string;
}) {
  return (
    <div className={className} aria-hidden="true">
      <Skeleton className="w-full rounded-md" style={{ height }} />
      {ticks > 0 ? (
        <div className="mt-[6px] flex justify-between">
          {Array.from({ length: ticks }, (_, index) => (
            <Skeleton key={index} className="h-[9px] w-[46px]" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** `Panel`'s markup, with its title and eyebrow still to come. */
export function SkeletonPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 p-[18px_20px]", className)}>
      <div className="mb-3 flex items-center gap-3">
        <Skeleton className="h-[14px] w-[148px]" />
        <Skeleton className="ml-auto h-[10px] w-[76px]" />
      </div>
      {children}
    </Card>
  );
}

/**
 * A run of rows, for a list or a small table inside a panel.
 *
 * The three widths read as a row of columns rather than a stack of bars, which
 * is what tells the operator a table is coming and not a paragraph.
 */
export function SkeletonList({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-[4px] pt-[6px]", className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-[11px] w-[36%]" box={22} />
          <Skeleton className="h-[11px] w-[16%]" box={22} />
          <Skeleton className="ml-auto h-[11px] w-[22%]" box={22} />
        </div>
      ))}
    </div>
  );
}
