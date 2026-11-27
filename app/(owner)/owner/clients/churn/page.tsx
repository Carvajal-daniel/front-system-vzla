"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Brain,
  Check,
  Loader2,
  Radar,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Star,
  UserX,
  Users,
} from "lucide-react";
import { IndividualChurnRadar } from "./_components/individual-churn-radar";
import { AgendaDialog } from "@/components/ui/agenda-controls";
import { useSession } from "@/components/ui/auth-guard";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { ApiError } from "@/lib/api-client";
import {
  clientRecovery,
  inactivityOptions,
  type InactiveClient,
  type InactiveDays,
  type RecoveryReasonsAnalysis,
} from "@/lib/client-recovery";
import { formatDateTimeInTimezone, formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";

const copy = {
  "pt-BR": {
    title: "Recuperar Clientes",
    description:
      "Identifique clientes inativos, analise os prováveis motivos com IA e reative o relacionamento pelo WhatsApp.",
    kpiTotal: "Total de Inativos",
    kpiLowRating: "Com Avaliação Baixa (≤ 3★)",
    kpiCanceled: "Cancelaram e não voltaram",
    campaign: "Campanha de Reativação",
    goal: "Objetivo da mensagem",
    invite: "Convidar para uma nova visita",
    feedback: "Pedir feedback",
    offer: "Oferta ou instruções para a IA",
    placeholder: "Ex.: 20% de desconto na barba esta semana",
    inactivity: "Período de inatividade",
    days: "dias",
    since: (days: number) => `${days} dias sem retorno`,
    list: "Clientes para Recuperação",
    lastVisit: "Último serviço",
    professional: "Profissional",
    visitsCount: (n: number) => `${n} visita(s)`,
    noReview: "Sem avaliação registrada",
    lastReviewTitle: "Última avaliação",
    LOW_RATING: "⚠️ Avaliação Baixa",
    CANCELED_WITHOUT_REBOOK: "🔄 Cancelou e não remarcou",
    CHURN_INACTIVE: "💤 Inativo",
    empty: "Nenhum cliente inativo encontrado neste período.",
    listError: "Não foi possível carregar os clientes inativos.",
    generateError: "Não foi possível gerar a mensagem. Tente novamente.",
    analyzeError: "Não foi possível analisar os motivos agora. Tente novamente.",
    aiUnavailable: "A integração de IA ainda precisa ser configurada.",
    sendError: "Não foi possível confirmar o envio.",
    disconnected: "O WhatsApp está desconectado. Confira a conexão e tente novamente.",
    sendUnknown:
      "O provedor ainda não confirmou o envio. Aguarde e confira no WhatsApp antes de tentar novamente.",
    clientUnavailable: "Este cliente não está mais elegível para recuperação. Atualize a lista.",
    invalidPhone: "O cliente precisa de um número de WhatsApp válido.",
    whatsappDirect: "WhatsApp Direto",
    analyzeReasons: "Analisar Motivos (IA)",
    analyzingReasons: "Analisando...",
    analysisTitle: "Diagnóstico Inteligente de Ausência",
    suggestedApproachLabel: "Sugestão de abordagem:",
    generate: "Gerar Mensagem com IA",
    generating: "Gerando mensagem…",
    review: "Aprovar Mensagem (WhatsApp)",
    message: "Mensagem editável para o cliente",
    regenerate: "Regerar",
    approve: "Aprovar e Enviar",
    sending: "Enviando…",
    sent: "Enviada ao WhatsApp",
    retry: "Tentar novamente",
  },
  es: {
    title: "Recuperar Clientes",
    description:
      "Identifica clientes inactivos, analiza los motivos probables con IA y reactiva el vínculo por WhatsApp.",
    kpiTotal: "Total de Inactivos",
    kpiLowRating: "Con Calificación Baja (≤ 3★)",
    kpiCanceled: "Cancelaron y no volvieron",
    campaign: "Campaña de Reactivación",
    goal: "Objetivo del mensaje",
    invite: "Invitar a una nueva visita",
    feedback: "Pedir comentarios",
    offer: "Oferta o instrucciones para la IA",
    placeholder: "Ej.: 20 % de descuento en barba esta semana",
    inactivity: "Período de inactividad",
    days: "días",
    since: (days: number) => `${days} días sin volver`,
    list: "Clientes para Recuperación",
    lastVisit: "Último servicio",
    professional: "Profesional",
    visitsCount: (n: number) => `${n} visita(s)`,
    noReview: "Sin calificación registrada",
    lastReviewTitle: "Última calificación",
    LOW_RATING: "⚠️ Calificación Baja",
    CANCELED_WITHOUT_REBOOK: "🔄 Canceló y no reprogramó",
    CHURN_INACTIVE: "💤 Inactivo",
    empty: "No se encontraron clientes inactivos en este período.",
    listError: "No se pudieron cargar los clientes inactivos.",
    generateError: "No se pudo generar el mensaje. Inténtalo de nuevo.",
    analyzeError: "No se pudieron analizar los motivos ahora. Inténtalo de nuevo.",
    aiUnavailable: "La integración de IA todavía necesita configuración.",
    sendError: "No se pudo confirmar el envío.",
    disconnected: "WhatsApp está desconectado. Revisa la conexión e inténtalo de nuevo.",
    sendUnknown:
      "El proveedor aún no ha confirmado el envío. Espera y revisa WhatsApp antes de intentar nuevamente.",
    clientUnavailable: "Este cliente ya no reúne los requisitos para la recuperación. Actualiza la lista.",
    invalidPhone: "El cliente necesita un número de WhatsApp válido.",
    whatsappDirect: "WhatsApp Directo",
    analyzeReasons: "Analizar Motivos (IA)",
    analyzingReasons: "Analizando...",
    analysisTitle: "Diagnóstico Inteligente de Ausencia",
    suggestedApproachLabel: "Sugerencia de abordaje:",
    generate: "Generar Mensaje con IA",
    generating: "Generando mensaje…",
    review: "Aprobar Mensaje (WhatsApp)",
    message: "Mensaje editable para el cliente",
    regenerate: "Regenerar",
    approve: "Aprobar y Enviar",
    sending: "Enviando…",
    sent: "Enviado a WhatsApp",
    retry: "Reintentar",
  },
};

const panel = "rounded-2xl border border-border-subtle bg-surface";
const field =
  "w-full min-w-0 rounded-xl border border-border-subtle bg-canvas px-3 py-2 text-xs text-ink focus-visible:outline-2 focus-visible:outline-accent";

interface Draft {
  client: InactiveClient;
  campaignGoal: string;
  customOffer: string;
  approvalId: string;
  message: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function buildDirectWhatsAppUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}`;
}

export default function RecoveryPage() {
  const { session } = useSession();
  const { locale } = useLocale();
  const text = copy[locale];
  const { id: companyId, currency, timezone } = session.company;

  const [activeTab, setActiveTab] = useState<"radar" | "inactivity">("radar");
  const [days, setDays] = useState<InactiveDays>(30);
  const [goal, setGoal] = useState<"RETURN_VISIT" | "FEEDBACK">("RETURN_VISIT");
  const [offer, setOffer] = useState("");
  const [clients, setClients] = useState<InactiveClient[]>([]);
  const [listStatus, setListStatus] = useState<"loading" | "ready" | "error">("loading");
  const [refresh, setRefresh] = useState(0);

  // Estado de Diagnóstico IA por cliente
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, RecoveryReasonsAnalysis>>({});
  const [analyzeErrors, setAnalyzeErrors] = useState<Record<string, string>>({});

  // Estado do Modal de Aprovação de Mensagem (IA)
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<"generate" | "send" | null>(null);
  const [error, setError] = useState<
    | "generateError"
    | "aiUnavailable"
    | "sendError"
    | "disconnected"
    | "sendUnknown"
    | "clientUnavailable"
    | "invalidPhone"
    | null
  >(null);
  const [sent, setSent] = useState<Record<string, true>>({});
  const [lastSent, setLastSent] = useState("");

  useEffect(() => {
    const request = new AbortController();
    setListStatus("loading");
    void clientRecovery
      .list(days, request.signal)
      .then(({ clients }) => {
        if (request.signal.aborted) return;
        setClients(clients);
        setListStatus("ready");
      })
      .catch(() => {
        if (!request.signal.aborted) setListStatus("error");
      });
    return () => request.abort();
  }, [companyId, days, refresh]);

  // 3 KPIs de topo
  const kpis = useMemo(() => {
    const total = clients.length;
    const lowRating = clients.filter(
      (c) => c.diagnosticTag === "LOW_RATING" || (c.lastReview !== null && c.lastReview.stars <= 3),
    ).length;
    const canceled = clients.filter((c) => c.diagnosticTag === "CANCELED_WITHOUT_REBOOK").length;
    return { total, lowRating, canceled };
  }, [clients]);

  async function handleAnalyzeReasons(client: InactiveClient) {
    setAnalyzingId(client.id);
    setAnalyzeErrors((prev) => {
      const next = { ...prev };
      delete next[client.id];
      return next;
    });
    try {
      const result = await clientRecovery.analyzeReasons(client.id);
      setAnalyses((prev) => ({ ...prev, [client.id]: result }));
    } catch {
      setAnalyzeErrors((prev) => ({ ...prev, [client.id]: text.analyzeError }));
    } finally {
      setAnalyzingId(null);
    }
  }

  async function generate(current: Draft) {
    setDraft(current);
    setError(null);
    setBusy("generate");
    try {
      const { message } = await clientRecovery.generate({
        clientId: current.client.id,
        campaignGoal: current.campaignGoal,
        customOffer: current.customOffer,
      });
      setDraft({ ...current, message });
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : undefined;
      setError(
        code === "RECOVERY_CLIENT_UNAVAILABLE"
          ? "clientUnavailable"
          : code === "RECOVERY_AI_UNCONFIGURED"
            ? "aiUnavailable"
            : "generateError",
      );
    } finally {
      setBusy(null);
    }
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !draft.message.trim() || busy) return;
    setBusy("send");
    setError(null);
    try {
      await clientRecovery.send({
        clientId: draft.client.id,
        approvedMessage: draft.message.trim(),
        approvalId: draft.approvalId,
      });
      setSent((current) => ({ ...current, [draft.client.id]: true }));
      setLastSent(draft.client.name);
      setDraft(null);
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : undefined;
      setError(
        code === "WHATSAPP_DISCONNECTED"
          ? "disconnected"
          : code === "RECOVERY_CLIENT_UNAVAILABLE"
            ? "clientUnavailable"
            : code === "RECOVERY_INVALID_PHONE"
              ? "invalidPhone"
              : code === "RECOVERY_SEND_UNKNOWN" || code === "NETWORK_ERROR"
                ? "sendUnknown"
                : "sendError",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">{text.title}</h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-secondary">{text.description}</p>
        </div>

        {activeTab === "inactivity" && (
          <button
            type="button"
            onClick={() => setRefresh((v) => v + 1)}
            disabled={listStatus === "loading"}
            className="grid size-9 cursor-pointer place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:border-accent hover:text-ink disabled:opacity-50"
            title={text.retry}
          >
            <RefreshCw size={15} className={listStatus === "loading" ? "animate-spin" : ""} />
          </button>
        )}
      </header>

      {/* Alternador de Abas: Radar de Churn Individual vs Recuperação por Inatividade */}
      <div
        role="tablist"
        aria-label="Modos de retenção"
        className="inline-flex flex-wrap gap-1 rounded-2xl border border-border-subtle bg-surface p-1.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "radar"}
          onClick={() => setActiveTab("radar")}
          className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === "radar"
              ? "bg-accent text-accent-ink shadow-xs"
              : "text-ink-secondary hover:bg-subtle hover:text-ink"
          }`}
        >
          <Radar size={14} aria-hidden="true" />
          Radar de Churn Individual
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "inactivity"}
          onClick={() => setActiveTab("inactivity")}
          className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            activeTab === "inactivity"
              ? "bg-accent text-accent-ink shadow-xs"
              : "text-ink-secondary hover:bg-subtle hover:text-ink"
          }`}
        >
          <Users size={14} aria-hidden="true" />
          Recuperação por Inatividade
        </button>
      </div>

      {activeTab === "radar" ? (
        <IndividualChurnRadar />
      ) : (
        <>
      {/* 3 Cards de Resumo (KPIs) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={`${panel} p-4 shadow-xs flex items-center justify-between`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {text.kpiTotal}
            </p>
            <p className="mt-1.5 text-2xl font-bold text-ink tabular-nums">
              {listStatus === "loading" ? "—" : kpis.total}
            </p>
          </div>
          <span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent">
            <Users size={18} />
          </span>
        </div>

        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
              {text.kpiLowRating}
            </p>
            <p className="mt-1.5 text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              {listStatus === "loading" ? "—" : kpis.lowRating}
            </p>
          </div>
          <span className="grid size-10 place-items-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
            <AlertTriangle size={18} />
          </span>
        </div>

        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              {text.kpiCanceled}
            </p>
            <p className="mt-1.5 text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
              {listStatus === "loading" ? "—" : kpis.canceled}
            </p>
          </div>
          <span className="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
            <UserX size={18} />
          </span>
        </div>
      </section>

      {/* Painel de Filtros e Parâmetros da Campanha IA */}
      <section className={`${panel} p-4 shadow-xs space-y-3`}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-4 space-y-1">
            <span className="block text-xs font-semibold text-ink-secondary">
              {text.inactivity}
            </span>
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-border-subtle bg-canvas/50 p-1">
              {inactivityOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDays(option)}
                  className={`cursor-pointer rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                    days === option
                      ? "bg-accent text-accent-ink shadow-2xs"
                      : "text-ink-secondary hover:text-ink"
                  }`}
                >
                  {option} {text.days}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-1">
            <label htmlFor="recovery-goal" className="block text-xs font-semibold text-ink-secondary">
              {text.goal}
            </label>
            <select
              id="recovery-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value as "RETURN_VISIT" | "FEEDBACK")}
              className={`${field} cursor-pointer`}
            >
              <option value="RETURN_VISIT">{text.invite}</option>
              <option value="FEEDBACK">{text.feedback}</option>
            </select>
          </div>

          <div className="lg:col-span-5 space-y-1">
            <label htmlFor="recovery-offer" className="block text-xs font-semibold text-ink-secondary">
              {text.offer}
            </label>
            <input
              id="recovery-offer"
              type="text"
              placeholder={text.placeholder}
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              className={field}
            />
          </div>
        </div>
      </section>

      {lastSent && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
        >
          <Check size={15} />
          <span>
            {text.sent}: {lastSent}
          </span>
        </div>
      )}

      {/* Lista de Clientes em Cards de 3 Colunas */}
      <section className="space-y-3" aria-label={text.list}>
        {listStatus === "loading" ? (
          <div className={`${panel} flex flex-col items-center justify-center py-16 text-xs text-ink-muted`}>
            <Loader2 className="size-7 animate-spin text-accent" />
          </div>
        ) : listStatus === "error" ? (
          <div className={`${panel} p-6 text-center space-y-2`}>
            <p className="text-sm text-rose-500">{text.listError}</p>
            <button
              type="button"
              onClick={() => setRefresh((v) => v + 1)}
              className="cursor-pointer rounded-xl border border-border-subtle px-4 py-2 text-xs font-semibold text-ink hover:border-accent"
            >
              {text.retry}
            </button>
          </div>
        ) : clients.length === 0 ? (
          <div className={`${panel} py-16 text-center text-xs text-ink-muted`}>{text.empty}</div>
        ) : (
          clients.map((client) => {
            const directWaUrl = buildDirectWhatsAppUrl(client.phone);
            const analysis = analyses[client.id];
            const analyzeErr = analyzeErrors[client.id];
            const isAnalyzing = analyzingId === client.id;
            const isLowRating =
              client.diagnosticTag === "LOW_RATING" ||
              (client.lastReview !== null && client.lastReview.stars <= 3);

            const tagTone =
              client.diagnosticTag === "LOW_RATING"
                ? "border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300"
                : client.diagnosticTag === "CANCELED_WITHOUT_REBOOK"
                  ? "border-amber-500/35 bg-amber-500/12 text-amber-800 dark:text-amber-300"
                  : "border-slate-500/30 bg-slate-500/10 text-ink-secondary";

            return (
              <article
                key={client.id}
                className={`${panel} p-4 sm:p-5 shadow-xs space-y-3 transition-colors hover:border-border-strong`}
              >
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
                  {/* COLUNA ESQUERDA: Avatar, Nome, WhatsApp e Badge de Dias */}
                  <div className="lg:col-span-4 flex items-start gap-3 min-w-0">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-bold text-accent">
                      {getInitials(client.name)}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <h2 className="truncate text-sm font-bold text-ink">{client.name}</h2>
                      <p className="font-mono text-xs text-ink-muted">{client.phone}</p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="inline-flex rounded-full bg-amber-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                          {text.since(client.lastVisit.daysSinceLastVisit)}
                        </span>
                        {client.historySummary && (
                          <span className="inline-flex rounded-full bg-canvas px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                            {text.visitsCount(client.historySummary.totalVisits)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* COLUNA CENTRO: Último Serviço + Valor + Profissional + Bloco da Última Avaliação */}
                  <div className="lg:col-span-4 space-y-2 border-y border-border-subtle/60 py-3 lg:border-x lg:border-y-0 lg:px-4 lg:py-0">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                      <span className="font-semibold text-ink">{client.lastVisit.serviceName}</span>
                      <span className="font-bold text-accent tabular-nums">
                        <SensitiveValue>
                          {formatPriceFromCents(client.lastVisit.price, locale, currency)}
                        </SensitiveValue>
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-secondary">
                      {text.professional}:{" "}
                      <strong className="text-ink">{client.lastVisit.collaboratorName}</strong> ·{" "}
                      {formatDateTimeInTimezone(client.lastVisit.completedAt, timezone, locale)}
                    </p>

                    {/* Bloco da Última Avaliação */}
                    <div
                      className={`rounded-xl border p-2.5 text-xs ${
                        client.lastReview
                          ? isLowRating
                            ? "border-rose-500/30 bg-rose-500/8"
                            : "border-emerald-500/25 bg-emerald-500/8"
                          : "border-border-subtle bg-canvas/50"
                      }`}
                    >
                      {client.lastReview ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 font-bold text-ink">
                              <Star
                                size={13}
                                className={
                                  isLowRating
                                    ? "fill-rose-500 text-rose-500"
                                    : "fill-amber-400 text-amber-400"
                                }
                              />
                              ★ {client.lastReview.stars}/5
                            </span>
                            <span className="text-[10px] text-ink-muted">
                              {text.lastReviewTitle}
                            </span>
                          </div>
                          {client.lastReview.comment && (
                            <p className="text-[11px] italic text-ink-secondary">
                              &ldquo;{client.lastReview.comment}&rdquo;
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-ink-muted">{text.noReview}</p>
                      )}
                    </div>
                  </div>

                  {/* COLUNA DIREITA: Tag de Diagnóstico + 3 Botões de Ação */}
                  <div className="lg:col-span-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${tagTone}`}
                      >
                        {text[client.diagnosticTag]}
                      </span>
                      {sent[client.id] && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <Check size={13} />
                          {text.sent}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                      {/* 1. WhatsApp Direto (#25D366) */}
                      {directWaUrl ? (
                        <a
                          href={directWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-2.5 py-1.5 text-[11px] font-bold text-[#0F172A] hover:brightness-95 transition-all shadow-2xs"
                        >
                          <WhatsAppIcon className="size-3.5 shrink-0" />
                          <span className="truncate">{text.whatsappDirect}</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex min-h-9 cursor-not-allowed items-center justify-center gap-1.5 rounded-xl bg-[#25D366]/40 px-2.5 py-1.5 text-[11px] font-bold text-[#0F172A]/60"
                        >
                          <WhatsAppIcon className="size-3.5 shrink-0" />
                          <span className="truncate">{text.whatsappDirect}</span>
                        </button>
                      )}

                      {/* 2. Analisar Motivos (IA) */}
                      <button
                        type="button"
                        disabled={isAnalyzing}
                        onClick={() => void handleAnalyzeReasons(client)}
                        className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink hover:border-accent hover:text-accent transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isAnalyzing ? (
                          <Loader2 size={13} className="animate-spin shrink-0" />
                        ) : (
                          <Brain size={13} className="shrink-0 text-accent" />
                        )}
                        <span className="truncate">
                          {isAnalyzing ? text.analyzingReasons : text.analyzeReasons}
                        </span>
                      </button>

                      {/* 3. Gerar Mensagem com IA */}
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          void generate({
                            client,
                            campaignGoal: goal,
                            customOffer: offer.trim(),
                            approvalId: crypto.randomUUID(),
                            message: "",
                          })
                        }
                        className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-accent px-2.5 py-1.5 text-[11px] font-bold text-accent-ink hover:bg-accent-hover transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Sparkles size={13} className="shrink-0" />
                        <span className="truncate">{text.generate}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bloco Destacado do Diagnóstico IA (quando solicitado) */}
                {analyzeErr && (
                  <p role="alert" className="text-xs text-rose-500">
                    {analyzeErr}
                  </p>
                )}
                {analysis && (
                  <div className="rounded-xl border border-accent/30 bg-accent/5 p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-bold text-accent">
                        <Brain size={14} />
                        {text.analysisTitle}
                      </span>
                      <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-muted border border-border-subtle">
                        {analysis.source === "AI" ? "IA" : "Histórico"}
                      </span>
                    </div>
                    <ul className="list-disc space-y-1 pl-4 text-ink">
                      {analysis.reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                    <p className="rounded-lg bg-surface/80 px-3 py-2 text-[11px] text-ink-secondary border border-border-subtle/70">
                      <strong className="text-ink">{text.suggestedApproachLabel}</strong>{" "}
                      {analysis.suggestedApproach}
                    </p>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {/* Modal de Aprovação estilo WhatsApp (Gerar Mensagem com IA) */}
      {draft && (
        <AgendaDialog
          centered
          title={`${text.review} · ${draft.client.name}`}
          closeDisabled={busy === "send"}
          onClose={() => {
            setDraft(null);
            setError(null);
          }}
        >
          <form onSubmit={send} className="space-y-4">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink">{draft.client.name}</span>
                <span className="font-mono text-[11px] text-ink-muted">{draft.client.phone}</span>
              </div>
              <p className="text-[11px] text-ink-secondary">
                {draft.client.lastVisit.serviceName} · {draft.client.lastVisit.collaboratorName}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="recovery-draft-message" className="block text-xs font-semibold text-ink">
                {text.message}
              </label>
              {busy === "generate" ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-border-subtle bg-canvas/50 py-10 text-xs text-ink-muted">
                  <Loader2 size={16} className="animate-spin text-accent" />
                  <span>{text.generating}</span>
                </div>
              ) : (
                <textarea
                  id="recovery-draft-message"
                  rows={5}
                  required
                  maxLength={1200}
                  value={draft.message}
                  onChange={(e) =>
                    setDraft((current) =>
                      current ? { ...current, message: e.target.value } : null,
                    )
                  }
                  className="w-full rounded-xl border border-border-subtle bg-surface p-3 text-sm text-ink outline-none focus-visible:border-accent"
                />
              )}
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                {text[error]}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  void generate({
                    ...draft,
                    approvalId: crypto.randomUUID(),
                  })
                }
                className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3.5 text-xs font-semibold text-ink hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw size={13} />
                {text.regenerate}
              </button>

              <button
                type="submit"
                disabled={busy !== null || !draft.message.trim()}
                className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-[#25D366] px-4 text-xs font-bold text-[#0F172A] hover:brightness-95 transition-all disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === "send" ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {text.sending}
                  </>
                ) : (
                  <>
                    <WhatsAppIcon className="size-4" />
                    {text.approve}
                  </>
                )}
              </button>
            </div>
          </form>
        </AgendaDialog>
      )}
        </>
      )}
    </div>
  );
}
