"use client";

import { apiRequest } from "@/lib/api-client";
import { displayCompanyRating, type OwnerAppearance } from "@/lib/company-settings";
import { CompanyRating } from "@/components/ui/company-rating";
import { useCompanySettings } from "@/lib/use-company-settings";
import { useGooglePlace } from "@/lib/use-google-place";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Ban,
  Bot,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  Crown,
  Eye,
  EyeOff,
  Gauge,
  Globe2,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Receipt,
  Search,
  Send,
  Settings,
  Smartphone,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { applyDashboardTheme, useTheme } from "@/lib/theme-context";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";

import { useSession } from "@/components/ui/auth-guard";
import { CompanyAvatar } from "@/components/ui/company-avatar";
import { NotificationsBell } from "@/components/ui/notifications-bell";
import { PlanUsagePopover } from "@/components/ui/plan-usage-popover";
import { usePrivacy } from "@/lib/privacy-context";
import { usePlanLimits } from "@/lib/use-plan-limits";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";

const sidebarActive = "bg-transparent text-white";
const sidebarInactive = "text-slate-300 hover:bg-white/8 hover:text-white";
const sidebarActiveDot = <span aria-hidden="true" className="ml-auto block h-2 w-2 shrink-0 rounded-full bg-[#00A8C6]" />;

function CloudGoLogo() {
  return (
    <Link
      href="/owner/appointments"
      className="flex items-center gap-2 text-ink group cursor-pointer select-none shrink-0"
      title="CloudGo - Sistema de Gestão"
    >
      <div className="grid size-8 sm:size-9 place-items-center rounded-xl bg-gradient-to-tr from-accent to-emerald-400 text-accent-ink shadow-xs group-hover:scale-105 transition-transform shrink-0">
        <Sparkles size={16} className="text-white fill-white" />
      </div>
      <div className="flex flex-col">
        <span className="text-base sm:text-lg font-black tracking-tight leading-none text-ink">
          Cloud<span className="text-accent">Go</span>
        </span>
        <span className="hidden sm:block text-[9px] font-bold uppercase tracking-wider text-ink-muted">
          SaaS Gestão
        </span>
      </div>
    </Link>
  );
}

