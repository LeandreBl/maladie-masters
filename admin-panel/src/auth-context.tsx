import { onAuthStateChanged, type User } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { auth, firebaseConfigured } from "./firebase";
import { useT } from "./i18n";
import { ApiError, adminApi, type Me } from "./lib/api";
import { useToasts } from "./toast-context";

/**
 * The panel tells the refusals apart, because each needs a different screen
 * and mistaking one for another sends the operator in a loop:
 *  - `anonymous` — no Firebase session: show the sign-in card;
 *  - `denied` — signed in, not an admin: say so, keep the session;
 *  - `suspended` — the account was suspended.
 * Anything else is `error`, which offers a retry.
 */
export type AdminSessionStatus =
  | "loading"
  | "anonymous"
  | "ready"
  | "denied"
  | "suspended"
  | "error";

const AuthContext = createContext<{
  firebaseUser: User | null;
  admin: Me | null;
  status: AdminSessionStatus;
  /** Set when the backend refused the account, to show its reason. */
  refusal: string | null;
  reload: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const { showError } = useToasts();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!firebaseConfigured);
  const [admin, setAdmin] = useState<Me | null>(null);
  const [status, setStatus] = useState<AdminSessionStatus>("loading");
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
  }, []);

  const load = useCallback(
    async (user: User | null) => {
      setRefusal(null);
      if (!user) {
        setAdmin(null);
        setStatus("anonymous");
        return;
      }

      setStatus("loading");
      try {
        const me = await adminApi.me(user);
        setAdmin(me.role === "ADMIN" ? me : null);
        setStatus(me.role === "ADMIN" ? "ready" : "denied");
      } catch (error) {
        setAdmin(null);
        if (error instanceof ApiError && error.isForbidden) {
          setRefusal(error.code ?? null);
          setStatus(error.isSuspended ? "suspended" : "denied");
          return;
        }
        setStatus("error");
        showError(error, t.common.loadError);
      }
    },
    [showError, t],
  );

  useEffect(() => {
    if (!authReady) return;
    void load(firebaseUser);
  }, [authReady, firebaseUser, load]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        admin,
        status: authReady ? status : "loading",
        refusal,
        reload: () => load(firebaseUser),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAdminSession() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAdminSession outside an AuthProvider");
  }
  return context;
}

/**
 * The Firebase user, guaranteed non-null: the back-office views are only
 * mounted once the admin session is established.
 */
export function useAuthedUser(): User {
  const { firebaseUser } = useAdminSession();
  if (!firebaseUser) {
    throw new Error("Admin view mounted without a session");
  }
  return firebaseUser;
}
