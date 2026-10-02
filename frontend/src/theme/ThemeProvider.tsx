import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider";

export type Theme = "light" | "dark";

const STORAGE_KEY = "mm-theme";

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void; toggle: () => void } | null>(
  null,
);

/** The saved choice, else the system's. `index.html` applies the same rule before the first paint. */
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage blocked: fall through to the system preference.
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/**
 * Light or dark, per browser rather than per account. Every colour is a CSS
 * custom property switched by `html[data-mm-theme]`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.mmTheme = theme;
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not saved: the choice lasts for this visit.
    }
  }, []);

  const toggle = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme outside ThemeProvider");
  return context;
}

export function ThemeToggle({ large }: { large?: boolean }) {
  const { toggle } = useTheme();
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={large ? "theme-toggle theme-toggle--lg" : "theme-toggle"}
      title={t.profile.theme}
      aria-label={t.profile.theme}
      onClick={toggle}
    >
      <span />
    </button>
  );
}
