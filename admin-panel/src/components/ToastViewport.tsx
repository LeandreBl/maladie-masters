import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import { useT } from "../i18n";
import type { Toast } from "../toast-context";

/**
 * Toasts, tinted from the accent ramps rather than a red/green pair from
 * outside the system: `accent-100` for a success, the deeper `accent-200` for
 * an error. Both read in either theme, and the icon carries the distinction.
 */
export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  const t = useT();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const isError = toast.variant === "error";
        const Icon = isError ? TriangleAlert : CheckCircle2;

        return (
          <div
            key={toast.id}
            className="card elev-lg flex-row items-start gap-2 p-3 text-sm"
            style={{
              background: isError
                ? "var(--color-accent-200)"
                : "var(--color-accent-2-100)",
              color: isError
                ? "var(--color-accent-900)"
                : "var(--color-accent-2-800)",
            }}
          >
            <Icon className="mt-[2px] size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 break-words">{toast.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded-full p-[2px] opacity-70 transition hover:opacity-100"
              aria-label={t.common.close}
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
