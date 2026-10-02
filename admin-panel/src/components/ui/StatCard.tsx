import type { ReactNode } from "react";
import { Card } from "./Card";
import { Tag, type Tone } from "./Tag";
import { cn } from "../../lib/utils";

/**
 * A dashboard metric: kicker, the value in the heading face, a delta tag and
 * a meta line — with room for a sparkline or a meter below.
 */
export function StatCard({
  kicker,
  value,
  delta,
  deltaTone = "accent",
  meta,
  children,
  valueClassName,
  title,
}: {
  kicker: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  deltaTone?: Tone;
  meta?: ReactNode;
  children?: ReactNode;
  valueClassName?: string;
  /** Native tooltip, used to explain a metric the design renamed. */
  title?: string;
}) {
  return (
    <Card title={title}>
      <div className="card-kicker">{kicker}</div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={cn("num text-4xl", valueClassName)}>{value}</span>
        {delta ? <Tag tone={deltaTone}>{delta}</Tag> : null}
      </div>
      {meta ? <div className="card-meta">{meta}</div> : null}
      {children}
    </Card>
  );
}

/** The compact variant used on the billing tab and the trainer drill-down. */
export function MiniStatCard({
  kicker,
  value,
  meta,
}: {
  kicker: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <Card className="p-[15px_17px]">
      <div className="card-kicker">{kicker}</div>
      <div className="num my-[2px] text-[32px]">{value}</div>
      {meta ? <div className="card-meta">{meta}</div> : null}
    </Card>
  );
}
