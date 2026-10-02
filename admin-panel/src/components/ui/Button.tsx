import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

/**
 * The design system's `.btn`. Variants map straight onto its classes rather
 * than restating their colours, so hover, active and focus states come from
 * the accent ramp once.
 */
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    loading?: boolean;
    children: ReactNode;
  }
>(function Button(
  { variant = "secondary", loading = false, children, className, disabled, ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={rest.type ?? "button"}
      disabled={disabled || loading}
      className={cn("btn", VARIANTS[variant], className)}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      title={label}
      aria-label={label}
      // `[&>svg]:shrink-0`: the icon is a flex item, so anything that squeezes
      // the button's content box shrinks it to nothing rather than letting it
      // overflow — a blank button, which is not a failure mode anyone reads as
      // a CSS problem. Belt and braces next to `.btn-icon`'s own `padding: 0`.
      className={cn("btn btn-secondary btn-icon [&>svg]:shrink-0", className)}
    >
      {children}
    </button>
  );
}
