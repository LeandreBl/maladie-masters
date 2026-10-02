import { useLocale, useT } from "../i18n";
import type { Locale } from "../lib/api";
import { Tag } from "./ui/Tag";

/** The languages a disease has an article in, the panel's own first. */
export function LanguageTags({ languages }: { languages: Locale[] }) {
  return (
    <span className="flex gap-1">
      {languages.map((language) => (
        <Tag key={language} tone="outline">
          {language.toUpperCase()}
        </Tag>
      ))}
    </span>
  );
}

/**
 * Says so when a card came back in another language than the panel's: the
 * disease has no article in it, and the backend fell back to English.
 */
export function FallbackHint({ lang }: { lang: Locale }) {
  const t = useT();
  const { locale } = useLocale();
  if (lang === locale) return null;
  return (
    <span className="text-[11px] text-muted" title={t.common.shownIn(t.common.languageNames[lang] ?? lang)}>
      ({lang.toUpperCase()})
    </span>
  );
}
