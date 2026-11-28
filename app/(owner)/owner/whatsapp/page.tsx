"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CalendarCheck2,
  CheckCircle2,
  FlaskConical,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { AgendaDialog } from "@/components/ui/agenda-controls";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { agendaClock, parseAgendaDate } from "@/lib/agenda";
import { ApiError } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import {
  whatsappInboxApi,
  type AiExecutedToolAction,
  type WhatsAppAssignedMode,
  type WhatsAppConversationItem,
  type WhatsAppMessageItem,
} from "@/lib/whatsapp-inbox";
import { WhatsAppTabs } from "./_components/whatsapp-tabs";

const fieldClass =
  "h-10 w-full rounded-xl border border-border-subtle bg-canvas/50 px-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25";

function getInitials(name?: string | null, phone?: string): string {
  const source = name?.trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (phone ?? "WA").replace(/\D/g, "").slice(-2) || "WA";
}

function formatMessageTime(iso: string, locale: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatConversationTime(iso: string, locale: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return formatMessageTime(iso, locale);
  }
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatToolLabel(
  tool: AiExecutedToolAction["tool"] | string | undefined,
  es: boolean,
): string | null {
  switch (tool) {
    case "listar_servicos_e_profissionais":
      return es ? "Catálogo consultado" : "Catálogo consultado";
    case "consultar_horarios_livres":
      return es ? "Disponibilidad consultada" : "Horários consultados";
    case "criar_agendamento":
      return es ? "Cita creada en agenda" : "Agendamento criado na agenda";
    case "reagendar_agendamento":
      return es ? "Cita reagendada" : "Agendamento reagendado";
    case "cancelar_agendamento":
      return es ? "Cita cancelada" : "Agendamento cancelado";
    default:
      return null;
  }
}

function bookingAgendaHref(
  action: AiExecutedToolAction,
  message: string,
  clock: ReturnType<typeof agendaClock>,
) {
  const data = action.data && typeof action.data === "object"
    ? action.data as Record<string, unknown>
    : undefined;
  const appointmentId = [data?.appointmentId, data?.id, action.input?.appointmentId]
    .find((id): id is string => typeof id === "string" && id.trim().length > 0);

  let date: string | undefined;
  for (const metadata of [data, action.input]) {
    date = parseAgendaDate(metadata?.date) ?? parseAgendaDate(metadata?.localDate);
    if (date) break;

    const startsAt = metadata?.startsAt;
    if (typeof startsAt !== "string") continue;
    const localDate = parseAgendaDate(startsAt.slice(0, 10));
    if (!localDate) continue;
    if (startsAt === localDate) {
      date = localDate;
      break;
    }

    const instant = Date.parse(startsAt);
    if (Number.isFinite(instant)) {
      date = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(startsAt) ? clock(instant).date : localDate;
      break;
    }
  }

  if (!date) {
    for (const [, day, month, year] of message.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
      date = parseAgendaDate(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
      if (date) break;
    }
  }

  return {
    pathname: "/owner/agenda",
    query: {
      ...(date ? { date } : {}),
      ...(appointmentId ? { appointmentId: appointmentId.trim() } : {}),
    },
  };
}

export default function WhatsAppInboxPage() {
  const { locale } = useLocale();
  const { session } = useSession();
  const timezone = session.company?.timezone || "America/Sao_Paulo";
  const clock = useMemo(() => agendaClock(timezone), [timezone]);
  const es = locale === "es";

  const [conversations, setConversations] = useState<WhatsAppConversationItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<"ALL" | WhatsAppAssignedMode>("ALL");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const initialConversationIdRef = useRef<string | null>(null);
  const [activeConversation, setActiveConversation] =
    useState<WhatsAppConversationItem | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [togglingMode, setTogglingMode] = useState(false);

  // Estado do Modal Simulador de Cliente (Modo Teste)
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simPhone, setSimPhone] = useState("+5511999990001");
  const [simName, setSimName] = useState("Cliente Teste");
  const [simContent, setSimContent] = useState("");
  const [simulating, setSimulating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingList(true);
      try {
        const res = await whatsappInboxApi.listConversations({
          search,
          assignedMode: modeFilter,
        });
        setConversations(res.conversations);
        setSelectedId((current) => {
          const requestedId = initialConversationIdRef.current;
          if (requestedId && res.conversations.some((c) => c.id === requestedId)) {
            initialConversationIdRef.current = null;
            return requestedId;
          }
          if (current && res.conversations.some((c) => c.id === current)) {
            return current;
          }
          return res.conversations[0]?.id ?? null;
        });
      } catch (error) {
        if (!silent) {
          toast.error(
            error instanceof ApiError
              ? error.message
              : es
                ? "No fue posible cargar las conversaciones."
                : "Não foi possível carregar as conversas.",
          );
        }
      } finally {
        if (!silent) setLoadingList(false);
      }
    },
    [es, modeFilter, search],
  );

  const loadMessages = useCallback(
    async (conversationId: string, silent = false) => {
      if (!silent) setLoadingMessages(true);
      try {
        const res = await whatsappInboxApi.getMessages(conversationId);
        setActiveConversation(res.conversation);
        setMessages(res.messages);
        setConversations((prev) =>
          prev.map((item) =>
            item.id === res.conversation.id
              ? { ...item, ...res.conversation, unreadCount: 0 }
              : item,
          ),
        );
      } catch (error) {
        if (!silent) {
          toast.error(
            error instanceof ApiError
              ? error.message
              : es
                ? "No fue posible cargar el historial."
                : "Não foi possível carregar o histórico de mensagens.",
          );
        }
      } finally {
        if (!silent) setLoadingMessages(false);
      }
    },
    [es],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("conversationId")?.trim();
    if (requested) {
      initialConversationIdRef.current = requested;
      setSelectedId(requested);
    }
  }, []);

  useEffect(() => {
    void loadConversations(false);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) {
      setActiveConversation(null);
      setMessages([]);
      return;
    }
    void loadMessages(selectedId, false);
  }, [selectedId, loadMessages]);

  // Atualização em tempo real leve (polling a cada 4s enquanto a aba está visível)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadConversations(true);
      if (selectedId) {
        void loadMessages(selectedId, true);
      }
    }, 4_000);
    return () => clearInterval(interval);
  }, [loadConversations, loadMessages, selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedId]);

  async function handleSendManualMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId || !draft.trim() || sending) return;

    setSending(true);
    try {
      const res = await whatsappInboxApi.sendOwnerMessage(selectedId, draft.trim());
      setDraft("");
      setActiveConversation(res.conversation);
      setMessages((prev) => [...prev, res.message]);
      setConversations((prev) =>
        prev.map((c) => (c.id === res.conversation.id ? res.conversation : c)),
      );
      // Dispara refetch imediato de mensagens e conversas sem aguardar o próximo ciclo de polling (4s).
      await Promise.all([
        loadMessages(selectedId, true),
        loadConversations(true),
      ]);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : es
            ? "No fue posible enviar el mensaje."
            : "Não foi possível enviar a mensagem.",
      );
    } finally {
      setSending(false);
    }
  }

  function isConversationAiPaused(conv: WhatsAppConversationItem): boolean {
    if (conv.assignedMode !== "AI_AUTOPILOT") return true;
    if (conv.aiPausedUntil) {
      const until = Date.parse(conv.aiPausedUntil);
      if (!Number.isNaN(until) && until > Date.now()) {
        return true;
      }
    }
    return false;
  }

  async function handleToggleMode() {
    if (!activeConversation || togglingMode) return;
    const currentlyPaused = isConversationAiPaused(activeConversation);

    setTogglingMode(true);
    try {
      const updated = currentlyPaused
        ? await whatsappInboxApi.resumeAi(activeConversation.id)
        : await whatsappInboxApi.pauseAi(activeConversation.id);

      // Faz merge apenas dos campos de estado atualizados para preservar messages e dados locais da conversa.
      setActiveConversation((prev) =>
        prev
          ? {
              ...prev,
              assignedMode: updated.assignedMode,
              aiPausedUntil: updated.aiPausedUntil,
              status: updated.status,
              updatedAt: updated.updatedAt,
              ...(prev.messages ? { messages: prev.messages } : {}),
            }
          : updated,
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === updated.id
            ? {
                ...c,
                assignedMode: updated.assignedMode,
                aiPausedUntil: updated.aiPausedUntil,
                status: updated.status,
                updatedAt: updated.updatedAt,
              }
            : c,
        ),
      );
      toast.success(
        currentlyPaused
          ? es
            ? "IA reactivada para esta conversación."
            : "IA reativada para esta conversa!"
          : es
            ? "Conversación asumida: IA pausada."
            : "Conversa assumida: IA pausada para atendimento manual.",
      );
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : es
            ? "No fue posible cambiar el estado de la IA."
            : "Não foi possível alterar o status da IA nesta conversa.",
      );
    } finally {
      setTogglingMode(false);
    }
  }

  async function handleSimulateInbound(event: React.FormEvent) {
    event.preventDefault();
    if (!simPhone.trim() || !simContent.trim() || simulating) return;

    setSimulating(true);
    try {
      const res = await whatsappInboxApi.simulateInbound({
        phone: simPhone.trim(),
        contactName: simName.trim() || undefined,
        content: simContent.trim(),
      });

      setSimContent("");
      setSimulatorOpen(false);
      setSelectedId(res.conversation.id);
      // Atualiza lista de conversas e histórico em paralelo imediatamente após o processamento da IA.
      await Promise.all([
        loadConversations(true),
        loadMessages(res.conversation.id, true),
      ]);

      const bookedAction = res.aiActions.find(
        (action) => action.tool === "criar_agendamento" && action.ok,
      );
      if (bookedAction) {
        toast.success(
          es
            ? "¡El agente IA creó una cita real en la agenda!"
            : "O agente de IA criou um agendamento real na agenda!",
        );
      } else {
        toast.success(
          es
            ? "Mensaje simulado procesado por el pipeline real."
            : "Mensagem simulada processada pelo pipeline real.",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : es
            ? "Error al simular mensaje del cliente."
            : "Erro ao simular mensagem do cliente.",
      );
    } finally {
      setSimulating(false);
    }
  }

  const quickSimulatorPrompts = useMemo(
    () =>
      es
        ? [
            "Hola, ¿qué servicios y precios tienen?",
            "¿Qué horarios libres tienen hoy?",
            "Quiero agendar un corte hoy",
          ]
        : [
            "Olá, quais serviços e preços vocês têm?",
            "Quais horários livres vocês têm hoje?",
            "Quero agendar um corte hoje",
          ],
    [es],
  );

  return (
    <div className="space-y-4">
      {/* Cabeçalho da Inbox */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="flex items-center gap-2.5 text-xl sm:text-2xl font-bold tracking-tight text-ink">
            <span className="grid size-9 place-items-center rounded-xl bg-[#25D366]/15 text-[#25D366]">
              <WhatsAppIcon className="size-5" />
            </span>
            {es ? "Inbox & Atención WhatsApp" : "Inbox & Atendimento WhatsApp"}
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted">
            {es
              ? "Supervisa las respuestas del Agente IA en tiempo real o asume conversaciones manualmente en 1 clic."
              : "Acompanhe o Agente de IA agendando em tempo real ou assuma conversas manualmente em 1 clique."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => setSimulatorOpen(true)}
            className="rounded-xl bg-accent text-accent-ink hover:bg-accent-hover text-xs font-semibold shadow-xs"
          >
            <FlaskConical size={14} />
            {es ? "Simular Cliente" : "Simular Cliente"}
          </Button>

          <Link
            href="/owner/settings/whatsapp"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 text-xs font-semibold text-ink-secondary hover:border-accent hover:text-ink transition-colors"
          >
            <Settings size={14} />
            {es ? "Conexión e IA" : "Conexão & IA"}
          </Link>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void loadConversations(false);
              if (selectedId) void loadMessages(selectedId, false);
            }}
            className="rounded-xl border-border-subtle bg-surface text-xs font-semibold text-ink"
          >
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* Barra de abas compartilhada (Inbox | Intelligence) */}
      <WhatsAppTabs active="inbox" />

      {/* Container 2 Colunas: Lista de Conversas + Chat */}
      <div className="grid min-h-[68vh] grid-cols-1 overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-xs lg:grid-cols-[340px_1fr]">
        {/* Coluna Esquerda: Lista de Conversas */}
        <aside className="flex flex-col border-b border-border-subtle lg:border-r lg:border-b-0">
          <div className="space-y-2.5 border-b border-border-subtle p-3">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  es
                    ? "Buscar por nombre o teléfono..."
                    : "Buscar por nome ou telefone..."
                }
                className="h-9 w-full rounded-xl border border-border-subtle bg-canvas/50 pl-9 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-1 rounded-xl bg-canvas/60 p-1 text-[11px] font-semibold">
              {(
                [
                  { id: "ALL", label: es ? "Todas" : "Todas" },
                  { id: "AI_AUTOPILOT", label: es ? "IA Activa" : "IA Ativa" },
                  { id: "HUMAN", label: es ? "Manual" : "Manual" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setModeFilter(tab.id)}
                  className={`rounded-lg py-1.5 transition-colors cursor-pointer ${
                    modeFilter === tab.id
                      ? "bg-surface text-ink shadow-xs"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[38vh] flex-1 overflow-y-auto divide-y divide-border-subtle/60 lg:max-h-[62vh]">
            {loadingList ? (
              <div className="flex flex-col items-center justify-center py-14 text-xs text-ink-muted">
                <Loader2 className="mb-2 size-5 animate-spin text-accent" />
                {es ? "Cargando conversaciones..." : "Carregando conversas..."}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
                <MessageSquare className="mb-2 size-7 text-ink-muted/60" />
                <p className="text-xs font-semibold text-ink">
                  {es ? "Sin conversaciones todavía" : "Nenhuma conversa ainda"}
                </p>
                <p className="mt-1 text-[11px] text-ink-muted">
                  {es
                    ? "Usa 'Simular Cliente' arriba para probar el agente de agendamiento ahora mismo."
                    : "Use 'Simular Cliente' acima para testar o agente de agendamento agora mesmo."}
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv.id === selectedId;
                const isAi = conv.assignedMode === "AI_AUTOPILOT";
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedId(conv.id)}
                    className={`flex w-full items-start gap-3 p-3 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-accent/10"
                        : "hover:bg-subtle/70"
                    }`}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent">
                      {getInitials(conv.contactName, conv.phone)}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-bold text-ink">
                          {conv.contactName || conv.phone}
                        </p>
                        <span className="shrink-0 text-[10px] text-ink-muted">
                          {formatConversationTime(conv.lastMessageAt, locale)}
                        </span>
                      </div>

                      <p className="truncate text-[11px] text-ink-muted">
                        {conv.lastMessagePreview || conv.phone}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            isAi
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {isAi ? <Bot size={10} /> : <UserRound size={10} />}
                          {isAi
                            ? es
                              ? "IA Activa"
                              : "IA Ativa"
                            : es
                              ? "Manual"
                              : "Manual"}
                        </span>

                        {conv.unreadCount > 0 && (
                          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#25D366] px-1.5 py-0.5 text-[10px] font-bold text-[#0F172A]">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Coluna Direita: Chat em Tempo Real */}
        <section className="flex min-h-[55vh] flex-col bg-canvas/30">
          {!activeConversation ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-[#25D366]/10 text-[#25D366]">
                <WhatsAppIcon className="size-7" />
              </div>
              <h2 className="text-sm font-bold text-ink">
                {es
                  ? "Selecciona una conversación o simula un cliente"
                  : "Selecione uma conversa ou simule um cliente"}
              </h2>
              <p className="mt-1 max-w-sm text-xs text-ink-muted">
                {es
                  ? "Aquí verás todo el historial de mensajes, las citas creadas por la IA y podrás responder manualmente cuando quieras."
                  : "Aqui você acompanha o histórico de mensagens, vê os agendamentos criados pela IA e pode assumir o atendimento a qualquer momento."}
              </p>
              <Button
                type="button"
                onClick={() => setSimulatorOpen(true)}
                className="mt-4 rounded-xl bg-accent text-accent-ink hover:bg-accent-hover text-xs font-semibold"
              >
                <FlaskConical size={14} />
                {es ? "Probar con Simulador" : "Testar com Simulador"}
              </Button>
            </div>
          ) : (
            <>
              {/* Header do Chat */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent">
                    {getInitials(
                      activeConversation.contactName,
                      activeConversation.phone,
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-ink">
                        {activeConversation.contactName || activeConversation.phone}
                      </p>
                      {activeConversation.status === "CONVERTED" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          <CalendarCheck2 size={10} />
                          {es ? "Agendado" : "Agendado"}
                        </span>
                      )}
                    </div>
                    <p className="truncate font-mono text-[11px] text-ink-muted">
                      {activeConversation.phone}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      !isConversationAiPaused(activeConversation)
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {!isConversationAiPaused(activeConversation) ? (
                      <>
                        <Bot size={13} />
                        {es ? "IA Activa" : "IA Ativa"}
                      </>
                    ) : (
                      <>
                        <UserRound size={13} />
                        {es ? "IA Pausada" : "IA Pausada"}
                      </>
                    )}
                  </span>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={togglingMode}
                    onClick={() => void handleToggleMode()}
                    className="cursor-pointer rounded-xl border-border-subtle text-xs font-semibold"
                  >
                    {togglingMode ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : !isConversationAiPaused(activeConversation) ? (
                      <UserRound size={13} />
                    ) : (
                      <Sparkles size={13} />
                    )}
                    {!isConversationAiPaused(activeConversation)
                      ? es
                        ? "Asumir conversación"
                        : "Assumir conversa"
                      : es
                        ? "Reactivar IA"
                        : "Reativar IA"}
                  </Button>
                </div>
              </div>

              {/* Lista de Mensagens */}
              <div className="flex-1 space-y-3 overflow-y-auto p-4 max-h-[54vh]">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-12 text-xs text-ink-muted">
                    <Loader2 className="mr-2 size-4 animate-spin text-accent" />
                    {es ? "Cargando mensajes..." : "Carregando mensagens..."}
                  </div>
                ) : (
                  (messages ?? activeConversation.messages ?? []).map((msg) => {
                    const isInbound = msg.direction === "INBOUND";
                    const isAi = msg.senderType === "AI_AGENT";
                    const validActions = (
                      Array.isArray(msg.metadata?.actions)
                        ? msg.metadata.actions
                        : []
                    ).filter((action) => Boolean(formatToolLabel(action?.tool, es)));

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          isInbound ? "items-start" : "items-end"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[72%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs whitespace-pre-wrap ${
                            isInbound
                              ? "rounded-tl-sm border border-border-subtle bg-surface text-ink"
                              : isAi
                                ? "rounded-tr-sm border border-emerald-500/25 bg-emerald-500/12 text-ink"
                                : "rounded-tr-sm bg-accent text-accent-ink"
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold opacity-80">
                            {isInbound ? (
                              <span>
                                {activeConversation.contactName ||
                                  (es ? "Cliente" : "Cliente")}
                              </span>
                            ) : isAi ? (
                              <>
                                <Bot size={11} />
                                <span>
                                  {es ? "Agente IA" : "Agente IA"}
                                  {msg.metadata?.aiProvider
                                    ? ` · ${msg.metadata.aiProvider}`
                                    : ""}
                                </span>
                              </>
                            ) : (
                              <>
                                <UserRound size={11} />
                                <span>{es ? "Tú (Manual)" : "Você (Manual)"}</span>
                              </>
                            )}
                          </div>

                          <p>{msg.content}</p>

                          {validActions.length > 0 && (
                            <div className="mt-2 space-y-1 border-t border-border-subtle/50 pt-2">
                              {validActions.map((action, idx) => {
                                const label = formatToolLabel(action.tool, es);
                                if (!label) return null;
                                return (
                                  <div
                                    key={`${msg.id}-act-${idx}`}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-canvas/70 px-2 py-1 text-[10px] text-ink"
                                  >
                                    <span className="inline-flex items-center gap-1 font-semibold">
                                      <CheckCircle2
                                        size={11}
                                        className={
                                          action.ok
                                            ? "text-emerald-500"
                                            : "text-rose-500"
                                        }
                                      />
                                      {label}
                                    </span>
                                    {action.tool === "criar_agendamento" &&
                                      action.ok && (
                                        <Link
                                          href={bookingAgendaHref(action, msg.content, clock)}
                                          className="font-semibold text-accent underline"
                                        >
                                          Ver agenda
                                        </Link>
                                      )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <p className="mt-1 text-right text-[10px] opacity-65">
                            {formatMessageTime(msg.sentAt, locale)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Barra de Envio Manual */}
              <form
                onSubmit={handleSendManualMessage}
                className="border-t border-border-subtle bg-surface p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={
                      activeConversation.assignedMode === "AI_AUTOPILOT"
                        ? es
                          ? "Escribe para responder manualmente (asumirá la conversación)..."
                          : "Digite para responder manualmente (assumirá a conversa)..."
                        : es
                          ? "Escribe un mensaje para el cliente..."
                          : "Digite uma mensagem para o cliente..."
                    }
                    className={fieldClass}
                  />
                  <Button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="h-10 shrink-0 rounded-xl bg-accent px-4 text-xs font-semibold text-accent-ink hover:bg-accent-hover"
                  >
                    {sending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    {es ? "Enviar" : "Enviar"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>

      {/* Modal Simulador de Cliente (Modo Teste) */}
      {simulatorOpen && (
        <AgendaDialog
          centered
          title={
            es
              ? "Simulador de Cliente (WhatsApp IA)"
              : "Simulador de Cliente (WhatsApp IA)"
          }
          onClose={() => setSimulatorOpen(false)}
        >
          <form onSubmit={handleSimulateInbound} className="space-y-4">
            <p className="text-xs text-ink-muted">
              {es
                ? "Envía un mensaje como si fueras un cliente real. El backend ejecutará el pipeline completo: cliente, agente IA y agenda real."
                : "Envie uma mensagem como se fosse um cliente real no WhatsApp. O backend executará todo o pipeline real da IA e da agenda."}
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-ink-secondary">
                  {es ? "Teléfono del cliente" : "Telefone do cliente"}
                </span>
                <input
                  type="text"
                  required
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  placeholder="+5511999990001"
                  className={fieldClass}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-ink-secondary">
                  {es ? "Nombre (opcional)" : "Nome (opcional)"}
                </span>
                <input
                  type="text"
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  placeholder="Lucas Silva"
                  className={fieldClass}
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-ink-secondary">
                {es ? "Mensaje del cliente" : "Mensagem do cliente"}
              </span>
              <textarea
                rows={3}
                required
                value={simContent}
                onChange={(e) => setSimContent(e.target.value)}
                placeholder={
                  es
                    ? "Ej.: Quiero agendar un corte hoy"
                    : "Ex.: Quero agendar um corte hoje"
                }
                className="w-full rounded-xl border border-border-subtle bg-canvas/50 p-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {quickSimulatorPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setSimContent(prompt)}
                    className="rounded-lg border border-border-subtle bg-subtle/70 px-2 py-1 text-[11px] font-medium text-ink-secondary hover:border-accent hover:text-ink transition-colors cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSimulatorOpen(false)}
                className="rounded-xl text-xs font-semibold"
              >
                {es ? "Cancelar" : "Cancelar"}
              </Button>
              <Button
                type="submit"
                disabled={simulating || !simContent.trim()}
                className="rounded-xl bg-[#25D366] text-[#0F172A] hover:bg-[#20bd5a] text-xs font-bold"
              >
                {simulating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {es ? "Enviar como Cliente" : "Enviar como Cliente"}
              </Button>
            </div>
          </form>
        </AgendaDialog>
      )}
    </div>
  );
}
