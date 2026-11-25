"use client";

import { apiRequest } from "@/lib/api-client";
import { displayCompanyRating, type OwnerAppearance } from "@/lib/company-settings";
import { CompanyRating } from "@/components/ui/company-rating";
import { useCompanySettings } from "@/lib/use-company-settings";
import { useGooglePlace } from "@/lib/use-google-place";
import {
  WHATSAPP_CONNECTION_UPDATED_EVENT,
  whatsappConnectionApi,
  type EvolutionConnectionStatus,
} from "@/lib/whatsapp-connection";
import { type CopilotHistoryMessage } from "@/lib/whatsapp-intelligence";
import {
  intelligenceApi,
  OPEN_COPILOT_EVENT,
  resolveModuleFromPathname,
  type IntelligenceModule,
  type OpenCopilotEventDetail,
} from "@/lib/intelligence-api";
import { Popover } from "@base-ui/react/popover";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Toaster } from "sonner";
import { useEffect, useRef, useState } from "react";
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
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Receipt,
  Scissors,
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

const sidebarActive = "bg-white/10 text-white font-semibold";
const sidebarInactive = "text-slate-300 hover:bg-white/8 hover:text-white";
const sidebarActiveDot = <span aria-hidden="true" className="ml-auto block h-2 w-2 shrink-0 rounded-full bg-accent" />;

