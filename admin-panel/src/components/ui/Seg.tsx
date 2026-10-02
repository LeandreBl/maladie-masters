import { useId } from "react";
import { cn } from "../../lib/utils";
import { Skeleton } from "./Skeleton";

export type SegOption<T extends string | number> = {
  value: T;
  label: string;
  /**
   * A count rendered after the label, as the users filter tabs do.
   *
   * `null` is a count that has not arrived yet: it holds its own width with a
   * placeholder, so the tab row does not reflow the moment the page lands.
   * `undefined` is a tab that has no count at all.
   */
  count?: number | null;
};

/**
 * `.seg` — the segmented control the design uses for every exclusive choice:
 * ranges, filters, language, theme, plan duration.
 *
 * Built on native radios inside labels, so the whole group is one tab stop
 * with arrow-key navigation and the checked state comes from `:has()`.
 */
export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  wrap = false,
  disabled,
  className,
  ariaLabel,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  wrap?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const name = useId();

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("seg", wrap && "seg-wrap", className)}
    >
      {options.map((option) => (
        <label key={String(option.value)} className="seg-opt">
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => onChange(option.value)}
          />
          {option.label}
          {option.count === undefined ? null : option.count === null ? (
            <Skeleton className="h-[10px] w-[18px] rounded-full" />
          ) : (
            <span className="opacity-60">{option.count}</span>
          )}
        </label>
      ))}
    </div>
  );
}