function QuickCreateDropdown({
  product,
  compact = false,
  align = "left",
}: {
  product: any;
  compact?: boolean;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={product.quickCreate}
        title={product.quickCreate}
        className={
          compact
            ? "grid size-9 place-items-center rounded-xl bg-accent text-accent-ink hover:bg-accent-hover transition-colors cursor-pointer shadow-xs"
            : "inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors cursor-pointer shadow-xs whitespace-nowrap"
        }
      >
        <Plus size={compact ? 16 : 13} />
        {!compact && (
          <>
            <span>{product.quickCreate}</span>
            <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className={`absolute ${
              align === "right" ? "right-0" : "left-0"
            } top-full mt-1.5 z-40 w-52 rounded-xl border border-border-subtle bg-surface p-1 shadow-xl text-xs space-y-0.5`}
          >
            <Link
              href="/owner/appointments?action=new-appointment"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 font-medium text-ink hover:bg-subtle transition-colors"
            >
              <CalendarDays size={14} className="text-accent" />
              <span>Novo Agendamento</span>
            </Link>
            <Link
              href="/owner/appointments?action=new-block"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 font-medium text-ink hover:bg-subtle transition-colors"
            >
              <Ban size={14} className="text-rose-500" />
              <span>Bloquear Agenda</span>
            </Link>
            <Link
              href="/owner/finance?action=new-sale"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 font-medium text-ink hover:bg-subtle transition-colors"
            >
              <Receipt size={14} className="text-emerald-500" />
              <span>Nova Comanda / Venda</span>
            </Link>
            <Link
              href="/owner/clients?action=new-client"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 font-medium text-ink hover:bg-subtle transition-colors"
            >
              <UserPlus size={14} className="text-blue-500" />
              <span>Novo Cliente</span>
            </Link>
            <Link
              href="/owner/finance/payables?action=new-payable"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 font-medium text-ink hover:bg-subtle transition-colors"
            >
              <Wallet size={14} className="text-amber-500" />
              <span>Nova Conta a Pagar</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

// ==========================================
// MODAL DE BUSCA GLOBAL (CTRL + K)
// ==========================================
function GlobalSearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const searchItems = [
    { label: "Agenda & Calendário", href: "/owner/appointments", category: "Navegação", icon: CalendarDays },
    { label: "Base de Clientes (CRM)", href: "/owner/clients", category: "Navegação", icon: Users },
    { label: "Gestão de Comandas", href: "/owner/finance", category: "Navegação", icon: Receipt },
    { label: "Comissões da Equipe", href: "/owner/finance/commissions", category: "Financeiro", icon: Wallet },
    { label: "Contas a Pagar / Despesas", href: "/owner/finance/payables", category: "Financeiro", icon: Wallet },
    { label: "Catálogo de Serviços", href: "/owner/services", category: "Serviços", icon: Wrench },
    { label: "Categorias de Serviços", href: "/owner/services/categories", category: "Serviços", icon: Wrench },
    { label: "Pacotes de Serviços", href: "/owner/services/packages", category: "Serviços", icon: Package },
    { label: "Estoque & Produtos", href: "/owner/inventory", category: "Estoque", icon: Package },
    { label: "Fornecedores", href: "/owner/inventory/suppliers", category: "Estoque", icon: Package },
    { label: "Ordens de Compra", href: "/owner/inventory/purchase-orders", category: "Estoque", icon: Package },
    { label: "Relatório de Faturamento", href: "/owner/reports/finance", category: "Relatórios", icon: ChartNoAxesCombined },
    { label: "Central do Link de Agendamento", href: "/owner/booking-link", category: "Configurações", icon: Smartphone },
    { label: "Configurações & Planos", href: "/owner/settings", category: "Configurações", icon: Settings },
  ];

  const filtered = searchItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase()),
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-border-strong bg-surface p-4 shadow-2xl z-10 space-y-3">
        <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
          <Search size={18} className="text-ink-muted shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Buscar páginas, clientes, comandas, relatórios..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted outline-none"
          />
          <kbd className="hidden sm:inline-flex rounded border border-border-subtle bg-surface-subtle px-1.5 py-0.5 text-[10px] text-ink-muted font-mono">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-lg text-ink-secondary hover:bg-surface-hover hover:text-ink cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1">
          {filtered.length > 0 ? (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="flex items-center justify-between rounded-xl p-2.5 hover:bg-surface-hover transition-colors text-xs text-ink"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-7 place-items-center rounded-lg bg-surface-subtle text-accent">
                      <Icon size={14} />
                    </span>
                    <span className="font-semibold">{item.label}</span>
                  </div>
                  <span className="text-[10px] text-ink-muted font-mono rounded bg-canvas px-1.5 py-0.5">
                    {item.category}
                  </span>
                </Link>
              );
            })
          ) : (
            <p className="py-8 text-center text-xs text-ink-muted">
              Nenhum resultado encontrado para &quot;{query}&quot;.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// DRAWER DO COPILOTO IA
// ==========================================
function AiCopilotDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    {
      sender: "bot",
      text: "Olá! Sou seu Copiloto IA. Posso analisar seus agendamentos, comandas abertas, retenção de clientes e dar recomendações práticas para impulsionar seu salão ou barbearia. Como posso ajudar?",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  const suggestedQuestions = [
    "Quais serviços têm maior lucratividade?",
    "Quantos clientes estão inadimplentes (com fiado)?",
    "Como reduzir faltas e no-shows esta semana?",
    "Dicas para fidelizar clientes que não voltam há 45 dias?",
  ];

  function handleSend(textToSend?: string) {
    const q = (textToSend || input).trim();
    if (!q) return;

    setMessages((prev) => [...prev, { sender: "user", text: q }]);
    setInput("");
    setThinking(true);

    setTimeout(() => {
      let answer = "";
      const lower = q.toLowerCase();

      if (lower.includes("lucratividade") || lower.includes("serviços")) {
        answer = "Com base no histórico operacional, serviços combinados (ex: Corte + Barba ou Química + Escova) apresentam maior margem e ticket médio ~40% superior. Recomendamos incentivar a venda cruzada de pacotes e a adição de produtos no checkout da comanda.";
      } else if (lower.includes("inadimplentes") || lower.includes("fiado") || lower.includes("débito")) {
        answer = "Identificamos comandas com saldo em aberto no financeiro. Para conter o fiado, você pode enviar lembretes rápidos via WhatsApp diretamente pela ficha do cliente em 'Clientes > Débitos' ou exigir sinal online de 30% a 50% para novos agendamentos.";
      } else if (lower.includes("falta") || lower.includes("no-show")) {
        answer = "A principal causa de no-show é o esquecimento. Seus agendamentos já contam com a trava de lembrete com 6 horas de antecedência. Adicionalmente, ative a cobrança de taxa de reserva antecipada pelo link de agendamento online.";
      } else {
        answer = "Excelente pergunta estratégica. Analisando as operações e métricas do seu negócio, recomendamos focar na fidelização ativa: premiar clientes fiéis via pontos de fidelidade e aplicar campanhas no WhatsApp para reativação dos clientes com mais de 30 dias sem visita.";
      }

      setMessages((prev) => [...prev, { sender: "bot", text: answer }]);
      setThinking(false);
    }, 600);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border-strong bg-surface shadow-2xl z-10 animate-in slide-in-from-right duration-200">
        {/* Header do Copiloto */}
        <div className="flex items-center justify-between border-b border-border-subtle p-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-ink shadow-xs">
              <Bot size={18} />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-ink">Copiloto IA do Negócio</h3>
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                  Beta
                </span>
              </div>
              <p className="text-[11px] text-ink-muted">Insights operacionais e inteligência</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-ink-secondary hover:bg-surface-hover hover:text-ink cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3 shadow-xs leading-relaxed ${
                  m.sender === "user"
                    ? "bg-accent text-accent-ink rounded-tr-xs font-medium"
                    : "border border-border-subtle bg-surface-subtle text-ink rounded-tl-xs"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-border-subtle bg-surface-subtle p-3 text-ink-muted flex items-center gap-2">
                <Sparkles size={14} className="animate-spin text-accent" />
                <span>Analisando indicadores do negócio...</span>
              </div>
            </div>
          )}

          {/* Sugestões rápidas */}
          {messages.length <= 2 && (
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider block mb-2">
                Perguntas Frequentes
              </span>
              <div className="space-y-1.5">
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(q)}
                    className="w-full text-left rounded-xl border border-border-subtle bg-surface hover:bg-surface-hover p-2.5 text-xs text-ink transition-colors cursor-pointer flex items-center justify-between group"
                  >
                    <span>{q}</span>
                    <ArrowRight size={12} className="text-ink-muted group-hover:text-accent transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Campo de envio */}
        <div className="border-t border-border-subtle p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Pergunte sobre seus dados ou peça dicas..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 rounded-xl border border-border-subtle bg-surface-subtle px-3 py-2 text-xs text-ink placeholder:text-ink-muted outline-none focus-visible:border-accent"
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              className="grid size-9 place-items-center rounded-xl bg-accent text-accent-ink hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function OwnerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t, setLocale } = useLocale();
  const { mode, palette, setMode, setPalette } = useTheme();
  const { session, logout } = useSession();
  const { settings } = useCompanySettings(session.company.id);
  const { place: googlePlace } = useGooglePlace(session.company.id, settings.googlePlaceId, { summary: true });

  useEffect(() => {
    applyDashboardTheme(mode, palette);
  }, [mode, palette]);

  useEffect(() => () => {
    const root = document.documentElement;
    delete root.dataset.theme;
    delete root.dataset.palette;
    root.classList.remove("dark");
  }, []);

  useEffect(() => {
    const request = new AbortController();
    const cached = () => {
      try {
        return ["atelier_agenda_theme_mode", "atelier_agenda_theme_palette", "atelier_agenda_locale"]
          .map((key) => localStorage.getItem(key)).join("|");
      } catch {
        return "";
      }
    };
    const before = cached();
    void apiRequest<{ appearance: OwnerAppearance | null }>("/companies/me/settings/appearance", { signal: request.signal })
      .then(({ appearance }) => {
        if (!appearance || request.signal.aborted || cached() !== before) return;
        setMode(appearance.mode);
        setPalette(appearance.palette);
        setLocale(appearance.locale);
      }).catch(() => undefined);
    return () => request.abort();
  }, [session.company.id, setLocale, setMode, setPalette]);
  const { collapsed, toggle } = useSidebarCollapsed();
  const { hideSensitiveValues, togglePrivacy } = usePrivacy();
  const { currentPlan } = usePlanLimits();
  const isTrial = currentPlan === "TRIAL";
  const { product } = t;
  const [activeGroup, setActiveGroup] = useState<string | null>("agenda");
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navGroups = [
    { key: "agenda", label: product.agenda, icon: CalendarDays, items: [
      { href: "/owner/appointments", label: product.calendar },
      { href: "/owner/blocks", label: product.blocks },
      { href: "/owner/appointments/list", label: product.listing },
      { href: "/owner/appointments/restore", label: product.restore },
    ] },
    { key: "finance", label: product.finance, icon: Wallet, items: [
      { href: "/owner/finance", label: product.overviewReceipts },
      { href: "/owner/finance/commissions", label: product.commissionsAdvances },
      { href: "/owner/finance/payables", label: product.accounts },
      { href: "/owner/finance/statement", label: product.cashStatement },
      { href: "/owner/finance/payment-methods", label: product.paymentMethods },
      { href: "/owner/finance/online-payments", label: product.onlinePayment },
    ] },
    { key: "clients", label: product.clients, icon: Users, items: [
      { href: "/owner/clients", label: product.clientBase },
      { href: "/owner/clients/churn", label: product.inactiveClients },
      { href: "/owner/clients/birthdays", label: product.birthdays },
      { href: "/owner/clients/returns", label: product.returns },
      { href: "/owner/clients/loyalty", label: product.loyalty },
    ] },
    { key: "services", label: product.services, icon: Wrench, items: [
      { href: "/owner/services", label: product.serviceListing },
      { href: "/owner/services/categories", label: product.categories },
      { href: "/owner/services/packages", label: product.packages },
    ] },
    { key: "inventory", label: product.productsInventory, icon: Package, items: [
      { href: "/owner/inventory", label: product.productListingMovements },
      { href: "/owner/inventory/categories", label: product.categories },
      { href: "/owner/inventory/suppliers", label: product.suppliers },
      { href: "/owner/inventory/purchase-orders", label: product.purchaseOrders },
    ] },
    { key: "team", label: product.team, icon: Users, items: [
      { href: "/owner/team", label: product.professionalsList }, { label: product.schedules },
    ] },
    { key: "reports", label: product.reports, icon: ChartNoAxesCombined, items: [
      { href: "/owner/reports", label: product.mainReport },
      { href: "/owner/reports/agenda", label: product.agendaReport },
      { href: "/owner/reports/finance", label: product.financeReport },
      { label: product.advancedReports },
    ] },
  ];
  const navItems = [
    ...navGroups.flatMap((group) => group.items.filter((item): item is typeof item & { href: string } => Boolean(item.href)).map((item) => ({ ...item, icon: group.icon }))),
    { href: "/owner/settings", label: product.settings, icon: Settings },
  ];
  const mobileItems = [
    { href: "/owner/appointments", label: product.agenda, icon: CalendarDays },
    { href: "/owner/finance", label: product.overviewReceipts, icon: Receipt },
    { href: "/owner/clients", label: product.clients, icon: Users },
    { href: "/owner/team", label: product.team, icon: Users },
    { href: "/owner/settings", label: product.settings, icon: Settings },
  ];

  const isActive = (href: string) => {
    // Garante que o calendário principal não fique ativo nas sub-páginas /list e /restore
    if (href === "/owner/appointments") {
      return pathname === "/owner/appointments";
    }
    // Garante que a tela de Comandas não permaneça ativa em sub-rotas como /owner/finance/commissions
    if (href === "/owner/finance") {
      return pathname === "/owner/finance";
    }
    // Garante que a Base de Clientes fique ativa em /owner/clients e fichas /owner/clients/[id], mas não em listas derivadas
    if (href === "/owner/clients") {
      return (
        pathname === "/owner/clients" ||
        (pathname.startsWith("/owner/clients/") &&
          !["/owner/clients/churn", "/owner/clients/birthdays", "/owner/clients/returns", "/owner/clients/loyalty"].some(
            (p) => pathname.startsWith(p),
          ))
      );
    }
    // Garante que o relatório principal não permaneça ativo em sub-rotas como /owner/reports/agenda
    if (href === "/owner/reports") {
      return pathname === "/owner/reports";
    }
    // Garante que Serviços não permaneça ativo em sub-rotas como /categories ou /packages
    if (href === "/owner/services") {
      return pathname === "/owner/services";
    }
    // Garante que Produtos e Estoque não permaneça ativo em sub-rotas como /categories, /suppliers ou /purchase-orders
    if (href === "/owner/inventory") {
      return pathname === "/owner/inventory";
    }
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
        "dashboard-shell min-h-dvh flex flex-col bg-canvas text-ink transition-colors duration-200",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* ======================================================== */}
      {/* 1. TOPBAR GLOBAL DE LARGURA INTEIRA (W-FULL) */}
      {/* ======================================================== */}
      <header data-shell-header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-surface/95 backdrop-blur-md shadow-xs">
        <div className="flex w-full items-center justify-between gap-2 px-3 py-2 sm:px-4 lg:px-6">
          {/* Esquerda: Botão Menu/Colapsar + Logo CloudGo + Atalhos (Tablet/Desktop) */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            {/* Botão Hambúrguer (Mobile e Tablet < lg) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu lateral"
              title="Abrir menu lateral"
              className="flex lg:hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink hover:border-accent transition-colors cursor-pointer"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>

            {/* Botão Colapsar Sidebar (Desktop >= lg) */}
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? t.common.expandSidebar : t.common.collapseSidebar}
              title={collapsed ? t.common.expandSidebar : t.common.collapseSidebar}
              className="hidden lg:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink hover:border-accent transition-colors cursor-pointer"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {/* Logo e Nome do Sistema CloudGo */}
            <CloudGoLogo />

            {/* Atalhos Rápidos na Topbar (Tablet e Desktop >= md) */}
            <div className="hidden md:flex items-center gap-1.5 border-l border-border-subtle/80 pl-2.5 shrink-0">
              <Link
                href="/owner/appointments"
                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  pathname === "/owner/appointments"
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "border border-border-subtle bg-surface text-ink-secondary hover:text-ink hover:border-accent"
                }`}
                title="Ir para o Calendário da Agenda"
              >
                <CalendarDays size={13} className="text-accent shrink-0" />
                <span>{product.calendarShortcut}</span>
              </Link>

              <QuickCreateDropdown product={product} />
            </div>
          </div>

          {/* Direita Mobile (< md): apenas 4 botões compactos bem espaçados */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            <QuickCreateDropdown product={product} compact align="right" />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={product.globalSearch ?? "Busca Global"}
              title={product.globalSearch ?? "Busca Global"}
              className="grid size-9 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink hover:border-accent transition-colors cursor-pointer"
            >
              <Search size={16} />
            </button>
            <NotificationsBell />
            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              aria-label={product.aiCopilot ?? "Copiloto IA"}
              title={product.aiCopilot ?? "Copiloto IA"}
              className="grid size-9 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors cursor-pointer"
            >
              <Bot size={16} />
            </button>
          </div>

          {/* Direita Tablet & Desktop (>= md): sem Tema, Paleta ou Idioma (movidos para Configurações) */}
          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            {/* 1) Botão pílula ciano vibrante Assine Agora (exibido apenas no Free Trial e somente em desktop >= lg para não duplicar no iPad/tablet) */}
            {isTrial && (
              <Link
                href="/owner/settings"
                className="hidden lg:inline-flex items-center gap-2 rounded-full bg-[#00A8C6] hover:bg-[#0092AD] px-3.5 py-1 transition-all shadow-xs cursor-pointer shrink-0"
                title="Conheça os Planos e faça upgrade"
              >
                <Crown size={15} className="text-[#FFD43B] fill-[#FFD43B] shrink-0" />
                <span className="flex flex-col text-left leading-tight">
                  <span className="text-white font-bold text-xs leading-tight whitespace-nowrap">
                    {product.subscribeNow ?? "Assine Agora"}
                  </span>
                  <span className="text-white/90 font-medium text-[10px] leading-tight whitespace-nowrap">
                    Conheça os Planos
                  </span>
                </span>
              </Link>
            )}

            {/* 2) Botão de ícone Copiloto IA (Bot) */}
            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              aria-label={product.aiCopilot ?? "Copiloto IA"}
              title={product.aiCopilot ?? "Copiloto IA"}
              className="grid size-9 lg:size-10 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors cursor-pointer"
            >
              <Bot size={16} />
            </button>

            {/* 3) Botão de ícone Busca Global (Search - abre modal Ctrl+K) */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={product.globalSearch ?? "Busca Global (Ctrl + K)"}
              title={product.globalSearch ?? "Busca Global (Ctrl + K)"}
              className="grid size-9 lg:size-10 shrink-0 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink hover:border-accent transition-colors cursor-pointer"
            >
              <Search size={16} />
            </button>

            {/* 4) Botão de ícone Olho de Privacidade (Eye / EyeOff) */}
            <button
              type="button"
              onClick={togglePrivacy}
              aria-label={hideSensitiveValues ? product.privacyOff : product.privacyOn}
              title={hideSensitiveValues ? product.privacyOff : product.privacyOn}
              className="grid size-9 lg:size-10 shrink-0 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink hover:border-accent transition-colors cursor-pointer"
            >
              {hideSensitiveValues ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            </button>

            {/* 5) Botão de ícone Notificações (Bell com badge e som) */}
            <NotificationsBell />

            {/* 6) Botão de ícone Celular (Smartphone com tooltip "Link de Agendamento") */}
            <Link
              href="/owner/booking-link"
              aria-label={product.bookingLink ?? "Link de Agendamento"}
              title="Link de Agendamento"
              className={`grid size-9 lg:size-10 shrink-0 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink hover:border-accent transition-colors cursor-pointer ${
                pathname === "/owner/booking-link" ? "bg-accent/15 text-accent border-accent/40" : ""
              }`}
            >
              <Smartphone size={16} />
            </Link>

            {/* 7) Apenas o ícone de Velocímetro (Gauge) com tooltip "Consumo do plano" */}
            <PlanUsagePopover />
          </div>
        </div>
      </header>

      {/* Drawer Lateral Mobile & Tablet (< lg) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col border-r border-slate-800 bg-[#0F172A] text-slate-100 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <CompanyAvatar url={session.company.avatarUrl ?? session.avatarUrl} />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5"><p className="truncate text-sm font-bold">{session.company.companyName}</p><CompanyRating rating={displayCompanyRating(settings, googlePlace)} /></div>
                  <p className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 truncate">
                    <Globe2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {session.company.timezone}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
                className={`grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg ${sidebarInactive}`}
              >
                <X size={16} />
              </button>
            </div>

            {/* Card WhatsApp no Drawer Mobile */}
            <Link
              href="/owner/settings"
              onClick={() => setMobileMenuOpen(false)}
              className="mx-3 mt-3 flex items-center gap-3 rounded-xl border border-slate-800 bg-white/5 p-3 text-left hover:bg-white/10 transition-colors"
            >
              <div className="relative grid size-10 shrink-0 place-items-center rounded-full bg-[#25D366] text-white shadow-sm">
                <WhatsAppIcon className="size-5" />
                <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-red-500 ring-2 ring-[#0F172A]" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-bold tracking-tight">WhatsApp</span>
                <span className="block truncate text-xs font-medium text-rose-400">
                  {product.whatsappDisconnected}
                </span>
              </div>
            </Link>

            {/* Ações de Plano, Link de Agendamento, Consumo e Privacidade no Mobile */}
            <div className="mx-3 mt-3 space-y-2 border-b border-slate-800 pb-3">
              {isTrial && (
                <Link
                  href="/owner/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-full bg-[#00A8C6] hover:bg-[#0092AD] px-3.5 py-2 transition-colors shadow-xs"
                >
                  <Crown size={15} className="text-[#FFD43B] fill-[#FFD43B] shrink-0" />
                  <span className="flex flex-col leading-tight">
                    <span className="text-white font-bold text-xs leading-tight">
                      {product.subscribeNow ?? "Assine Agora"}
                    </span>
                    <span className="text-white/90 font-medium text-[10px] leading-tight">
                      Conheça os Planos
                    </span>
                  </span>
                </Link>
              )}

              <div className="grid grid-cols-2 gap-1.5">
                <Link
                  href="/owner/booking-link"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
                >
                  <Smartphone size={14} className="text-[#00A8C6] shrink-0" />
                  <span className="truncate">Link Online</span>
                </Link>
                <Link
                  href="/owner/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
                >
                  <Gauge size={14} className="text-[#00A8C6] shrink-0" />
                  <span className="truncate">Consumo</span>
                </Link>
              </div>

              <button
                type="button"
                onClick={togglePrivacy}
                className="flex w-full items-center justify-between rounded-lg bg-white/5 px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5">
                  {hideSensitiveValues ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{hideSensitiveValues ? product.privacyOff : product.privacyOn}</span>
                </span>
              </button>
            </div>

            {/* Navegação Acordeão no Drawer Mobile */}
            <nav className="flex-1 space-y-1.5 overflow-y-auto px-2.5 py-3">
              {navGroups.map((group) => {
                const Icon = group.icon;
                const isSelected = group.items.some((item) => item.href && isActive(item.href));
                // Permite fechar o grupo atual clicando novamente nele mesmo
                const expanded = activeGroup === group.key;
                return (
                  <div key={group.key}>
                    <button
                      type="button"
                      onClick={() => setActiveGroup((prev) => (prev === group.key ? null : group.key))}
                      aria-expanded={expanded}
                      className={`flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors ${
                        isSelected ? sidebarActive : sidebarInactive
                      }`}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
                      {isSelected && !expanded ? sidebarActiveDot : <ChevronDown
                        className={`size-3.5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />}
                    </button>
                    {expanded && (
                      <div className="ml-4 space-y-0.5 border-l border-slate-800 py-1 pl-2">
                        {group.items.map((item, index) =>
                          item.href ? (
                            <Link
                              key={`${group.key}-${item.label}-${index}`}
                              href={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              aria-current={isActive(item.href) ? "page" : undefined}
                              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${isActive(item.href) ? sidebarActive : sidebarInactive}`}
                            >
                              {item.label}
                              {isActive(item.href) && sidebarActiveDot}
                            </Link>
                          ) : (
                            <span
                              key={`${group.key}-${item.label}-${index}`}
                              className="flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500"
                            >
                              <span className="truncate">{item.label}</span>
                              <span className="text-[9px] shrink-0">{product.comingSoon}</span>
                            </span>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <Link
                href="/owner/settings"
                onClick={() => setMobileMenuOpen(false)}
                aria-current={isActive("/owner/settings") ? "page" : undefined}
                className={`flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-medium ${
                  isActive("/owner/settings") ? sidebarActive : sidebarInactive
                }`}
              >
                <Settings className="size-4 shrink-0" aria-hidden="true" />
                <span>{product.settings}</span>
                {isActive("/owner/settings") && sidebarActiveDot}
              </Link>
            </nav>

            <div className="border-t border-slate-800 p-3">
              <button
                type="button"
                onClick={logout}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-600/50 bg-white/5 text-xs font-semibold text-slate-200 hover:bg-white/10 cursor-pointer"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t.common.logout}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. CORPO: SIDEBAR FIXA ABAIXO DO HEADER + CONTEÚDO PRINCIPAL */}
      {/* ======================================================== */}
      <div className="flex flex-1 min-w-0">
        {/* Sidebar retrátil à esquerda (desktop) */}
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 76 : 232 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="hidden overflow-hidden border-r border-slate-800 bg-[#0F172A] text-slate-100 lg:fixed lg:top-[57px] lg:bottom-0 lg:z-30 lg:flex lg:flex-col"
        >
          {/* Topo da Sidebar: Nome da Empresa e Fuso Horário */}
          <div
            className={[
              "flex items-center border-b border-slate-800 py-3",
              collapsed ? "justify-center px-2" : "gap-2.5 px-3",
            ].join(" ")}
          >
            <CompanyAvatar url={session.company.avatarUrl ?? session.avatarUrl} />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5"><p className="truncate text-sm font-bold">{session.company.companyName}</p><CompanyRating rating={displayCompanyRating(settings, googlePlace)} /></div>
                <p className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 truncate mt-0.5">
                  <Globe2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {session.company.timezone}
                </p>
              </div>
            )}
          </div>

          {/* Card Oficial do WhatsApp na Sidebar */}
          {!collapsed && (
            <Link
              href="/owner/settings"
              className="mx-2.5 mt-2.5 flex items-center gap-2.5 rounded-xl border border-slate-800 bg-white/5 p-2.5 text-left hover:bg-white/10 transition-colors"
            >
              <div className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[#25D366] text-white shadow-sm">
                <WhatsAppIcon className="size-4.5" />
                <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-red-500 ring-2 ring-[#0F172A]" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-bold tracking-tight">WhatsApp</span>
                <span className="block truncate text-xs font-medium text-rose-400">
                  {product.whatsappDisconnected}
                </span>
              </div>
            </Link>
          )}

          {/* Navegação da Sidebar com Acordeão Único */}
          <nav
            aria-label="Navegação do proprietário"
            className="min-w-0 flex-1 space-y-1.5 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2 py-3"
          >
            {navGroups.map((group) => {
              const Icon = group.icon;
              const isSelected = group.items.some((item) => item.href && isActive(item.href));
              // Permite fechar o grupo atual clicando novamente nele mesmo
              const expanded = activeGroup === group.key;
              return (
                <div key={group.key} className="min-w-0">
                  <button
                    type="button"
                    title={collapsed ? group.label : undefined}
                    aria-expanded={!collapsed && expanded}
                    onClick={() => {
                      if (!collapsed) {
                        setActiveGroup((prev) => (prev === group.key ? null : group.key));
                      }
                    }}
                    className={`relative flex min-h-10 w-full items-center rounded-xl text-sm font-medium transition-colors ${
                      collapsed ? "justify-center" : "gap-2.5 px-3"
                    } ${isSelected ? sidebarActive : sidebarInactive}`}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {collapsed && isSelected && <span className="absolute right-2">{sidebarActiveDot}</span>}
                    {!collapsed && (
                      <>
                        <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
                        {isSelected && !expanded ? sidebarActiveDot : <ChevronDown
                          className={`size-3.5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />}
                      </>
                    )}
                  </button>
                  {!collapsed && expanded && (
                    <div className="ml-4 space-y-0.5 border-l border-slate-800 py-1 pl-2">
                      {group.items.map((item, index) =>
                        item.href ? (
                          <Link
                            key={`${group.key}-${item.label}-${index}`}
                            href={item.href}
                            aria-current={isActive(item.href) ? "page" : undefined}
                            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${isActive(item.href) ? sidebarActive : sidebarInactive}`}
                          >
                            {item.label}
                            {isActive(item.href) && sidebarActiveDot}
                          </Link>
                        ) : (
                          <span
                            key={`${group.key}-${item.label}-${index}`}
                            title={product.comingSoon}
                            className="flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500"
                          >
                            <span className="truncate">{item.label}</span>
                            <span className="text-[9px] shrink-0">{product.comingSoon}</span>
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <Link
              href="/owner/settings"
              aria-current={isActive("/owner/settings") ? "page" : undefined}
              className={`relative flex min-h-10 items-center rounded-xl text-sm font-medium ${
                collapsed ? "justify-center" : "gap-2.5 px-3"
              } ${isActive("/owner/settings") ? sidebarActive : sidebarInactive}`}
              title={collapsed ? product.settings : undefined}
            >
              <Settings className="size-4 shrink-0" aria-hidden="true" />
              {!collapsed && product.settings}
              {isActive("/owner/settings") && (collapsed ? <span className="absolute right-2">{sidebarActiveDot}</span> : sidebarActiveDot)}
            </Link>
          </nav>

          {/* Rodapé da Sidebar: Perfil do Usuário e Logout */}
          <div className="space-y-2 border-t border-slate-800 p-3">
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
                  <p className="truncate text-xs font-semibold">
                    {session.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">
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
                "flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-800 bg-white/5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white cursor-pointer",
                collapsed ? "px-0" : "gap-2 px-3",
              ].join(" ")}
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!collapsed && <span>{t.common.logout}</span>}
            </button>
          </div>
        </motion.aside>

        {/* Conteúdo principal */}
        <div
          className={[
            "flex flex-1 flex-col min-w-0 transition-[padding] duration-250 ease-out",
            collapsed ? "lg:pl-[76px]" : "lg:pl-[232px]",
          ].join(" ")}
        >
          <main className="w-full flex-1 px-4 py-6 pb-24 lg:px-6 lg:pb-12">
            {children}
          </main>
        </div>
      </div>

      {/* Bottom Bar Mobile (5 atalhos principais sem corte de texto) */}
      <nav
        aria-label="Navegação móvel"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#263149] bg-[#131B2E]/95 text-slate-100 backdrop-blur-md lg:hidden shadow-lg"
      >
        <div className="grid grid-cols-5 max-w-lg mx-auto">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 py-1.5 text-[10px] font-semibold transition-colors",
                  active ? "text-accent font-bold" : "text-slate-300 hover:text-white",
                ].join(" ")}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                <span className="w-full truncate text-center leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Toaster sincronizado com o tema claro/escuro do shell */}
      <Toaster theme={mode} richColors position="bottom-right" />

      {/* Modal de Busca Global e Drawer do Copiloto IA */}
      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <AiCopilotDrawer open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  );
}
