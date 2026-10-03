import { useState, type FormEvent } from "react";
import { RARITIES_DESC } from "../api/types";
import {
  authErrorText,
  isFirebaseConfigured,
  resetPassword,
  setAuthLanguage,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "../auth/firebase";
import { CardFace } from "../components/CardTile";
import { LanguageSwitch, useI18n } from "../i18n/I18nProvider";
import { demoCard } from "../lib/demo-cards";
import { ThemeToggle } from "../theme/ThemeProvider";

function EmailForm() {
  const { t, locale } = useI18n();
  const copy = t.emailAuth;
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    setAuthLanguage(locale);
    try {
      await action();
      if (success) setNotice(success);
    } catch (caught) {
      setError(authErrorText(caught, copy.errors));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(() => (mode === "signIn" ? signInWithEmail(email, password) : signUpWithEmail(email, password)));
  };

  const onForgot = () => {
    if (!email) {
      setError(copy.emailFirst);
      return;
    }
    // Same answer whether the account exists or not: no address enumeration.
    void run(() => resetPassword(email).catch(() => undefined), copy.resetSent);
  };

  return (
    <form className="email-form" onSubmit={onSubmit}>
      <input
        className="input"
        type="email"
        autoComplete="email"
        placeholder={copy.email}
        aria-label={copy.email}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <input
        className="input"
        type="password"
        autoComplete={mode === "signIn" ? "current-password" : "new-password"}
        placeholder={copy.password}
        aria-label={copy.password}
        minLength={6}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      <button type="submit" className="btn btn-inverse" disabled={busy}>
        {mode === "signIn" ? copy.signIn : copy.signUp}
      </button>
      <div className="email-form-links">
        <button type="button" className="link-btn" onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
          {mode === "signIn" ? copy.toSignUp : copy.toSignIn}
        </button>
        {mode === "signIn" ? (
          <button type="button" className="link-btn" onClick={onForgot} disabled={busy}>
            {copy.forgot}
          </button>
        ) : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="muted">{notice}</p> : null}
    </form>
  );
}

export function LoginPage() {
  const { t, locale } = useI18n();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="login">
      <div className="login-top">
        <span className="logo">{t.appName}</span>
        <div>
          <LanguageSwitch large />
          <ThemeToggle large />
        </div>
      </div>
      <main className="login-main">
        <div className="login-copy">
          <h1 className="login-title">{t.appName}</h1>
          <p className="login-tagline">{t.tagline}</p>
          {isFirebaseConfigured ? (
            <div className="login-auth">
              <button
                type="button"
                className="btn btn-accent btn-google"
                onClick={() =>
                  signInWithGoogle().catch((caught: { code?: string; message: string }) => {
                    // Closing the popup is a choice, not an error.
                    if (caught.code !== "auth/popup-closed-by-user") setError(caught.message);
                  })
                }
              >
                <span className="g">G</span>
                {t.signInWithGoogle}
              </button>
              {error ? <p className="error">{error}</p> : null}
              <div className="or-sep">{t.emailAuth.or}</div>
              <EmailForm />
            </div>
          ) : (
            <p className="error">{t.firebaseMissing}</p>
          )}
          <div className="chips">
            {RARITIES_DESC.map((rarity) => (
              <span key={rarity} className={`chip r-${rarity.toLowerCase()}`}>
                <span className="diamond" />
                {t.rarity[rarity]}
              </span>
            ))}
          </div>
        </div>
        <div className="login-fan" aria-hidden>
          <div className="fan-left">
            <CardFace card={demoCard("acromegaly", t, locale)} width={240} />
          </div>
          <div className="fan-right">
            <CardFace card={demoCard("marfan", t, locale)} width={240} />
          </div>
          <div className="fan-front">
            <CardFace card={demoCard("tuberculosis", t, locale)} width={290} />
          </div>
        </div>
      </main>
    </div>
  );
}
