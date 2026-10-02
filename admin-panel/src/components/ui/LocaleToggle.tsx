import { useLocale, type Locale } from "../../i18n";
import { Seg } from "./Seg";

/** The header's EN/FR/中文 control. Applies immediately, everywhere — card data included. */
export function LocaleToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <Seg
      ariaLabel="Language"
      className="flex-none"
      value={locale}
      onChange={setLocale}
      options={[
        { value: "en" as Locale, label: "EN" },
        { value: "fr" as Locale, label: "FR" },
        { value: "zh" as Locale, label: "中文" },
      ]}
    />
  );
}

/** The settings screen's full-name variant. */
export function LocaleSeg() {
  const { locale, setLocale } = useLocale();

  return (
    <Seg
      value={locale}
      onChange={setLocale}
      options={[
        { value: "en" as Locale, label: "English" },
        { value: "fr" as Locale, label: "Français" },
        { value: "zh" as Locale, label: "中文" },
      ]}
    />
  );
}
