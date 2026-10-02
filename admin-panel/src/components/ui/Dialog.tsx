import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "../../i18n";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

/**
 * `.dialog-backdrop` + `.dialog`.
 *
 * Escape and a backdrop click close it, focus moves inside on open and the
 * page behind is locked from scrolling — none of which the design had to
 * specify, and all of which a modal is broken without.
 */
export function Dialog({
  title,
  body,
  wide = false,
  onClose,
  children,
  actions,
}: {
  title: ReactNode;
  body?: ReactNode;
  wide?: boolean;
  onClose: () => void;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // The first field, or the panel itself when the dialog is a confirmation.
    const focusable = panel.current?.querySelector<HTMLElement>(
      "input:not([type=hidden]), textarea, select, button",
    );
    focusable?.focus();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cn("dialog", wide && "dialog-wide")}
      >
        <div className="dialog-title">{title}</div>
        {body ? <div className="dialog-body">{body}</div> : null}
        {children}
        {actions ? <div className="dialog-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmIcon,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: {
  title: ReactNode;
  message: ReactNode;
  confirmLabel: string;
  /** Icon on the confirming button — the same one the row's action carried,
   * so the click that opened the dialog and the click that commits it are
   * visibly the same act. */
  confirmIcon?: ReactNode;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const t = useT();

  return (
    <Dialog
      title={title}
      body={message}
      onClose={onCancel}
      actions={
        <>
          <Button onClick={onCancel} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={busy}
            onClick={onConfirm}
          >
            {busy ? null : confirmIcon}
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
