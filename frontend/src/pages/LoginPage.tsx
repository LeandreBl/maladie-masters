import { useState } from "react";
import { RARITIES_DESC } from "../api/types";
import { isFirebaseConfigured, signInWithGoogle } from "../auth/firebase";
import { CardFace } from "../components/CardTile";
import { LanguageSwitch, useI18n } from "../i18n/I18nProvider";
import { demoCard } from "../lib/demo-cards";
import { ThemeToggle } from "../theme/ThemeProvider";

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
            <button
              type="button"
              className="btn btn-accent btn-google"
              onClick={() => signInWithGoogle().catch((caught: Error) => setError(caught.message))}
            >
              <span className="g">G</span>
              {t.signInWithGoogle}
            </button>
          ) : (
            <p className="error">{t.firebaseMissing}</p>
          )}
          {error ? <p className="error">{error}</p> : null}
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
