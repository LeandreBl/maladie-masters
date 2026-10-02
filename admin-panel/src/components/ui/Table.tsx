import type { ReactNode } from "react";
import { useT } from "../../i18n";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";

export type Column<T> = {
  /** Rendered in the header. Use "" for an action or chevron column. */
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Right-align a numeric or action column. */
  align?: "left" | "right";
  className?: string;
};

/**
 * A real `<table>` under the design system's `.table`, inside a horizontal
 * scroller: wide content scrolls within its own panel instead of pushing the
 * page sideways.
 *
 * Loading, failure and empty are states of the table rather than of the page,
 * so a reload never blanks the layout around it. Loading draws the rows it is
 * about to have rather than a spinner: the panel keeps its height, and the
 * operator reads the shape of the answer while it arrives.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading = false,
  failed = false,
  onRetry,
  emptyLabel,
  footer,
  className,
  skeletonRows = 5,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  emptyLabel?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** How many placeholder rows to draw while loading. */
  skeletonRows?: number;
}) {
  const t = useT();

  return (
    <div className={className}>
      <div className="table-scroll">
        <table className="table" aria-busy={loading || undefined}>
          {/* The placeholder rows are decoration; this is what says, once,
              that the table is still filling. */}
          {loading ? (
            <caption className="sr-only">{t.common.loading}</caption>
          ) : null}
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={cn(column.align === "right" && "text-right")}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows columns={columns} count={skeletonRows} />
            ) : failed ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-muted">
                  <span className="flex flex-wrap items-center gap-3">
                    {t.common.loadError}
                    {onRetry ? (
                      <Button onClick={onRetry}>{t.common.retry}</Button>
                    ) : null}
                  </span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-muted">
                  {emptyLabel ?? t.common.noResults}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={cn(onRowClick && "row-link")}
                  {...(onRowClick
                    ? {
                        onClick: () => onRowClick(row),
                        tabIndex: 0,
                        role: "link",
                        onKeyDown: (event: React.KeyboardEvent) => {
                          // A clickable row must answer the keyboard too.
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        },
                      }
                    : {})}
                >
                  {columns.map((column, index) => (
                    <td
                      key={index}
                      className={cn(
                        column.align === "right" && "text-right",
                        column.className,
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}

/**
 * The rows a table draws while it loads.
 *
 * Widths cycle through a fixed set keyed on the cell's position, so the run
 * looks like text rather than a stack of identical bars — and stays put across
 * re-renders, which a random width would not.
 */
const SKELETON_WIDTHS = ["72%", "44%", "58%", "34%", "80%", "50%", "64%"];

function SkeletonRows<T>({
  columns,
  count,
}: {
  columns: Column<T>[];
  count: number;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, row) => (
        <tr key={row}>
          {columns.map((column, index) => (
            <td
              key={index}
              className={cn(column.align === "right" && "text-right")}
            >
              <Skeleton
                // The box is a `td`'s own line height, so a loading table is
                // exactly as tall as the one that replaces it.
                box={22}
                className={cn("h-[11px]", column.align === "right" && "ml-auto")}
                style={{
                  width:
                    // An action or chevron column has no header to size to.
                    column.header === ""
                      ? "18px"
                      : SKELETON_WIDTHS[
                          (row * columns.length + index) %
                            SKELETON_WIDTHS.length
                        ],
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
