import { useEffect } from "react";
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./api/client";
import type { PackWallet } from "./api/types";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { logout } from "./auth/firebase";
import { I18nProvider, LanguageSwitch, useI18n } from "./i18n/I18nProvider";
import { clock, initialOf } from "./lib/format";
import { useServerOffset, useTimeToNextPack } from "./lib/hooks";
import { CollectionPage } from "./pages/CollectionPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { LoginPage } from "./pages/LoginPage";
import { PacksPage } from "./pages/PacksPage";
import { ProfilePage } from "./pages/ProfilePage";
import { Notices } from "./components/Notices";
import { RealtimeProvider } from "./realtime/RealtimeProvider";
import { ThemeProvider, ThemeToggle } from "./theme/ThemeProvider";

/**
 * Re-reads the wallet when the next pack is due. The timer is computed by the
 * backend at read time: nothing is pushed when a pack comes in.
 */
function useWalletClock(wallet: PackWallet | undefined, setWallet: (wallet: PackWallet) => void) {
  const { user } = useAuth();
  const offset = useServerOffset(wallet?.serverTime);
  const due = wallet?.nextPackAt;

  useEffect(() => {
    if (!user || !due) return;
    // A little after the due time, so the server agrees the pack is there.
    const delay = Math.max(0, new Date(due).getTime() - (Date.now() + offset)) + 500;
    const timer = window.setTimeout(() => {
      void api.wallet(user).then(setWallet).catch(() => undefined);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [user, due, offset, setWallet]);
}

function PackChip({ wallet }: { wallet: PackWallet }) {
  const left = useTimeToNextPack(wallet);
  return (
    <Link to="/" className="pack-chip">
      <strong>{wallet.available}</strong>
      {left !== null ? <span className="mono">{clock(left)}</span> : null}
    </Link>
  );
}

function Header() {
  const { me } = useAuth();
  const { t } = useI18n();
  const { pathname } = useLocation();
  if (!me) return null;

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="logo">
          {t.appName}
        </Link>
        <nav>
          <NavLink to="/" end>
            {t.nav.packs}
          </NavLink>
          <NavLink to="/collection">{t.nav.collection}</NavLink>
          <NavLink to="/historique">{t.nav.history}</NavLink>
          <NavLink to="/classement">{t.nav.leaderboard}</NavLink>
        </nav>
        <div className="topbar-right">
          <PackChip wallet={me.packs} />
          <LanguageSwitch />
          <ThemeToggle />
          <Link
            to="/profil"
            className={pathname === "/profil" ? "avatar-btn active" : "avatar-btn"}
            title={t.nav.profile}
            aria-label={t.nav.profile}
          >
            {initialOf(me.displayName ?? me.email)}
          </Link>
          <button type="button" className="signout" onClick={() => void logout()}>
            {t.signOut}
          </button>
        </div>
      </div>
    </header>
  );
}

function Shell() {
  const { user, me, ready, error, errorCode, setWallet } = useAuth();
  const { t } = useI18n();
  useWalletClock(me?.packs, setWallet);

  if (!ready) return <main className="centered muted">{t.loading}</main>;
  if (!user) return <LoginPage />;
  if (error && !me) {
    // EMPTY_CATALOG, ACCOUNT_SUSPENDED, EMAIL_NOT_VERIFIED…
    return (
      <main className="centered">
        <p>{(errorCode && t.errors[errorCode]) || error}</p>
        <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
          {t.signOut}
        </button>
      </main>
    );
  }
  if (!me) return <main className="centered muted">{t.loading}</main>;

  return (
    <>
      <Header />
      <Notices />
      <Routes>
        <Route path="/" element={<PacksPage />} />
        <Route path="/collection" element={<CollectionPage />} />
        <Route path="/historique" element={<HistoryPage />} />
        <Route path="/classement" element={<LeaderboardPage />} />
        <Route path="/profil" element={<ProfilePage />} />
        {/* Discord used to have its own page: it is now a section of the profile. */}
        <Route path="/discord" element={<Navigate to="/profil" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <I18nProvider>
          <RealtimeProvider>
            <BrowserRouter>
              <Shell />
            </BrowserRouter>
          </RealtimeProvider>
        </I18nProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
