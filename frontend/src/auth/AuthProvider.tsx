import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError, api } from "../api/client";
import type { Me, PackWallet } from "../api/types";
import { firebaseAuth, isFirebaseConfigured } from "./firebase";

type AuthState = {
  user: User | null;
  me: Me | null;
  ready: boolean;
  error: string | null;
  /** The backend's code for `error`, for the interface to translate. */
  errorCode: string | null;
  refresh: () => Promise<void>;
  /**
   * Replaces the wallet alone. Safe during a pack reveal, unlike `refresh`,
   * whose collection counters would give the cards away.
   */
  setWallet: (wallet: PackWallet) => void;
};

const AuthContext = createContext<AuthState | null>(null);

/** Firebase session plus the player profile, which `GET /v1/me` creates on first call. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(!isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(firebaseAuth, (next) => {
      setUser(next);
      if (!next) {
        setMe(null);
        setReady(true);
      }
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setMe(await api.me(user));
      setError(null);
      setErrorCode(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setErrorCode(caught instanceof ApiError ? (caught.code ?? null) : null);
    } finally {
      setReady(true);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setWallet = useCallback((wallet: PackWallet) => {
    setMe((current) => (current ? { ...current, packs: wallet } : current));
  }, []);

  return (
    <AuthContext.Provider value={{ user, me, ready, error, errorCode, refresh, setWallet }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth outside AuthProvider");
  return context;
}

/** The signed-in Firebase user; only used under the authenticated routes. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("No signed-in user");
  return user;
}

/** The player's profile; only used under the authenticated routes, which wait for it. */
export function useMe(): Me {
  const { me } = useAuth();
  if (!me) throw new Error("No player profile");
  return me;
}
