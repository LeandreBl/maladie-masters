import { useState } from "react";
import { Brand } from "../components/Brand";
import { Button } from "../components/ui/Button";
import { CheckboxField, TextField } from "../components/ui/Field";
import { LocaleToggle } from "../components/ui/LocaleToggle";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import {
  firebaseConfigured,
  sendPasswordReset,
  signInWithGoogle,
  signInWithPassword,
} from "../firebase";
import { useT } from "../i18n";
import { useToasts } from "../toast-context";

type Busy = "google" | "password" | "reset" | null;

/** Admin sign-in: Google or email/password through Firebase. */
export function LoginView() {
  const t = useT();
  const { showError, showSuccess } = useToasts();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [busy, setBusy] = useState<Busy>(null);

  async function run(kind: Busy, action: () => Promise<unknown>) {
    setBusy(kind);
    try {
      await action();
      // PanelRoutes moves on as soon as the admin session is ready.
    } catch (error) {
      showError(error, t.login.failed);
    } finally {
      setBusy(null);
    }
  }

  async function requestReset() {
    if (email.trim() === "") {
      showError(null, t.login.forgotNeedsEmail);
      return;
    }
    await run("reset", async () => {
      await sendPasswordReset(email);
      showSuccess(t.login.forgotSent(email.trim()));
    });
  }

  const locked = busy !== null || !firebaseConfigured;

  return (
    <main className="login-ground grid min-h-screen place-items-center p-10">
      <div className="w-full max-w-[390px]">
        <section className="card elev-lg gap-0 p-[34px_30px_30px]">
          <div className="mb-[26px] flex items-center gap-[10px]">
            <Brand size={30} />
            <span className="eyebrow ml-auto text-muted">{t.common.admin}</span>
          </div>

          <h3 className="mb-1">{t.login.title}</h3>
          <p className="mb-5 text-[13px] text-muted">{t.login.subtitle}</p>

          {firebaseConfigured ? null : (
            <p className="mb-5 rounded-md bg-accent-200 p-3 text-[13px] text-accent-900">
              {t.login.notConfigured}
            </p>
          )}

          <Button
            className="mb-[18px] min-h-[40px] justify-start gap-[11px] pl-[11px]"
            loading={busy === "google"}
            disabled={locked}
            onClick={() => void run("google", () => signInWithGoogle(keepSignedIn))}
          >
            {busy === "google" ? null : (
              <span
                aria-hidden="true"
                className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-neutral-200 text-[11px] font-semibold"
              >
                G
              </span>
            )}
            {t.login.withGoogle}
          </Button>

          <div className="mb-[18px] flex items-center gap-[10px]">
            <span className="h-px flex-1 bg-divider" />
            <span className="eyebrow text-muted">{t.login.orEmail}</span>
            <span className="h-px flex-1 bg-divider" />
          </div>

          <form
            className="grid gap-[14px]"
            onSubmit={(event) => {
              event.preventDefault();
              void run("password", () => signInWithPassword(email, password, keepSignedIn));
            }}
          >
            <TextField
              label={t.login.email}
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="username"
              required
            />
            <TextField
              label={t.login.password}
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              required
            />
            <CheckboxField
              className="text-[13px]"
              label={t.login.keepSigned}
              checked={keepSignedIn}
              onChange={setKeepSignedIn}
            />
            <Button
              type="submit"
              variant="primary"
              className="btn-block min-h-[38px]"
              loading={busy === "password"}
              disabled={locked || email === "" || password === ""}
            >
              {t.login.submit}
            </Button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
            <button
              type="button"
              className="text-[13px] text-accent-700 hover:text-accent disabled:opacity-45"
              disabled={busy !== null}
              onClick={() => void requestReset()}
            >
              {t.login.forgot}
            </button>
            <div className="flex items-center gap-2">
              <LocaleToggle />
              <ThemeToggle />
            </div>
          </div>
        </section>

        <p className="eyebrow mb-0 mt-4 text-center text-muted">{t.login.restricted}</p>
      </div>
    </main>
  );
}
