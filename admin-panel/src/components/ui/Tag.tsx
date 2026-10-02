import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/**
 * `.tag` and its four tints. `sage` is the design's second voice — it marks
 * complimentary subscriptions and the current device, never an error.
 */
export type Tone = "accent" | "sage" | "neutral" | "outline";

const TONES: Record<Tone, string> = {
  accent: "tag-accent",
  sage: "tag-accent-2",
  neutral: "tag-neutral",
  outline: "tag-outline",
};

export function Tag({
  tone = "neutral",
  children,
  className,
  title,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  /** Native tooltip, for a tag that abbreviates what it labels. */
  title?: string;
}) {
  return (
    <span className={cn("tag", TONES[tone], className)} title={title}>
      {children}
    </span>
  );
}
