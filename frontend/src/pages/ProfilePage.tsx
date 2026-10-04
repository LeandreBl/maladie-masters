import { useState } from "react";
import { ApiError, api } from "../api/client";
import { LOCALES } from "../api/types";
import { useAuth, useMe, useUser } from "../auth/AuthProvider";
import { logout } from "../auth/firebase";
import { DiscordSection } from "../components/DiscordSection";
import { DICTIONARIES } from "../i18n/dictionaries";
import { useI18n } from "../i18n/I18nProvider";
import { formatNumber, initialOf, intlLocale } from "../lib/format";
import { useTheme, type Theme } from "../theme/ThemeProvider";

const SWATCHES: Record<Theme, [string, string]> = {
  light: ["#f8f6f6", "#cfc9ca"],
  dark: ["#1c1a1b", "#4a4547"],
};

/** The account settings: name, language, theme, SFW mode, Discord, plus the player's numbers. */
export function ProfilePage() {
  const user = useUser();
  const me = useMe();
  const { refresh } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(me.displayName ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sfwBusy, setSfwBusy] = useState(false);
  const [sfwError, setSfwError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      await api.updateMe(user, { displayName: name.trim() });
      await refresh();
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? (caught.code && t.errors[caught.code]) || caught.message : String(caught));
    }
  }

  async function toggleSfw() {
    setSfwError(null);
    setSfwBusy(true);
    try {
      await api.updateMe(user, { sfw: !me.sfw });
      await refresh();
    } catch (caught) {
      setSfwError(caught instanceof ApiError ? (caught.code && t.errors[caught.code]) || caught.message : String(caught));
    } finally {
      setSfwBusy(false);
    }
  }

  const stats: Array<[string, string]> = [
    [t.profile.distinct, formatNumber(me.collection.uniqueOwned, locale)],
    [t.profile.copies, formatNumber(me.collection.totalCopies, locale)],
    [t.profile.shiny, formatNumber(me.collection.shinyOwned, locale)],
    [t.profile.score, formatNumber(me.collection.score, locale)],
    [t.profile.familyBonus, formatNumber(me.collection.familyBonus, locale)],
    [t.profile.memberSince, new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" }).format(new Date(me.createdAt))],
  ];

  return (
    <main className="page page--profile">
      <h1 className="h1" style={{ marginBottom: 4 }}>
        {t.nav.profile}
      </h1>

      <section className="panel profile-card identity">
        <span className="identity-avatar">{initialOf(me.displayName ?? me.email)}</span>
        <form
          className="identity-fields"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="overline" htmlFor="display-name">
            {t.profile.displayName}
          </label>
          <div className="row">
            <input
              id="display-name"
              className="input"
              value={name}
              maxLength={40}
              onChange={(event) => {
                setName(event.target.value);
                setSaved(false);
              }}
            />
            <button type="submit" className="btn btn-accent">
              {saved ? t.profile.saved : t.profile.save}
            </button>
          </div>
          <span className="muted">{me.email}</span>
          {error ? <span className="error">{error}</span> : null}
        </form>
      </section>

      <section className="panel profile-card">
        <span className="overline">{t.language}</span>
        <div className="options">
          {LOCALES.map((option) => (
            <button
              key={option}
              type="button"
              className={option === locale ? "option on" : "option"}
              aria-pressed={option === locale}
              lang={option === "zh" ? "zh-CN" : option}
              onClick={() => void setLocale(option)}
            >
              <strong>{DICTIONARIES[option].languageName}</strong>
              <span className="mono">{option.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel profile-card">
        <span className="overline">{t.profile.theme}</span>
        <div className="options">
          {(["light", "dark"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={option === theme ? "option option--theme on" : "option option--theme"}
              aria-pressed={option === theme}
              onClick={() => setTheme(option)}
            >
              <span className="swatch" style={{ background: SWATCHES[option][0] }}>
                <span />
                <span style={{ background: SWATCHES[option][1] }} />
              </span>
              <strong>{option === "light" ? t.profile.light : t.profile.dark}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="panel profile-card">
        <span className="overline">{t.profile.sfw}</span>
        <button
          type="button"
          className="switch-row"
          role="switch"
          aria-checked={me.sfw}
          disabled={sfwBusy}
          onClick={() => void toggleSfw()}
        >
          <span className={me.sfw ? "switch on" : "switch"} />
          {t.profile.sfwSwitch}
        </button>
        <span className="muted">{t.profile.sfwHint}</span>
        {sfwError ? <span className="error">{sfwError}</span> : null}
      </section>

      <DiscordSection />

      <section className="stats">
        {stats.map(([label, value]) => (
          <div key={label} className="panel stat">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <button type="button" className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={() => void logout()}>
        {t.signOut}
      </button>
    </main>
  );
}