function BrandMark({ appName }: { appName: string }) {
  return (
    <Link
      href="/owner/appointments"
      className="flex items-center gap-2 text-ink group cursor-pointer select-none shrink-0"
      title={appName}
    >
      <div className="grid size-8 place-items-center rounded-lg bg-accent text-accent-ink shadow-xs transition-colors shrink-0">
        <Scissors size={15} aria-hidden="true" />
      </div>
      <span className="text-sm font-semibold tracking-tight leading-none text-ink">
        {appName}
      </span>
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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={product.quickCreate}
        title={product.quickCreate}
        className={
          compact
            ? "grid min-h-11 min-w-11 md:min-h-9 md:min-w-9 md:h-9 md:w-9 place-items-center rounded-lg bg-accent text-accent-ink hover:bg-accent-hover transition-colors cursor-pointer shadow-xs"
            : "inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors cursor-pointer shadow-xs whitespace-nowrap"
        }
      >
        <Plus size={compact ? 16 : 14} aria-hidden="true" />
        {!compact && (
          <>
            <span>{product.quickCreate}</span>
            <ChevronDown size={12} aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className={`absolute ${
              align === "right" ? "right-0" : "left-0"
            } top-full mt-1.5 z-40 w-56 rounded-xl border border-border-subtle bg-surface p-1.5 shadow-xl text-xs space-y-0.5`}
          >
            <Link
              href="/owner/appointments?action=new-appointment"
              onClick={() => setOpen(false)}
              className="flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium text-ink hover:bg-subtle transition-colors"
            >
              <CalendarDays size={14} className="text-accent shrink-0" aria-hidden="true" />
              <span>{product.newAppointment}</span>
            </Link>
            <Link
              href="/owner/appointments?action=new-block"
              onClick={() => setOpen(false)}
              className="flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium text-ink hover:bg-subtle transition-colors"
            >
              <Ban size={14} className="text-[var(--status-danger)] shrink-0" aria-hidden="true" />
              <span>{product.blockAgenda}</span>
            </Link>
            <Link
              href="/owner/finance?action=new-sale"
              onClick={() => setOpen(false)}
              className="flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium text-ink hover:bg-subtle transition-colors"
            >
              <Receipt size={14} className="text-[var(--status-success)] shrink-0" aria-hidden="true" />
              <span>{product.newOrder}</span>
            </Link>
            <Link
              href="/owner/clients?action=new-client"
              onClick={() => setOpen(false)}
              className="flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium text-ink hover:bg-subtle transition-colors"
            >
              <UserPlus size={14} className="text-accent shrink-0" aria-hidden="true" />
              <span>{product.newClient}</span>
            </Link>
            <Link
              href="/owner/finance/payables?action=new-payable"
              onClick={() => setOpen(false)}
              className="flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium text-ink hover:bg-subtle transition-colors"
            >
              <Wallet size={14} className="text-[var(--status-warning)] shrink-0" aria-hidden="true" />
              <span>{product.newPayable}</span>
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
  const { t } = useLocale();
  const { product } = t;
  const [query, setQuery] = useState("");

  const searchItems = [
    { label: `${product.agenda} · ${product.calendar}`, href: "/owner/appointments", category: product.agenda, icon: CalendarDays },
    { label: product.clientBase, href: "/owner/clients", category: product.clients, icon: Users },
    { label: product.overviewReceipts, href: "/owner/finance", category: product.finance, icon: Receipt },
    { label: product.commissionsAdvances, href: "/owner/finance/commissions", category: product.finance, icon: Wallet },
    { label: product.accounts, href: "/owner/finance/payables", category: product.finance, icon: Wallet },
    { label: product.serviceListing, href: "/owner/services", category: product.services, icon: Wrench },
    { label: `${product.services} · ${product.categories}`, href: "/owner/services/categories", category: product.services, icon: Wrench },
    { label: product.packages, href: "/owner/services/packages", category: product.services, icon: Package },
    { label: product.productListingMovements, href: "/owner/inventory", category: product.productsInventory, icon: Package },
    { label: product.suppliers, href: "/owner/inventory/suppliers", category: product.productsInventory, icon: Package },
    { label: product.purchaseOrders, href: "/owner/inventory/purchase-orders", category: product.productsInventory, icon: Package },
    { label: product.financeReport, href: "/owner/reports/finance", category: product.reports, icon: ChartNoAxesCombined },
    { label: product.bookingLink, href: "/owner/booking-link", category: product.settings, icon: Smartphone },
    { label: "WhatsApp · Inbox & Atendimento", href: "/owner/whatsapp", category: "Recepcionista IA", icon: Smartphone },
    { label: "IA Intelligence · Radar & Funil IA", href: "/owner/intelligence", category: "IA Intelligence", icon: Sparkles },
    { label: "WhatsApp · Recepcionista IA & Conexão", href: "/owner/settings/whatsapp", category: "Recepcionista IA", icon: Smartphone },
    { label: product.settings, href: "/owner/settings", category: product.settings, icon: Settings },
  ];

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const filtered = searchItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase()),
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={product.globalSearch}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-black/50 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg rounded-xl border border-border-subtle bg-surface p-3.5 sm:p-4 shadow-2xl z-10 space-y-3">
        <div className="flex items-center gap-2 border-b border-border-subtle pb-2.5">
          <Search size={17} className="text-ink-muted shrink-0" aria-hidden="true" />
          <input
            autoFocus
            type="text"
            placeholder={product.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-base md:text-sm text-ink placeholder:text-ink-muted outline-none"
          />
          <kbd className="hidden sm:inline-flex rounded border border-border-subtle bg-subtle px-1.5 py-0.5 text-xs text-ink-muted font-mono">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="grid min-h-11 min-w-11 md:min-h-8 md:min-w-8 place-items-center rounded-lg text-ink-secondary hover:bg-subtle hover:text-ink cursor-pointer"
          >
            <X size={16} aria-hidden="true" />
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
                  className="flex min-h-10 items-center justify-between gap-2 rounded-lg px-2.5 py-2 hover:bg-subtle transition-colors text-xs text-ink"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-subtle text-accent">
                      <Icon size={14} aria-hidden="true" />
                    </span>
                    <span className="font-semibold truncate">{item.label}</span>
                  </div>
                  <span className="shrink-0 text-xs text-ink-muted font-mono rounded bg-canvas px-2 py-0.5">
                    {item.category}
                  </span>
                </Link>
              );
            })
          ) : (
            <p className="py-8 text-center text-xs text-ink-muted">
              {product.noSearchResults} &quot;{query}&quot;.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const COPILOT_MODULE_LABELS: Record<IntelligenceModule, string> = {
  AGENDA: "Agenda",
  FINANCE: "Financeiro",
  CLIENTS: "Clientes",
  SERVICES: "Serviços",
  INVENTORY: "Estoque",
  TEAM: "Equipe",
};

const COPILOT_SUGGESTIONS_BY_MODULE: Record<
  IntelligenceModule | "DEFAULT",
  string[]
> = {
  AGENDA: [
    "Quais horários estão mais ociosos nas próximas 48h?",
    "Como preencher os buracos da agenda de amanhã?",
    "Qual a taxa de cancelamentos e faltas neste mês?",
  ],
  FINANCE: [
    "Como está meu faturamento esta semana comparado à anterior?",
    "Quantas comandas abertas e comissões pendentes tenho hoje?",
    "Qual dia da semana mais gera receita no meu negócio?",
  ],
  CLIENTS: [
    "Quantos clientes estão sumidos há mais de 30 dias?",
    "Quais ações de retenção devo priorizar esta semana?",
    "Há alertas recentes de clientes insatisfeitos?",
  ],
  SERVICES: [
    "Quais serviços são mais agendados juntos para criar combos?",
    "Como posso aumentar o ticket médio com pacotes de serviços?",
    "Quais serviços trazem melhor retorno na agenda?",
  ],
  INVENTORY: [
    "Quais produtos estão perto do estoque mínimo?",
    "Tenho produtos parados há mais de 60 dias para fazer promoção?",
    "Como aumentar a venda de produtos na bancada?",
  ],
  TEAM: [
    "Qual profissional tem a maior taxa de retorno dos clientes?",
    "Algum profissional teve queda de avaliação ou agenda ociosa?",
    "Como equilibrar melhor a ocupação da equipe esta semana?",
  ],
  DEFAULT: [
    "Como está meu faturamento e comandas abertas hoje?",
    "Qual a taxa de conversão e principais objeções do WhatsApp?",
    "Quantos agendamentos tenho hoje e como está o mês?",
    "Quantos clientes inativos posso recuperar este mês?",
  ],
};

// ==========================================
// DRAWER DO COPILOTO IA (STREAMING SSE CONTEXTUAL)
// ==========================================
function AiCopilotDrawer({
  open,
  onClose,
  pathname,
  initialPrompt,
  forcedModule,
  onConsumeInitialPrompt,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
  initialPrompt?: string | null;
  forcedModule?: IntelligenceModule;
  onConsumeInitialPrompt?: () => void;
}) {
  const { locale } = useLocale();
  const es = locale === "es";
  const currentModule = forcedModule ?? resolveModuleFromPathname(pathname);

  const [messages, setMessages] = useState<
    Array<{ sender: "user" | "bot"; text: string }>
  >([
    {
      sender: "bot",
      text: es
        ? "¡Hola! Soy tu Copiloto IA de Gestión. Analizo tus ingresos, citas, comandas abiertas, comisiones pendientes, clientes inactivos y embudo de WhatsApp en tiempo real. ¿Cómo puedo ayudarte?"
        : "Olá! Sou seu Copiloto IA de Gestão. Analiso seus indicadores reais do módulo atual em tempo real com streaming. Como posso ajudar?",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const suggestedQuestions =
    COPILOT_SUGGESTIONS_BY_MODULE[currentModule ?? "DEFAULT"];

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open, thinking]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function handleSend(textToSend?: string) {
    const q = (textToSend ?? input).trim();
    if (!q || thinking) return;

    const historyPayload: CopilotHistoryMessage[] = messages
      .slice(-10)
      .map((item) => ({
        role: item.sender === "user" ? "user" : "assistant",
        content: item.text,
      }));

    setMessages((prev) => [
      ...prev,
      { sender: "user", text: q },
      { sender: "bot", text: "" },
    ]);
    setInput("");
    setThinking(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let receivedAnyChunk = false;

    try {
      await intelligenceApi.streamCopilot({
        message: q,
        currentModule,
        history: historyPayload,
        signal: controller.signal,
        onChunk: (chunk) => {
          receivedAnyChunk = true;
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.sender === "bot") {
              next[next.length - 1] = {
                ...last,
                text: `${last.text}${chunk}`,
              };
            }
            return next;
          });
        },
      });

      if (!receivedAnyChunk) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.sender === "bot" && !last.text) {
            next[next.length - 1] = {
              ...last,
              text: "Não recebi conteúdo da IA agora. Tente reformular sua pergunta.",
            };
          }
          return next;
        });
      }
    } catch {
      if (controller.signal.aborted) return;
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        const fallbackMsg = es
          ? "No pude consultar tus métricas en este momento. Intenta nuevamente en unos segundos."
          : "Não consegui consultar os indicadores agora. Tente novamente em alguns instantes.";
        if (last && last.sender === "bot" && !last.text) {
          next[next.length - 1] = { ...last, text: fallbackMsg };
        } else {
          next.push({ sender: "bot", text: fallbackMsg });
        }
        return next;
      });
    } finally {
      setThinking(false);
    }
  }

  useEffect(() => {
    if (!open || !initialPrompt || thinking) return;
    const promptToRun = initialPrompt;
    onConsumeInitialPrompt?.();
    void handleSend(promptToRun);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={es ? "Copiloto IA del Negocio" : "Copiloto IA do Negócio"}
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border-subtle bg-surface shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header do Copiloto */}
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink shadow-xs">
              <Bot size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-ink truncate">
                  {es ? "Copiloto IA del Negocio" : "Copiloto IA do Negócio"}
                </h3>
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                  {currentModule ? COPILOT_MODULE_LABELS[currentModule] : "Geral"}
                </span>
              </div>
              <p className="text-xs text-ink-muted truncate">
                {currentModule
                  ? `Contexto ativo: ${COPILOT_MODULE_LABELS[currentModule]} · Streaming em tempo real`
                  : "Dados reais de financeiro, agenda e WhatsApp"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={es ? "Cerrar" : "Fechar"}
            className="grid min-h-11 min-w-11 md:min-h-8 md:min-w-8 shrink-0 place-items-center rounded-lg text-ink-secondary hover:bg-subtle hover:text-ink cursor-pointer"
          >
            <X size={16} aria-hidden="true" />
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
                className={`max-w-[88%] whitespace-pre-wrap rounded-xl p-3 shadow-xs leading-relaxed ${
                  m.sender === "user"
                    ? "bg-accent text-accent-ink rounded-tr-xs font-medium"
                    : "border border-border-subtle bg-subtle/60 text-ink rounded-tl-xs"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-subtle/60 p-3 text-ink-muted">
                <Sparkles size={14} className="animate-spin text-accent" aria-hidden="true" />
                <span>
                  {es
                    ? "Analizando indicadores reales del negocio..."
                    : "Analisando indicadores reais do negócio..."}
                </span>
              </div>
            </div>
          )}

          {/* Sugestões rápidas */}
          {messages.length <= 2 && !thinking && (
            <div className="pt-2">
              <span className="mb-2 block text-xs font-semibold text-ink-muted">
                {es ? "Preguntas rápidas" : "Perguntas rápidas"}
              </span>
              <div className="space-y-1.5">
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => void handleSend(q)}
                    className="group flex min-h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-left text-xs text-ink transition-colors hover:border-accent hover:bg-subtle"
                  >
                    <span>{q}</span>
                    <ArrowRight
                      size={13}
                      aria-hidden="true"
                      className="shrink-0 text-ink-muted transition-colors group-hover:text-accent"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
          className="border-t border-border-subtle p-3"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={thinking}
              placeholder={
                es
                  ? "Pregunta sobre ingresos, agenda o WhatsApp..."
                  : "Pergunte sobre faturamento, agenda ou WhatsApp..."
              }
              className="h-10 flex-1 rounded-lg border border-border-strong bg-canvas/60 px-3 text-base md:text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={thinking || !input.trim()}
              aria-label={es ? "Enviar" : "Enviar"}
              className="grid min-h-11 min-w-11 md:min-h-10 md:min-w-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
            >
              <Send size={15} aria-hidden="true" />
            </button>
          </div>
        </form>
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
  const reducedMotion = useReducedMotion();
  const { t, locale, setLocale } = useLocale();
  const { mode, palette, setMode, setPalette } = useTheme();
  const { session, logout } = useSession();
  const { settings } = useCompanySettings(session.company.id);
  const onSettingsPage = pathname === "/owner/settings";
  const { place: googlePlace } = useGooglePlace(session.company.id, onSettingsPage ? null : settings.googlePlaceId, { summary: true });
  const companyRating = onSettingsPage ? settings.rating : displayCompanyRating(settings, googlePlace);

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotInitialPrompt, setCopilotInitialPrompt] = useState<string | null>(null);
  const [copilotForcedModule, setCopilotForcedModule] = useState<IntelligenceModule | undefined>(undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [flyout, setFlyout] = useState<{ group: string; pathname: string } | null>(null);
  const [whatsappState, setWhatsappState] = useState<EvolutionConnectionStatus | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(true);
  const [whatsappRefresh, setWhatsappRefresh] = useState(0);
  const isAgendaPage = pathname === "/owner/appointments";
  const whatsappConnected = whatsappState === "CONNECTED";
  const whatsappPending = whatsappState === "QRCODE_PENDING";
  const whatsappStatus = whatsappLoading
    ? t.common.loading
    : whatsappState === null
      ? (locale === "es" ? "Estado no disponible" : "Status indisponível")
      : whatsappConnected
        ? product.whatsappConnected
        : whatsappPending
          ? (locale === "es" ? "Esperando QR Code" : "Aguardando QR Code")
          : product.whatsappDisconnected;

  useEffect(() => {
    const request = new AbortController();
    void whatsappConnectionApi.get(request.signal)
      .then((connection) => {
        if (!request.signal.aborted) setWhatsappState(connection.evolution.status);
      })
      .catch(() => {
        if (!request.signal.aborted) setWhatsappState(null);
      })
      .finally(() => {
        if (!request.signal.aborted) setWhatsappLoading(false);
      });
    return () => request.abort();
  }, [session.company.id, whatsappRefresh]);

  useEffect(() => {
    const handleConnectionUpdated = () => {
      setWhatsappRefresh((value) => value + 1);
    };
    window.addEventListener(WHATSAPP_CONNECTION_UPDATED_EVENT, handleConnectionUpdated);
    return () => {
      window.removeEventListener(WHATSAPP_CONNECTION_UPDATED_EVENT, handleConnectionUpdated);
    };
  }, []);

  const whatsappIcon = <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[#25D366] text-[#0F172A]">
    <WhatsAppIcon className="size-[18px]" />
    <span aria-hidden="true" className={`absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-[#0F172A] ${whatsappLoading || whatsappState === null ? "bg-slate-400" : whatsappConnected ? "bg-emerald-400" : whatsappPending ? "bg-amber-400" : "bg-red-500"}`} />
  </span>;

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleOpenCopilot = (event: Event) => {
      const detail = (event as CustomEvent<OpenCopilotEventDetail | undefined>).detail;
      setCopilotForcedModule(detail?.module);
      setCopilotInitialPrompt(detail?.prompt ?? null);
      setCopilotOpen(true);
    };
    window.addEventListener(OPEN_COPILOT_EVENT, handleOpenCopilot);
    return () => window.removeEventListener(OPEN_COPILOT_EVENT, handleOpenCopilot);
  }, []);

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
      { href: "/owner/team", label: product.professionalsList },
    ] },
    { key: "reports", label: product.reports, icon: ChartNoAxesCombined, items: [
      { href: "/owner/reports", label: product.mainReport },
      { href: "/owner/reports/agenda", label: product.agendaReport },
      { href: "/owner/reports/finance", label: product.financeReport },
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
    // Garante que a tela de Comandas permaneça ativa em /owner/finance e /owner/finance/orders/*, mas não em comissões ou contas a pagar
    if (href === "/owner/finance") {
      return pathname === "/owner/finance" || pathname.startsWith("/owner/finance/orders");
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
    // Garante que a Inbox do WhatsApp não fique ativa na sub-rota /intelligence
    if (href === "/owner/whatsapp") {
      return pathname === "/owner/whatsapp";
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
        isAgendaPage ? "h-dvh overflow-hidden" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* ======================================================== */}
      {/* 1. TOPBAR GLOBAL DE LARGURA INTEIRA (W-FULL) */}
      {/* ======================================================== */}
      <header data-shell-header className="sticky top-0 z-40 h-14 w-full border-b border-border-subtle bg-surface/95 backdrop-blur-md">
        <div className="flex h-full w-full items-center justify-between gap-2 px-3 sm:px-4 lg:px-5">
          {/* Esquerda: Botão Menu/Colapsar + Logo + Atalhos (Tablet/Desktop) */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-0">
            {/* Botão Hambúrguer (Mobile e Tablet < lg) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label={product.openMenu}
              title={product.openMenu}
              className="grid lg:hidden min-h-11 min-w-11 md:min-h-9 md:min-w-9 md:h-9 md:w-9 shrink-0 place-items-center rounded-lg border border-border-subtle bg-surface text-ink-secondary hover:border-border-strong hover:text-ink transition-colors cursor-pointer"
            >
              <Menu className="size-4" aria-hidden="true" />
            </button>

            {/* Botão Colapsar Sidebar (Desktop >= lg) */}
            <button
              type="button"
              onClick={() => { setFlyout(null); toggle(); }}
              aria-label={collapsed ? t.common.expandSidebar : t.common.collapseSidebar}
              title={collapsed ? t.common.expandSidebar : t.common.collapseSidebar}
              className="hidden lg:grid size-9 shrink-0 place-items-center rounded-lg border border-border-subtle bg-surface text-ink-secondary hover:border-border-strong hover:text-ink transition-colors cursor-pointer"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="size-4" aria-hidden="true" />
              )}
            </button>

            {/* Logo e Nome do Sistema */}
            <BrandMark appName={t.common.appName} />

            {/* Atalhos Rápidos na Topbar (Tablet e Desktop >= md) */}
            <div className="hidden md:flex items-center gap-1.5 border-l border-border-subtle pl-2.5 shrink-0">
              <Link
                href="/owner/appointments"
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  pathname === "/owner/appointments"
                    ? "bg-accent-soft text-accent border border-accent/25"
                    : "border border-border-subtle bg-surface text-ink-secondary hover:text-ink hover:border-border-strong"
                }`}
                title={product.calendarShortcut}
              >
                <CalendarDays size={14} className="text-accent shrink-0" aria-hidden="true" />
                <span>{product.calendarShortcut}</span>
              </Link>

              <QuickCreateDropdown product={product} />
            </div>
          </div>

          {/* Direita Mobile (< md): controles compactos com alvos táteis >= 44px */}
          <div className="flex md:hidden items-center gap-1 shrink-0">
            <QuickCreateDropdown product={product} compact align="right" />
            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              aria-label="Copiloto IA"
              title="Copiloto IA"
              className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-accent/35 bg-accent-soft text-accent hover:bg-accent/15 transition-colors cursor-pointer"
            >
              <Bot size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={product.globalSearch ?? "Busca Global"}
              title={product.globalSearch ?? "Busca Global"}
              className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-border-subtle bg-surface text-ink-secondary hover:text-ink hover:border-border-strong transition-colors cursor-pointer"
            >
              <Search size={16} aria-hidden="true" />
            </button>
            <NotificationsBell />
          </div>

          {/* Direita Tablet & Desktop (>= md): altura unificada h-9 */}
          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            {/* 1) CTA Assine Agora (exibido apenas no Free Trial em desktop >= lg) */}
            {isTrial && (
              <Link
                href="/owner/settings"
                className="hidden lg:inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent hover:bg-accent-hover px-3 text-xs font-semibold text-accent-ink transition-colors shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                title={product.seePlans}
              >
                <Crown size={14} className="text-amber-300 fill-amber-300 shrink-0" aria-hidden="true" />
                <span>{product.subscribeNow}</span>
              </Link>
            )}

            {/* 2) Botão do Copiloto IA de Gestão */}
            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              aria-label={locale === "es" ? "Copiloto IA del Negocio" : "Copiloto IA do Negócio"}
              title={locale === "es" ? "Copiloto IA del Negocio" : "Copiloto IA do Negócio"}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-soft px-2.5 text-xs font-semibold text-accent hover:bg-accent/15 transition-colors cursor-pointer"
            >
              <Bot size={15} aria-hidden="true" />
              <span className="hidden xl:inline whitespace-nowrap">Copiloto IA</span>
            </button>

            {/* 3) Botão de Busca Global (Ctrl + K) */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={product.globalSearch ?? "Busca Global (Ctrl + K)"}
              title={product.globalSearch ?? "Busca Global (Ctrl + K)"}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-border-subtle bg-surface text-ink-secondary hover:text-ink hover:border-border-strong transition-colors cursor-pointer"
            >
              <Search size={15} aria-hidden="true" />
            </button>

            {/* 4) Botão de Privacidade (Eye / EyeOff) */}
            <button
              type="button"
              onClick={togglePrivacy}
              aria-label={hideSensitiveValues ? product.privacyOff : product.privacyOn}
              title={hideSensitiveValues ? product.privacyOff : product.privacyOn}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-border-subtle bg-surface text-ink-secondary hover:text-ink hover:border-border-strong transition-colors cursor-pointer"
            >
              {hideSensitiveValues ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            </button>

            {/* 5) Notificações */}
            <NotificationsBell />

            {/* 6) Link de Agendamento */}
            <Link
              href="/owner/booking-link"
              aria-label={product.bookingLink ?? "Link de Agendamento"}
              title={product.bookingLink ?? "Link de Agendamento"}
              className={`grid size-9 shrink-0 place-items-center rounded-lg border transition-colors cursor-pointer ${
                pathname === "/owner/booking-link"
                  ? "bg-accent-soft text-accent border-accent/35"
                  : "border-border-subtle bg-surface text-ink-secondary hover:text-ink hover:border-border-strong"
              }`}
            >
              <Smartphone size={15} aria-hidden="true" />
            </Link>

            {/* 7) Consumo do plano */}
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
          <aside className="owner-sidebar relative z-10 flex h-full w-72 max-w-[85vw] flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--ink-primary)] shadow-2xl animate-in slide-in-from-left duration-200 [&_a]:cursor-pointer [&_button]:cursor-pointer">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <CompanyAvatar url={session.company.avatarUrl ?? session.avatarUrl} />
                <div className="min-w-0">
                  <p title={session.company.companyName} className="line-clamp-2 min-w-0 wrap-anywhere text-sm leading-tight font-semibold">
                    {session.company.companyName}
                  </p>
                  {companyRating && (
                    <div className="mt-1">
                      <CompanyRating rating={companyRating} />
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label={product.closeMenu}
                className={`grid min-h-11 min-w-11 shrink-0 cursor-pointer place-items-center rounded-lg ${sidebarInactive}`}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Hub Recepcionista IA (WhatsApp) no Drawer Mobile */}
            <div className="mx-3 mt-3 space-y-1.5">
              <div
                className={`rounded-xl border p-2.5 transition-colors ${
                  pathname.startsWith("/owner/whatsapp") || pathname === "/owner/settings/whatsapp"
                    ? "border-[var(--status-success)]/45 bg-[var(--status-success)]/12"
                    : "border-[var(--border-subtle)] bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {whatsappIcon}
                  <div className="min-w-0">
                    <span className="block text-sm font-semibold tracking-tight">Recepcionista IA</span>
                    <span className={`block text-xs font-medium ${whatsappConnected ? "text-[var(--status-success)]" : "text-slate-300"}`}>
                      {whatsappStatus}
                    </span>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <Link
                    href="/owner/whatsapp"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setFlyout(null);
                    }}
                    className={`rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold transition-colors ${
                      pathname === "/owner/whatsapp"
                        ? "bg-accent text-accent-ink"
                        : "bg-white/8 text-slate-200 hover:bg-white/15"
                    }`}
                  >
                    Inbox & Atendimento
                  </Link>
                  <Link
                    href="/owner/settings/whatsapp"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setFlyout(null);
                    }}
                    className={`rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold transition-colors ${
                      pathname === "/owner/settings/whatsapp"
                        ? "bg-accent text-accent-ink"
                        : "bg-white/8 text-slate-200 hover:bg-white/15"
                    }`}
                  >
                    Conexão & IA
                  </Link>
                </div>
              </div>

              <Link
                href="/owner/intelligence"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setFlyout(null);
                }}
                aria-current={isActive("/owner/intelligence") ? "page" : undefined}
                className={`flex min-h-10 items-center gap-2.5 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                  isActive("/owner/intelligence")
                    ? "border-accent/45 bg-accent/15 text-white"
                    : "border-[var(--border-subtle)] bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                <Sparkles className="size-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="truncate">IA Intelligence</span>
                {isActive("/owner/intelligence") && sidebarActiveDot}
              </Link>
            </div>

            {/* Ações de Plano, Link de Agendamento, Consumo e Privacidade no Mobile */}
            <div className="mx-3 mt-3 space-y-2 border-b border-[var(--border-subtle)] pb-3">
              {isTrial && (
                <Link
                  href="/owner/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-accent hover:bg-accent-hover px-3.5 py-2 text-xs font-semibold text-accent-ink transition-colors shadow-xs"
                >
                  <Crown size={14} className="text-amber-300 fill-amber-300 shrink-0" aria-hidden="true" />
                  <span>{product.subscribeNow}</span>
                </Link>
              )}

              <div className="grid grid-cols-2 gap-1.5">
                <Link
                  href="/owner/booking-link"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-10 items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
                >
                  <Smartphone size={14} className="text-accent shrink-0" aria-hidden="true" />
                  <span className="truncate">{product.onlineLinkShort}</span>
                </Link>
                <Link
                  href="/owner/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-10 items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
                >
                  <Gauge size={14} className="text-accent shrink-0" aria-hidden="true" />
                  <span className="truncate">{product.usageShort}</span>
                </Link>
              </div>

              <button
                type="button"
                onClick={togglePrivacy}
                className="flex min-h-10 w-full items-center justify-between rounded-lg bg-white/5 px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5">
                  {hideSensitiveValues ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                  <span>{hideSensitiveValues ? product.privacyOff : product.privacyOn}</span>
                </span>
              </button>
            </div>

            {/* Navegação Acordeão no Drawer Mobile */}
            <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
              {navGroups.map((group) => {
                const Icon = group.icon;
                const isSelected = group.items.some((item) => item.href && isActive(item.href));
                const expanded = activeGroup === group.key;
                return (
                  <div key={group.key}>
                    <button
                      type="button"
                      onClick={() => setActiveGroup((prev) => (prev === group.key ? null : group.key))}
                      aria-expanded={expanded}
                      className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors ${
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
                      <div className="ml-4 space-y-0.5 border-l border-[var(--border-subtle)] py-1 pl-2">
                        {group.items.map((item, index) =>
                          item.href ? (
                            <Link
                              key={`${group.key}-${item.label}-${index}`}
                              href={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              aria-current={isActive(item.href) ? "page" : undefined}
                              className={`flex min-h-10 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${isActive(item.href) ? sidebarActive : sidebarInactive}`}
                            >
                              {item.label}
                              {isActive(item.href) && sidebarActiveDot}
                            </Link>
                          ) : (
                            <span
                              key={`${group.key}-${item.label}-${index}`}
                              className="flex min-h-9 items-center justify-between gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-400"
                            >
                              <span className="truncate">{item.label}</span>
                              <span className="text-xs shrink-0 opacity-75">{product.comingSoon}</span>
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
                className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-medium ${
                  isActive("/owner/settings") ? sidebarActive : sidebarInactive
                }`}
              >
                <Settings className="size-4 shrink-0" aria-hidden="true" />
                <span>{product.settings}</span>
                {isActive("/owner/settings") && sidebarActiveDot}
              </Link>
            </nav>

            <div className="border-t border-[var(--border-subtle)] p-3">
              <button
                type="button"
                onClick={logout}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-white/5 text-xs font-semibold text-slate-200 hover:bg-white/10 cursor-pointer"
              >
                <LogOut className="size-4 shrink-0" aria-hidden="true" />
                <span>{t.common.logout}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. CORPO: SIDEBAR FIXA ABAIXO DO HEADER + CONTEÚDO PRINCIPAL */}
      {/* ======================================================== */}
      <div className="flex min-h-0 min-w-0 flex-1">
        {/* Sidebar retrátil à esquerda (desktop) */}
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 76 : 232 }}
          transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="owner-sidebar hidden overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--ink-primary)] lg:fixed lg:top-14 lg:bottom-0 lg:z-30 lg:flex lg:flex-col [&_a]:cursor-pointer [&_button]:cursor-pointer"
        >
          {/* Topo da Sidebar: Nome da Empresa e Avaliação */}
          <div
            className={[
              "flex items-center border-b border-[var(--border-subtle)] py-3",
              collapsed ? "justify-center px-2" : "gap-2.5 px-3",
            ].join(" ")}
          >
            <CompanyAvatar url={session.company.avatarUrl ?? session.avatarUrl} />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p title={session.company.companyName} className="line-clamp-2 min-w-0 wrap-anywhere text-sm leading-tight font-semibold">
                  {session.company.companyName}
                </p>
                {companyRating && (
                  <div className="mt-1">
                    <CompanyRating rating={companyRating} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hub Recepcionista IA (WhatsApp) na Sidebar */}
          {collapsed ? (
            <div className="mx-2.5 mt-2.5 space-y-1.5">
              <Link
                href="/owner/whatsapp"
                onClick={() => setFlyout(null)}
                aria-label={`Recepcionista IA · ${whatsappStatus}`}
                title={`Recepcionista IA (Inbox) · ${whatsappStatus}`}
                className={`flex cursor-pointer items-center justify-center rounded-xl border py-2 transition-colors ${
                  pathname.startsWith("/owner/whatsapp") || pathname === "/owner/settings/whatsapp"
                    ? "border-[var(--status-success)]/45 bg-[var(--status-success)]/12"
                    : "border-[var(--border-subtle)] bg-white/5 hover:bg-white/10"
                }`}
              >
                {whatsappIcon}
              </Link>
              <Link
                href="/owner/intelligence"
                onClick={() => setFlyout(null)}
                aria-label="IA Intelligence"
                title="IA Intelligence"
                className={`relative flex min-h-10 cursor-pointer items-center justify-center rounded-xl border transition-colors ${
                  isActive("/owner/intelligence")
                    ? "border-accent/45 bg-accent/15 text-white"
                    : "border-[var(--border-subtle)] bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                <Sparkles className="size-4 text-accent" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="mx-2.5 mt-2.5 space-y-1.5">
              <div
                className={`rounded-xl border p-2.5 transition-colors ${
                  pathname.startsWith("/owner/whatsapp") || pathname === "/owner/settings/whatsapp"
                    ? "border-[var(--status-success)]/45 bg-[var(--status-success)]/12"
                    : "border-[var(--border-subtle)] bg-white/5"
                }`}
              >
                <Link
                  href="/owner/whatsapp"
                  onClick={() => setFlyout(null)}
                  className="flex items-center gap-2.5 text-left"
                >
                  {whatsappIcon}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">WhatsApp</span>
                    <span className={`block text-xs font-medium ${whatsappConnected ? "text-[var(--status-success)]" : "text-slate-300"}`}>
                      {whatsappStatus}
                    </span>
                  </span>
                </Link>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <Link
                    href="/owner/whatsapp"
                    onClick={() => setFlyout(null)}
                    className={`rounded-lg px-2 py-1 text-center text-[11px] font-semibold transition-colors ${
                      pathname === "/owner/whatsapp"
                        ? "bg-accent text-accent-ink"
                        : "bg-white/8 text-slate-200 hover:bg-white/15"
                    }`}
                  >
                    Inbox
                  </Link>
                  <Link
                    href="/owner/settings/whatsapp"
                    onClick={() => setFlyout(null)}
                    className={`rounded-lg px-2 py-1 text-center text-[11px] font-semibold transition-colors ${
                      pathname === "/owner/settings/whatsapp"
                        ? "bg-accent text-accent-ink"
                        : "bg-white/8 text-slate-200 hover:bg-white/15"
                    }`}
                  >
                    Conexão & IA
                  </Link>
                </div>
              </div>

              {/* Novo Menu Principal: IA Intelligence */}
              <Link
                href="/owner/intelligence"
                onClick={() => setFlyout(null)}
                aria-current={isActive("/owner/intelligence") ? "page" : undefined}
                className={`relative flex min-h-10 items-center gap-2.5 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                  isActive("/owner/intelligence")
                    ? "border-accent/45 bg-accent/15 text-white"
                    : "border-[var(--border-subtle)] bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Sparkles className="size-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="truncate">IA Intelligence</span>
                {isActive("/owner/intelligence") && sidebarActiveDot}
              </Link>
            </div>
          )}

          {/* Navegação da Sidebar com Acordeão Único */}
          <nav
            aria-label="Navegação do proprietário"
            className="min-w-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2 py-2.5"
          >
            {navGroups.map((group) => {
              const Icon = group.icon;
              const isSelected = group.items.some((item) => item.href && isActive(item.href));
              const expanded = activeGroup === group.key;
              const flyoutOpen = flyout?.group === group.key && flyout.pathname === pathname;
              const items = group.items.map((item) => item.href ? (
                <Link key={item.href} href={item.href} onClick={() => setFlyout(null)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${isActive(item.href) ? sidebarActive : sidebarInactive}`}>
                  {item.label}{isActive(item.href) && sidebarActiveDot}
                </Link>
              ) : (
                <span key={item.label} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs text-slate-400">
                  {item.label}<span className="shrink-0 text-xs opacity-75">{product.comingSoon}</span>
                </span>
              ));
              if (collapsed) return (
                <Popover.Root key={group.key} open={flyoutOpen} onOpenChange={(open) =>
                  setFlyout((current) => open ? { group: group.key, pathname } : current?.group === group.key ? null : current)}>
                  <Popover.Trigger aria-label={group.label} title={group.label}
                    className={`relative flex min-h-10 w-full cursor-pointer items-center justify-center rounded-lg transition-colors ${isSelected || flyoutOpen ? sidebarActive : sidebarInactive}`}>
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {isSelected && <span className="absolute right-2">{sidebarActiveDot}</span>}
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Positioner side="right" align="start" sideOffset={14} className="z-50">
                      <Popover.Popup className="owner-sidebar max-h-[var(--available-height)] w-60 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-2 text-[var(--ink-primary)] shadow-lg outline-none">
                        <Popover.Title className="px-2.5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300">{group.label}</Popover.Title>
                        <div className="space-y-0.5">{items}</div>
                      </Popover.Popup>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>
              );
              return (
                <div key={group.key} className="min-w-0">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setActiveGroup((prev) => prev === group.key ? null : group.key)}
                    className={`relative flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors ${isSelected ? sidebarActive : sidebarInactive}`}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
                    {isSelected && !expanded ? sidebarActiveDot : <ChevronDown
                      className={`size-3.5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />}
                  </button>
                  {expanded && <div className="ml-4 space-y-0.5 border-l border-[var(--border-subtle)] py-1 pl-2">{items}</div>}
                </div>
              );
            })}
            <Link
              href="/owner/settings"
              aria-current={isActive("/owner/settings") ? "page" : undefined}
              className={`relative flex min-h-10 items-center rounded-lg text-sm font-medium ${
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
          <div className="space-y-2 border-t border-[var(--border-subtle)] p-2.5">
            <Link
              href="/owner/settings"
              title={collapsed ? session.name : undefined}
              className={[
                "flex min-w-0 items-center rounded-lg bg-white/5 transition-colors hover:bg-white/10 cursor-pointer",
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
                  <p className="truncate text-xs font-semibold">
                    {session.name}
                  </p>
                  <p className="truncate text-xs text-slate-300">
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
                "flex min-h-10 w-full items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-white/5 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white cursor-pointer",
                collapsed ? "px-0" : "gap-2 px-3",
              ].join(" ")}
            >
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
              {!collapsed && <span>{t.common.logout}</span>}
            </button>
          </div>
        </motion.aside>

        {/* Conteúdo principal */}
        <div
          className={[
            "flex flex-1 flex-col min-w-0 transition-[padding] duration-220 ease-out",
            collapsed ? "lg:pl-[76px]" : "lg:pl-[232px]",
          ].join(" ")}
        >
          <main className={`w-full flex-1 px-3.5 sm:px-5 lg:px-6 ${isAgendaPage ? "min-h-0 overflow-hidden pt-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-4" : "py-5 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:py-6 lg:pb-10"}`}>
            {children}
          </main>
        </div>
      </div>

      {/* Bottom Bar Mobile com safe-area e 5 atalhos principais */}
      <nav
        aria-label="Navegação móvel"
        className="owner-sidebar fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--surface-elevated)]/95 pb-[env(safe-area-inset-bottom)] text-[var(--ink-primary)] backdrop-blur-md lg:hidden shadow-lg"
      >
        <div className="grid w-full max-w-lg grid-cols-5 mx-auto">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 py-1.5 text-xs font-medium transition-colors",
                  active ? "text-accent font-semibold" : "text-slate-300 hover:text-white",
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

      {/* Modal de Busca Global */}
      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Drawer do Copiloto IA Contextual com Streaming SSE */}
      <AiCopilotDrawer
        open={copilotOpen}
        onClose={() => {
          setCopilotOpen(false);
          setCopilotForcedModule(undefined);
        }}
        pathname={pathname}
        initialPrompt={copilotInitialPrompt}
        forcedModule={copilotForcedModule}
        onConsumeInitialPrompt={() => setCopilotInitialPrompt(null)}
      />
    </div>
  );
}
