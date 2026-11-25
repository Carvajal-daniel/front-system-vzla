"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Toaster } from "sonner";
import {
  Ban,
  CalendarDays,
  Clock,
  Globe2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UserCircle2,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { applyDashboardTheme, useTheme } from "@/lib/theme-context";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { useSession } from "@/components/ui/auth-guard";
import { CompanyAvatar } from "@/components/ui/company-avatar";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { NotificationsBell } from "@/components/ui/notifications-bell";
import { ThemeCustomizer } from "@/components/ui/theme-customizer";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function CollaboratorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const { t } = useLocale();
  const { mode, palette } = useTheme();
  const { session, logout } = useSession();
  const { collapsed, toggle } = useSidebarCollapsed();

  useEffect(() => {
    applyDashboardTheme(mode, palette);
  }, [mode, palette]);

  useEffect(() => () => {
    const root = document.documentElement;
    delete root.dataset.theme;
    delete root.dataset.palette;
    root.classList.remove("dark");
  }, []);

  const navItems = [
    { href: "/collaborator", label: t.nav.collaboratorAgenda, icon: CalendarDays },
    { href: "/collaborator/schedule", label: t.nav.collaboratorSchedule, icon: Clock },
    { href: "/collaborator/blocks", label: t.nav.collaboratorBlocks, icon: Ban },
    { href: "/collaborator/profile", label: t.nav.collaboratorProfile, icon: UserCircle2 },
  ];

  const isActive = (href: string) =>
    href === "/collaborator"
      ? pathname === "/collaborator"
      : pathname.startsWith(href);

  const activeItem = navItems.find((item) => isActive(item.href)) ?? navItems[0];

  return (
    <div
      data-palette={palette}
      data-theme={mode}
      className={[
        mode === "dark" ? "dark" : "",
        "dashboard-shell min-h-dvh flex bg-canvas text-ink transition-colors duration-200",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Sidebar retrátil à esquerda (desktop) */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 76 : 232 }}
        transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.23, 1, 0.32, 1] }}
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 z-30 border-r border-border-subtle bg-surface overflow-visible"
      >
        <div
          className={[
            "flex h-14 items-center border-b border-border-subtle",
            collapsed ? "justify-center px-2" : "justify-between gap-2 px-3.5",
          ].join(" ")}
        >
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <CompanyAvatar url={session.company.avatarUrl} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight text-ink">
                  {session.company.companyName}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-mono text-ink-muted truncate">
                  <Globe2 className="size-3 shrink-0" aria-hidden="true" />
                  {session.company.timezone}
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={toggle}
            aria-label={
              collapsed ? t.common.expandSidebar : t.common.collapseSidebar
            }
            title={
              collapsed ? t.common.expandSidebar : t.common.collapseSidebar
            }
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-border-subtle bg-surface text-ink-secondary transition-colors hover:border-border-strong hover:text-ink cursor-pointer"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>

        <nav
          aria-label="Navegação do colaborador"
          className="flex-1 space-y-1 p-2.5 overflow-y-auto"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={[
                  "group relative flex min-h-10 items-center rounded-lg text-sm font-medium transition-colors cursor-pointer",
                  collapsed ? "justify-center px-0" : "gap-2.5 px-3",
                  active
                    ? "bg-accent text-accent-ink font-semibold shadow-xs"
                    : "text-ink-secondary hover:bg-subtle hover:text-ink",
                ].join(" ")}
              >
                {active && !collapsed && (
                  <motion.span
                    layoutId="collab-sidebar-active"
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-accent-ink/80"
                    transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {!collapsed && <span className="truncate">{item.label}</span>}

                {/* Tooltip flutuante elegante no modo compacto */}
                {collapsed && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-[calc(100%+12px)] z-50 whitespace-nowrap rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  >
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border-subtle p-2.5 space-y-2">
          <Link
            href="/collaborator/profile"
            title={collapsed ? session.name : undefined}
            className={[
              "flex items-center rounded-lg bg-subtle/70 transition-colors hover:bg-subtle cursor-pointer",
              collapsed ? "justify-center p-2" : "gap-2.5 px-2.5 py-2",
            ].join(" ")}
          >
            {session.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.avatarUrl}
                alt={session.name}
                className="size-8 shrink-0 rounded-full object-cover border border-border-subtle"
              />
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                {getInitials(session.name)}
              </span>
            )}
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-ink">
                  {session.name}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {session.email}
                </p>
              </div>
            )}
          </Link>

          <button
            type="button"
            onClick={logout}
            aria-label={t.common.logout}
            title={collapsed ? t.common.logout : undefined}
            className={[
              "flex min-h-10 w-full items-center justify-center rounded-lg border border-border-subtle bg-surface text-xs font-semibold text-ink-secondary transition-colors hover:border-border-strong hover:bg-subtle hover:text-ink cursor-pointer",
              collapsed ? "px-0" : "gap-2 px-3",
            ].join(" ")}
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span>{t.common.logout}</span>}
          </button>
        </div>
      </motion.aside>

      {/* Conteúdo principal + Topbar limpo */}
      <div
        className={[
          "flex flex-1 flex-col min-w-0 transition-[padding] duration-220 ease-out",
          collapsed ? "md:pl-[76px]" : "md:pl-[232px]",
        ].join(" ")}
      >
        <header data-shell-header className="sticky top-0 z-20 h-14 border-b border-border-subtle bg-surface/95 backdrop-blur-md">
          <div className="flex h-full w-full items-center justify-between gap-3 px-3.5 sm:px-5 lg:px-6">
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-muted md:hidden truncate leading-none mb-0.5">
                {session.company.companyName}
              </p>
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-ink truncate leading-tight">
                {activeItem.label}
              </h1>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <NotificationsBell />
              <ThemeCustomizer />
              <LocaleSwitcher />
              <button
                type="button"
                onClick={logout}
                aria-label={t.common.logout}
                title={t.common.logout}
                className="grid md:hidden min-h-11 min-w-11 place-items-center rounded-lg border border-border-subtle bg-surface text-ink-secondary hover:border-border-strong hover:text-ink cursor-pointer"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <main className="w-full flex-1 px-3.5 py-5 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-5 lg:px-6 lg:py-6 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Bottom Bar Mobile com safe-area e alvos de toque confortáveis (>= 48px) */}
      <nav
        aria-label="Navegação móvel"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden shadow-lg"
      >
        <div className="grid w-full max-w-lg grid-cols-4 mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 py-1.5 text-xs font-medium transition-colors",
                  active ? "text-accent font-semibold" : "text-ink-muted hover:text-ink",
                ].join(" ")}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-accent"
                  />
                )}
                <Icon className="size-4.5 shrink-0" aria-hidden="true" />
                <span className="w-full truncate text-center leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Toaster sincronizado com o tema claro/escuro do shell */}
      <Toaster theme={mode} richColors position="bottom-right" />
    </div>
  );
}
