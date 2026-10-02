import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/** `.card`: the surface every panel and metric sits on. */
export function Card({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cn("card", className)}>
      {children}
    </div>
  );
}

/**
 * A titled panel: heading, an optional eyebrow beside it and an optional
 * action pushed to the right — the recurring header of every chart and table
 * card in the design.
 */
export function Panel({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 p-[18px_20px]", className)}>
      {title || eyebrow || action ? (
        <div className="mb-3 flex flex-wrap items-baseline gap-3">
          {title ? <h5 className="m-0">{title}</h5> : null}
          {eyebrow ? (
            <span className="eyebrow text-muted">{eyebrow}</span>
          ) : null}
          {action ? <div className="ml-auto">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </Card>
  );
}

/** A tinted inset tile for the mini stats inside a panel. */
export function InsetTile({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="tile-inset">
      <div className="eyebrow text-muted">{label}</div>
      <div className="num mt-[3px] text-2xl">{value}</div>
    </div>
  );
}
