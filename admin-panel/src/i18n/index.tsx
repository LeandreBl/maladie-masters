import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en } from "./en";
import { fr } from "./fr";
import { zh } from "./zh";
import { setApiLocale } from "../lib/api";

export type Locale = "fr" | "en" | "zh";

export const LOCALES: Locale[] = ["fr", "en", "zh"];

/**
 * The French dictionary defines the shape; every other locale satisfies it.
 * A missing key is a compile error, not a blank label at runtime.
 */
export type Dictionary = typeof fr;

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en, zh };

/** BCP 47 tags for `Intl`. */
const INTL_LOCALES: Record<Locale, string> = { fr: "fr-FR", en: "en-GB", zh: "zh-CN" };

const STORAGE_KEY = "maladie-admin-locale";

/** Locale the browser asks for, when the operator has no stored preference. */
function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en" || stored === "zh") return stored;
  } catch {
    // Blocked storage: fall through to the browser's own preference.
  }
  const browser = navigator.language.toLowerCase();
  if (browser.startsWith("zh")) return "zh";
  if (browser.startsWith("fr")) return "fr";
  return "en";
}

const LocaleContext = createContext<{
  locale: Locale;
  /** BCP 47 tag for `Intl`: French formats 41 714 €, English £/$-style. */
  intlLocale: string;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
} | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    const initial = initialLocale();
    // Set before the first render, so the first requests already carry it.
    setApiLocale(initial);
    return initial;
  });

  useEffect(() => {
    // Card names and articles follow the panel's language.
    setApiLocale(locale);
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Blocked storage: the choice still applies for this session.
    }
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      intlLocale: INTL_LOCALES[locale],
      t: DICTIONARIES[locale],
      setLocale,
    }),
    [locale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

function useLocaleContext() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale outside a LocaleProvider");
  }
  return context;
}

export function useLocale() {
  const { locale, intlLocale, setLocale } = useLocaleContext();
  return { locale, intlLocale, setLocale };
}

/** The dictionary for the current locale. */
export function useT(): Dictionary {
  return useLocaleContext().t;
}

/**
 * A readable message for an API error: the panel's translation of the business
 * code first, then the server's own message, then the caller's fallback.
 *
 * The code wins because the API speaks English and the operator may not: a
 * stable `error` code is the contract, the English text is only a fallback for
 * codes the panel has no wording for.
 */
export function translateError(
  error: unknown,
  fallback: string,
  dictionary: Dictionary,
): string {
  if (error && typeof error === "object") {
    const candidate = error as {
      code?: string;
      serverMessage?: string;
      message?: string;
    };
    // The panel's own translation first: the API answers in English (the whole
    // codebase does), and the operator may be reading in French. The server
    // message is the fallback for codes the panel has no wording for — it is
    // still more specific than a generic failure line.
    if (candidate.code && dictionary.errors[candidate.code]) {
      return dictionary.errors[candidate.code];
    }
    if (candidate.serverMessage) return candidate.serverMessage;
    if (candidate.message) return candidate.message;
  }
  return fallback;
}

/** Label for an audit action, falling back to the raw machine name. */
export function useAuditLabel() {
  const t = useT();
  return useCallback(
    (action: string) => t.audit[action] ?? action,
    [t],
  );
}
