import { useState } from "react";
import { authErrorText, logout, reloadVerification, resendVerification, setAuthLanguage } from "../auth/firebase";
import { useAuth, useUser } from "../auth/AuthProvider";
import { useI18n } from "../i18n/I18nProvider";

/**
 * Shown when the backend answers EMAIL_NOT_VERIFIED: an email/password account
 * whose link has not been clicked yet. The player confirms here once done.
 */
export function VerifyEmail() {
  const user = useUser();
  const { refresh } = useAuth();
  const { t, locale } = useI18n();
  const copy = t.emailAuth;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action());
    } catch (caught) {
      setMessage(authErrorText(caught, copy.errors));
    } finally {
      setBusy(false);
    }
  };

  const onDone = () =>
    run(async () => {
      if (!(await reloadVerification(user))) return copy.verifyStill;
      await refresh();
      return null;
    });

  const onResend = () =>
    run(async () => {
      setAuthLanguage(locale);
      await resendVerification(user);
      return copy.verifyResent;
    });

  return (
    <main className="centered verify-email">
      <h1>{copy.verifyTitle}</h1>
      <p>{copy.verifyBody(user.email ?? "")}</p>
      <div className="actions">
        <button type="button" className="btn btn-accent" onClick={() => void onDone()} disabled={busy}>
          {copy.verifyDone}
        </button>
        <button type="button" className="btn btn-soft" onClick={() => void onResend()} disabled={busy}>
          {copy.verifyResend}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
          {t.signOut}
        </button>
      </div>
      {message ? <p className="muted">{message}</p> : null}
    </main>
  );
}
