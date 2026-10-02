import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ToastViewport } from "./components/ToastViewport";
import { translateError, useT } from "./i18n";

export type Toast = {
  id: number;
  message: string;
  variant: "error" | "success";
};

const ToastContext = createContext<{
  showError: (error: unknown, fallback: string) => void;
  showSuccess: (message: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: Toast["variant"], ttl: number) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), ttl);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      // Errors linger: they usually carry something to act on.
      showError: (error: unknown, fallback: string) =>
        push(translateError(error, fallback, t), "error", 7000),
      showSuccess: (message: string) => push(message, "success", 3500),
    }),
    [push, t],
  );

  return (
    <ToastContext.Provider value={value}>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      {children}
    </ToastContext.Provider>
  );
}

export function useToasts() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToasts outside a ToastProvider");
  }
  return context;
}
