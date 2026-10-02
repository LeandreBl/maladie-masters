import { Navigate, Route, Routes } from "react-router-dom";
import { useAdminSession, type AdminSessionStatus } from "../auth-context";
import { Brand } from "../components/Brand";
import { Button } from "../components/ui/Button";
import { LocaleToggle } from "../components/ui/LocaleToggle";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { logout } from "../firebase";
import { useT } from "../i18n";
import { LoginView } from "../views/LoginView";
import { AdminRoutes } from "./AdminRoutes";

/**
 * The entrance. Every outcome is an explicit screen — sign-in, the panel, or a
 * named refusal — so a rejected account can never loop between two of them.
 */
export function PanelRoutes() {
  const { status, admin } = useAdminSession();
  const t = useT();

  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-bg text-sm text-muted">
        {t.common.loading}
      </div>
    );
  }

  if (status === "anonymous") {
    return (
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (status !== "ready" || !admin) {
    return <Refused status={status} />;
  }

  return (
    <Routes>
      <Route path="/admin/*" element={<AdminRoutes admin={admin} />} />
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}

function Refused({ status }: { status: AdminSessionStatus }) {
  const t = useT();
  const { firebaseUser, reload, refusal } = useAdminSession();

  const copy: Record<string, { title: string; description: string }> = {
    denied: {
      title: t.denied.title,
      description:
        refusal === "EMAIL_NOT_VERIFIED" ? t.denied.emailNotVerified : t.denied.description,
    },
    suspended: {
      title: t.denied.suspendedTitle,
      description: t.denied.suspendedDescription,
    },
    error: { title: t.common.loadError, description: "" },
  };
  const { title, description } = copy[status] ?? copy.error;

  return (
    <main className="login-ground grid min-h-screen place-items-center p-10">
      <section className="card elev-lg w-full max-w-[420px] gap-0 p-[30px]">
        <div className="mb-5 flex items-center gap-3">
          <Brand size={28} />
          <div className="ml-auto flex items-center gap-2">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>

        <h3 className="mb-2">{title}</h3>
        {description ? <p className="mb-0 text-sm text-muted">{description}</p> : null}

        {firebaseUser?.email ? (
          <p className="mb-0 mt-4 text-sm">
            {t.denied.signedInAs} <span className="font-medium">{firebaseUser.email}</span>
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          {status === "error" ? (
            <Button variant="primary" onClick={() => void reload()}>
              {t.common.retry}
            </Button>
          ) : null}
          <Button onClick={() => void logout()}>{t.common.signOut}</Button>
        </div>
      </section>
    </main>
  );
}
