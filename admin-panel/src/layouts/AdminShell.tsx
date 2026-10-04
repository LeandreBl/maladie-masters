import { useMemo, type ReactNode } from "react";
import {
  DatabaseZap,
  LayoutDashboard,
  Layers,
  LogOut,
  Puzzle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { Brand } from "../components/Brand";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { LocaleToggle } from "../components/ui/LocaleToggle";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { logout } from "../firebase";
import { useT } from "../i18n";
import type { Me } from "../lib/api";
import { useRealtimeStatus } from "../realtime-context";
import { playerInitials } from "../lib/display";

type NavGroup = { eyebrow: string; links: NavItem[] };
type NavItem = { to: string; label: string; icon: typeof Users };

/**
 * The 232px rail and the page header, as in the Agility Pro back office this
 * panel is ported from. MONITOR holds what changes on its own (players, the
 * catalog, the import); CONFIGURE what an admin decides.
 */
export function AdminShell({
  admin,
  crumb,
  title,
  search,
  searchPlaceholder,
  onSearchChange,
  actions,
  children,
}: {
  admin: Me;
  crumb: ReactNode;
  title: ReactNode;
  /** Omitted on the screens where the header search has nothing to filter. */
  search?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const t = useT();

  const groups: NavGroup[] = useMemo(
    () => [
      {
        eyebrow: t.common.monitor,
        links: [
          { to: "/admin/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
          { to: "/admin/users", label: t.nav.users, icon: Users },
          { to: "/admin/cards", label: t.nav.cards, icon: Layers },
          { to: "/admin/sync", label: t.nav.sync, icon: DatabaseZap },
        ],
      },
      {
        eyebrow: t.common.configure,
        links: [
          { to: "/admin/settings", label: t.nav.settings, icon: SlidersHorizontal },
          { to: "/admin/families", label: t.nav.families, icon: Puzzle },
          { to: "/admin/access", label: t.nav.access, icon: ShieldCheck },
        ],
      },
    ],
    [t],
  );

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg lg:grid-cols-[232px_1fr]">
      <aside className="rail sticky top-0 hidden h-screen flex-col gap-1 border-r border-divider p-[22px_16px] lg:flex">
        <div className="px-1 pb-5">
          <Brand size={28} />
        </div>

        {groups.map((group, index) => (
          <div key={group.eyebrow} className={index > 0 ? "mt-4" : undefined}>
            <div className="eyebrow px-[5px] pb-2 text-muted">{group.eyebrow}</div>
            <div className="flex flex-col gap-1">
              {group.links.map((link) => (
                <RailLink key={link.to} {...link} />
              ))}
            </div>
          </div>
        ))}

        <div className="mt-auto border-t border-divider pt-[18px]">
          <RealtimeIndicator />
          <button type="button" className="rail-link" onClick={() => void logout()}>
            <LogOut size={17} strokeWidth={2.75} />
            {t.common.signOut}
          </button>
        </div>
      </aside>

      <main className="min-w-0">
        {/* On a narrow viewport the rail becomes this scrolling strip. */}
        <nav className="rail flex gap-1 overflow-x-auto border-b border-divider px-4 py-2 lg:hidden">
          {groups.flatMap((group) =>
            group.links.map((link) => <RailLink key={link.to} {...link} />),
          )}
        </nav>

        <header className="flex flex-wrap items-center gap-4 border-b border-divider p-[16px_28px]">
          <div className="min-w-[200px] flex-auto">
            <div className="eyebrow text-muted">{crumb}</div>
            <h4 className="mb-0 mt-[1px]">{title}</h4>
          </div>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-[10px]">
            {onSearchChange ? (
              <div className="relative min-w-[150px] flex-[0_1_266px]">
                <Search
                  size={16}
                  strokeWidth={2.75}
                  className="pointer-events-none absolute left-[11px] top-[10px] opacity-50"
                />
                <input
                  className="input w-full min-w-0 pl-[34px]"
                  type="search"
                  placeholder={searchPlaceholder}
                  value={search ?? ""}
                  onChange={(event) => onSearchChange(event.target.value)}
                />
              </div>
            ) : null}

            <LocaleToggle />
            <ThemeToggle />
            {actions}
            <Avatar initials={playerInitials(admin)} photoUrl={admin.photoUrl} size={34} />
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

/**
 * Whether the screens update on their own. While it reconnects, they still
 * work: they just wait for the next reload.
 */
function RealtimeIndicator() {
  const t = useT();
  const status = useRealtimeStatus();
  const { label, dot } = {
    live: { label: t.common.realtimeLive, dot: "bg-sage" },
    connecting: { label: t.common.realtimeConnecting, dot: "bg-accent animate-pulse" },
    off: { label: t.common.realtimeOff, dot: "bg-neutral-400" },
  }[status];

  return (
    <div className="card mb-3 p-[10px_11px]" role="status">
      <div className="eyebrow mb-[5px] text-muted">{t.common.realtimeStatus}</div>
      <div className="flex items-center gap-[7px] text-[13px]">
        <span className={`h-[9px] w-[9px] flex-none rounded-full ${dot}`} />
        {label}
      </div>
    </div>
  );
}

/**
 * NavLink already sets `aria-current="page"` on the active route, which is the
 * selector the design system's rail styles key on.
 */
function RailLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink to={to} className="shrink-0">
      <Icon size={17} strokeWidth={2.75} />
      {label}
    </NavLink>
  );
}

/** The header's "Export CSV" button, wired by each view to its own rows. */
export function ExportButton({ onExport }: { onExport: () => void }) {
  const t = useT();
  return (
    <Button className="flex-none" onClick={onExport}>
      {t.common.exportCsv}
    </Button>
  );
}
