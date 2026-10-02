import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { LOCALES, type Locale } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { DICTIONARIES, type Dictionary } from "./dictionaries";

const I18nContext = createContext<{
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => Promise<void>;
} | null>(null);

function browserLocale(): Locale {
  const language = navigator.language.toLowerCase();
  return LOCALES.find((locale) => language.startsWith(locale)) ?? "en";
}

/**
 * The interface language is the account's: card names and articles come from
 * the backend in that same language, so the two can never disagree. Before
 * sign-in, the browser's language stands in.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { user, me, refresh } = useAuth();
  const [pending, setPending] = useState<Locale | null>(null);
  const locale = pending ?? me?.locale ?? browserLocale();

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  }, [locale]);

  const setLocale = useCallback(
    async (next: Locale) => {
      setPending(next);
      try {
        if (user) {
          await api.updateMe(user, { locale: next });
          await refresh();
        }
      } finally {
        // Signed out, the choice only lasts for this visit.
        if (user) setPending(null);
      }
    },
    [user, refresh],
  );

  const value = useMemo(() => ({ locale, t: DICTIONARIES[locale], setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n outside I18nProvider");
  return context;
}

/** FR / EN / 中文, as a segmented control. */
export function LanguageSwitch({ large }: { large?: boolean }) {
  const { locale, t, setLocale } = useI18n();
  return (
    <div className={large ? "seg seg--lg" : "seg"} role="group" aria-label={t.language} title={t.language}>
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          className={option === locale ? "on" : undefined}
          aria-pressed={option === locale}
          lang={option === "zh" ? "zh-CN" : option}
          title={DICTIONARIES[option].languageName}
          onClick={() => void setLocale(option)}
        >
          {option === "zh" ? "中文" : option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
