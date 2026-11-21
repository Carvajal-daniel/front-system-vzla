"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Toaster } from "sonner";
import {
  Ban,
  CalendarDays,
  ChartNoAxesCombined,
  Globe2,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { useTheme } from "@/lib/theme-context";
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

export function OwnerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const { mode, palette } = useTheme();
  const { session, logout } = useSession();
  const { collapsed, toggle } = useSidebarCollapsed();

  const navGroups = [
    { label: t.nav.overviewCategory, items: [{ href: "/owner", label: t.nav.ownerDashboard, icon: ChartNoAxesCombined }] },
    { label: t.nav.operationsCategory, items: [
      { href: "/owner/appointments", label: t.nav.ownerAgenda, icon: CalendarDays },
      { href: "/owner/blocks", label: t.nav.ownerBlocks, icon: Ban },
    ] },
    { label: t.nav.managementCategory, items: [
      { href: "/owner/team", label: t.nav.ownerTeam, icon: Users },
      { href: "/owner/services", label: t.nav.ownerServices, icon: Wrench },
      { href: "/owner/finance", label: t.nav.ownerFinance, icon: Wallet },
      { href: "/owner/inventory", label: t.executive.stock, icon: Package },
    ] },
    { label: t.nav.systemCategory, items: [{ href: "/owner/settings", label: t.nav.ownerSettings, icon: Settings }] },
  ];
  const navItems = navGroups.flatMap((group) => group.items);

  const isActive = (href: string) => {
    if (href === "/owner") return pathname === "/owner";
    // Mantém o item Equipe destacado nas rotas individuais /owner/collaborators/[id] e /owner/team/[id]
    if (href === "/owner/team") {
      return (
        pathname === "/owner/team" ||
        pathname.startsWith("/owner/team/") ||
        pathname === "/owner/collaborators" ||
        pathname.startsWith("/owner/collaborators/")
      );
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

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
        animate={{ width: collapsed ? 76 : 260 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="owner-sidebar hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 z-30 border-r border-[#263149] bg-[#131B2E] text-slate-100 overflow-hidden"
      >
        <div
          className={[
            "flex items-center border-b border-border-subtle py-4",
            collapsed ? "justify-center px-2" : "justify-between gap-2 px-4",
          ].join(" ")}
        >
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <CompanyAvatar url={session.company.avatarUrl ?? session.avatarUrl} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">
                  {session.company.companyName}
                </p>
                <p className="inline-flex items-center gap-1 text-[11px] font-mono text-ink-muted truncate">
                  <Globe2 className="h-3 w-3 shrink-0" aria-hidden="true" />
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-600/50 bg-white/5 text-slate-300 transition-colors hover:border-slate-400 hover:text-white cursor-pointer"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        <nav
          aria-label="Navegação do proprietário"
          className="min-w-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto p-3"
        >
          {navGroups.map((group) => <div key={group.label} className="min-w-0">
          {collapsed ? <div aria-hidden="true" className="my-2 border-t border-slate-600/40" /> : <p className="truncate px-3 pb-1 pt-3 text-[9px] font-bold uppercase tracking-[.17em] text-slate-500">{group.label}</p>}
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={[
                  "group relative min-w-0 flex min-h-11 items-center overflow-hidden rounded-xl text-sm font-semibold transition-colors cursor-pointer",
                  collapsed ? "justify-center px-0" : "gap-3 px-3.5",
                  active
                    ? "bg-accent text-accent-ink shadow-xs"
                    : "text-slate-300 hover:bg-white/8 hover:text-white",
                ].join(" ")}
              >
                {active && !collapsed && (
                  <motion.span
                    layoutId="owner-sidebar-active"
                    className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-accent-ink/80"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!collapsed && <span className="truncate">{item.label}</span>}

                {/* Tooltip flutuante elegante no modo compacto */}
                {collapsed && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-[calc(100%+12px)] z-50 whitespace-nowrap rounded-lg border border-slate-600 bg-[#162036] px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  >
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
          </div>)}
        </nav>

        <div className="space-y-2 border-t border-slate-600/40 p-3">
          <Link
            href="/owner/settings"
            title={collapsed ? session.name : undefined}
            className={[
              "flex min-w-0 items-center rounded-xl bg-white/5 transition-colors hover:bg-white/10 cursor-pointer",
              collapsed ? "justify-center p-2" : "gap-2.5 px-3 py-2.5",
            ].join(" ")}
          >
            {session.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.avatarUrl}
                alt={session.name}
                className="h-8 w-8 shrink-0 rounded-full object-cover border border-border-subtle"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                {getInitials(session.name)}
              </span>
            )}
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-100">
                  {session.name}
                </p>
                <p className="truncate text-[11px] text-ink-muted">
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
              "flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-600/50 bg-white/5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white cursor-pointer",
              collapsed ? "px-0" : "gap-2 px-3",
            ].join(" ")}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span>{t.common.logout}</span>}
          </button>
        </div>
      </motion.aside>

      {/* Conteúdo principal + Topbar limpo */}
      <div
        className={[
          "flex flex-1 flex-col min-w-0 transition-[padding] duration-250 ease-out",
          collapsed ? "lg:pl-[76px]" : "lg:pl-[260px]",
        ].join(" ")}
      >
        <header className="sticky top-0 z-20 border-b border-border-subtle bg-surface/90 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-muted lg:hidden truncate">
                {session.company.companyName}
              </p>
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-ink truncate">
                {activeItem.label}
              </h1>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <NotificationsBell />
              <ThemeCustomizer />
              <LocaleSwitcher />
              <button
                type="button"
                onClick={logout}
                aria-label={t.common.logout}
                title={t.common.logout}
                className="flex lg:hidden h-10 w-10 items-center justify-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink cursor-pointer"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Bottom Bar Mobile (alvos de toque confortáveis >= 48px) */}
      <nav
        aria-label="Navegação móvel"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#263149] bg-[#131B2E]/95 text-slate-100 backdrop-blur-md lg:hidden shadow-lg"
      >
        <div className="grid grid-cols-7 max-w-lg mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-1.5 text-[10px] font-semibold transition-colors",
                  active ? "text-accent font-bold" : "text-slate-300 hover:text-white",
                ].join(" ")}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                <span className="truncate max-w-full text-center">{item.label}</span>
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
