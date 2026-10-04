import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useT } from "../i18n";
import { AdminShell, ExportButton } from "../layouts/AdminShell";
import {
  PageHeadingProvider,
  usePageHeading,
  type PageHeading,
} from "../layouts/page-heading";
import type { Me } from "../lib/api";
import { AccessView } from "../views/AccessView";
import { CardsView } from "../views/CardsView";
import { DashboardView } from "../views/DashboardView";
import { FamiliesView } from "../views/FamiliesView";
import { FamilyEditorView } from "../views/FamilyEditorView";
import { SettingsView } from "../views/SettingsView";
import { SyncView } from "../views/SyncView";
import { UserDetailView } from "../views/UserDetailView";
import { UsersView } from "../views/UsersView";

export function AdminRoutes({ admin }: { admin: Me }) {
  return (
    <PageHeadingProvider>
      <AdminChrome admin={admin} />
    </PageHeadingProvider>
  );
}

/**
 * The shell wraps every route, so the rail and header do not remount as the
 * admin moves between tabs. The search box belongs to the shell but filters
 * the screen inside it, so it is only shown — and kept — on the two lists.
 */
function AdminChrome({ admin }: { admin: Me }) {
  const t = useT();
  const { pathname } = useLocation();
  const published = usePageHeading();

  const [search, setSearch] = useState("");
  const [exporter, setExporter] = useState<(() => void) | null>(null);

  const onExportReady = useCallback((next: (() => void) | null) => {
    // A function in state must be set through an updater, or React calls it.
    setExporter(() => next);
  }, []);

  const onUsersList = pathname === "/admin/users";
  const onCardsList = pathname === "/admin/cards";

  useEffect(() => {
    setSearch("");
  }, [onUsersList, onCardsList]);

  const fallback: PageHeading = useMemo(() => {
    if (pathname.startsWith("/admin/users/")) {
      return { crumb: t.crumbs.userDetail, title: t.nav.users };
    }
    if (pathname.startsWith("/admin/users")) return { crumb: t.crumbs.users, title: t.nav.users };
    if (pathname.startsWith("/admin/cards")) return { crumb: t.crumbs.cards, title: t.nav.cards };
    if (pathname.startsWith("/admin/sync")) return { crumb: t.crumbs.sync, title: t.nav.sync };
    if (pathname.startsWith("/admin/settings")) {
      return { crumb: t.crumbs.settings, title: t.nav.settings };
    }
    if (pathname.startsWith("/admin/families")) {
      return { crumb: t.crumbs.families, title: t.nav.families };
    }
    if (pathname.startsWith("/admin/access")) return { crumb: t.crumbs.access, title: t.nav.access };
    return { crumb: t.crumbs.dashboard, title: t.nav.dashboard };
  }, [pathname, t]);

  const heading = published ?? fallback;

  return (
    <AdminShell
      admin={admin}
      crumb={heading.crumb}
      title={heading.title}
      search={onUsersList || onCardsList ? search : undefined}
      searchPlaceholder={onCardsList ? t.cards.searchPlaceholder : t.users.searchPlaceholder}
      onSearchChange={onUsersList || onCardsList ? setSearch : undefined}
      actions={exporter ? <ExportButton onExport={exporter} /> : undefined}
    >
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardView />} />
        <Route
          path="users"
          element={<UsersView search={search} onExportReady={onExportReady} />}
        />
        <Route path="users/:userId" element={<UserDetailView />} />
        <Route path="cards" element={<CardsView search={search} />} />
        <Route path="sync" element={<SyncView />} />
        <Route path="settings" element={<SettingsView />} />
        <Route path="families" element={<FamiliesView />} />
        <Route path="families/new" element={<FamilyEditorView />} />
        <Route path="families/:familyId" element={<FamilyEditorView />} />
        <Route path="access" element={<AccessView />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </AdminShell>
  );
}
