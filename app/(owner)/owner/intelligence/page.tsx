"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Flame,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  Snowflake,
  Sparkles,
  Sun,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import {
  intelligenceApi,
  notifyIntelligenceInsightsUpdated,
  openContextualCopilot,
  type ProactiveInsightItem,
  type ProactiveInsightModule,
} from "@/lib/intelligence-api";
import {
  whatsappIntelligenceApi,
  type DetectedObjection,
  type IntelligenceConversationItem,
  type LeadTemperature,
  type WhatsAppIntelligenceSummaryResponse,
} from "@/lib/whatsapp-intelligence";

type LeadFilter = "ALL" | "STALLED" | LeadTemperature;
type ModuleFilter = "ALL" | ProactiveInsightModule;

const MODULE_LABELS: Record<ProactiveInsightModule, string> = {
  AGENDA: "Agenda",
  FINANCE: "Financeiro",
  CLIENTS: "Clientes",
  SERVICES: "Serviços",
  INVENTORY: "Estoque",
  TEAM: "Equipe",
  WHATSAPP: "WhatsApp",
};

function formatObjectionLabel(objection: DetectedObjection): string {
  switch (objection) {
    case "PRICE":
      return "Preço";
    case "SCHEDULE_FULL":
      return "Agenda Cheia";
    case "TIMING":
      return "Momento / Horário";
    case "PAYMENT_METHOD":
      return "Forma de Pagamento";
    case "OTHER":
      return "Outras";
    default:
      return "Sem objeção";
  }
}

function getTemperatureMeta(temp: LeadTemperature) {
  switch (temp) {
    case "HOT":
      return {
        label: "Quente",
        badgeClass:
          "border-rose-500/30 bg-rose-500/12 text-rose-600 dark:text-rose-300",
        icon: Flame,
      };
    case "COLD":
      return {
        label: "Frio",
        badgeClass:
          "border-sky-500/30 bg-sky-500/12 text-sky-600 dark:text-sky-300",
        icon: Snowflake,
      };
    default:
      return {
        label: "Morno",
        badgeClass:
          "border-amber-500/30 bg-amber-500/12 text-amber-600 dark:text-amber-300",
        icon: Sun,
      };
  }
}

function formatCurrencyBrl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function IntelligenceHubPage() {
  const [days, setDays] = useState<number>(30);
  const [summary, setSummary] =
    useState<WhatsAppIntelligenceSummaryResponse | null>(null);
  const [insights, setInsights] = useState<ProactiveInsightItem[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [refreshingRadar, setRefreshingRadar] = useState(false);
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("ALL");
  const [leadFilter, setLeadFilter] = useState<LeadFilter>("ALL");

  const [apologyDraftById, setApologyDraftById] = useState<
    Record<string, string>
  >({});
  const [busyInsightId, setBusyInsightId] = useState<string | null>(null);

  const [followupDraftById, setFollowupDraftById] = useState<
    Record<string, string>
  >({});
  const [sendingFollowupId, setSendingFollowupId] = useState<string | null>(
    null,
  );

  const loadAll = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [summaryRes, insightsRes] = await Promise.all([
          whatsappIntelligenceApi.getSummary(days).catch(() => null),
          intelligenceApi.listInsights({ status: "PENDING", limit: 50 }),
        ]);

        if (summaryRes) {
          setSummary(summaryRes);
          setFollowupDraftById((prev) => {
            const next = { ...prev };
            for (const item of summaryRes.conversations) {
              if (next[item.conversationId] === undefined) {
                next[item.conversationId] = item.suggestedFollowupReply;
              }
            }
            return next;
          });
        }

        setInsights(insightsRes.insights);
        setPendingCount(insightsRes.pendingCount);
        setApologyDraftById((prev) => {
          const next = { ...prev };
          for (const card of insightsRes.insights) {
            if (
              card.type === "UNHAPPY_CLIENT_RESCUE" &&
              next[card.id] === undefined &&
              typeof card.actionPayload?.draftMessage === "string"
            ) {
              next[card.id] = card.actionPayload.draftMessage;
            }
          }
          return next;
        });
      } catch (error) {
        if (!silent) {
          toast.error(
            error instanceof ApiError
              ? error.message
              : "Não foi possível carregar a Central IA Intelligence.",
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [days],
  );

  useEffect(() => {
    void loadAll(false);
  }, [loadAll]);

  async function handleRefreshRadar() {
    if (refreshingRadar) return;
    setRefreshingRadar(true);
    try {
      const res = await intelligenceApi.refreshInsights();
      toast.success(
        res.createdCount > 0
          ? `Radar atualizado: ${res.createdCount} nova(s) oportunidade(s) encontrada(s)!`
          : "Radar atualizado: nenhuma nova oportunidade duplicada hoje.",
      );
      await loadAll(true);
      notifyIntelligenceInsightsUpdated();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Não foi possível atualizar o Radar de Oportunidades.",
      );
    } finally {
      setRefreshingRadar(false);
    }
  }

  async function handleExecuteInsight(card: ProactiveInsightItem) {
    if (busyInsightId) return;
    setBusyInsightId(card.id);
    try {
      const overrideMessage =
        card.type === "UNHAPPY_CLIENT_RESCUE"
          ? apologyDraftById[card.id]
          : undefined;
      const res = await intelligenceApi.executeInsight(
        card.id,
        overrideMessage,
      );
      toast.success(
        res.dispatchedMessagesCount > 0
          ? `Ação executada! ${res.dispatchedMessagesCount} mensagem(ns) enviada(s) via WhatsApp.`
          : "Oportunidade marcada como executada!",
      );
      await loadAll(true);
      notifyIntelligenceInsightsUpdated();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Não foi possível executar esta ação agora.",
      );
    } finally {
      setBusyInsightId(null);
    }
  }

  async function handleDismissInsight(card: ProactiveInsightItem) {
    if (busyInsightId) return;
    setBusyInsightId(card.id);
    try {
      await intelligenceApi.dismissInsight(card.id);
      toast.success("Card dispensado do radar.");
      await loadAll(true);
      notifyIntelligenceInsightsUpdated();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Não foi possível dispensar o card.",
      );
    } finally {
      setBusyInsightId(null);
    }
  }

  async function handleSendFollowup(item: IntelligenceConversationItem) {
    if (sendingFollowupId) return;
    const textToSend = (
      followupDraftById[item.conversationId] ?? item.suggestedFollowupReply
    ).trim();

    if (!textToSend) {
      toast.error("Escreva uma mensagem de follow-up antes de enviar.");
      return;
    }

    setSendingFollowupId(item.conversationId);
    try {
      await whatsappIntelligenceApi.sendFollowup(
        item.conversationId,
        textToSend,
      );
      toast.success(`Follow-up enviado para ${item.contactName ?? item.phone}!`);
      await loadAll(true);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Não foi possível enviar o follow-up.",
      );
    } finally {
      setSendingFollowupId(null);
    }
  }

  const filteredInsights = useMemo(() => {
    if (moduleFilter === "ALL") return insights;
    return insights.filter((card) => card.module === moduleFilter);
  }, [insights, moduleFilter]);

  const filteredConversations = useMemo(() => {
    const items = summary?.conversations ?? [];
    if (leadFilter === "ALL") return items;
    if (leadFilter === "STALLED") return items.filter((item) => item.isStalled);
    return items.filter((item) => item.leadTemperature === leadFilter);
  }, [leadFilter, summary]);

  const kpis = summary?.kpis ?? {
    totalConversations: 0,
    opportunities: 0,
    convertedAppointments: 0,
    conversionRate: 0,
    stalledConversationsCount: 0,
    hotLeadsCount: 0,
    warmLeadsCount: 0,
    coldLeadsCount: 0,
  };

  // Estimativa de ROI conservadora baseada nos agendamentos convertidos pela Recepcionista IA (ticket médio ref. R$ 80).
  const estimatedAiRevenue = kpis.convertedAppointments * 80;

  const funnel = summary?.funnel ?? {
    started: 0,
    opportunities: 0,
    hotLeads: 0,
    converted: 0,
  };

  const funnelSteps = [
    { label: "Conversas Iniciadas", value: funnel.started, color: "bg-sky-500" },
    { label: "Oportunidades", value: funnel.opportunities, color: "bg-indigo-500" },
    { label: "Leads Quentes", value: funnel.hotLeads, color: "bg-amber-500" },
    { label: "Agendamentos IA", value: funnel.converted, color: "bg-emerald-500" },
  ];
  const funnelMax = Math.max(1, funnel.started);

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Central IA Intelligence */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
            <Sparkles size={13} aria-hidden="true" />
            <span>Central IA Intelligence · Crescimento & Retenção</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            IA Intelligence
          </h1>
          <p className="text-sm text-ink-secondary">
            Radar proativo de oportunidades em 1 clique, ROI da Recepcionista IA e funil de conversão em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Período de análise"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-9 rounded-lg border border-border-subtle bg-surface px-3 text-xs font-semibold text-ink focus:border-accent focus:outline-none"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>

          <Button
            type="button"
            variant="outline"
            onClick={() => openContextualCopilot({ prompt: "Faça um resumo executivo das principais oportunidades e alertas da minha empresa hoje." })}
            className="h-9 rounded-lg border-accent/30 bg-accent-soft text-xs font-semibold text-accent hover:bg-accent hover:text-accent-ink"
          >
            <Bot size={14} />
            <span>Perguntar ao Copiloto</span>
          </Button>

          <Button
            type="button"
            onClick={() => void handleRefreshRadar()}
            disabled={refreshingRadar}
            className="h-9 rounded-lg bg-accent text-xs font-semibold text-accent-ink hover:bg-accent-hover"
          >
            {refreshingRadar ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            <span>Atualizar Radar</span>
          </Button>
        </div>
      </div>

      {/* 1. KPIs de ROI no Topo */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Faturamento Gerado pela IA</span>
            <DollarSign size={15} className="text-[var(--status-success)]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-ink tabular-nums">
            {formatCurrencyBrl(estimatedAiRevenue)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Estimativa sobre {kpis.convertedAppointments} agendamentos convertidos ({days}d)
          </p>
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Agendamentos Automáticos (24h)</span>
            <CalendarCheck2 size={15} className="text-accent" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-ink tabular-nums">
            {kpis.convertedAppointments}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            De {kpis.totalConversations} conversas atendidas automaticamente
          </p>
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Taxa de Conversão</span>
            <TrendingUp size={15} className="text-emerald-500" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-ink tabular-nums">
            {kpis.conversionRate}%
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {kpis.hotLeadsCount} leads quentes · {kpis.warmLeadsCount} mornos
          </p>
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Conversas Paradas (&gt;24h)</span>
            <Clock size={15} className="text-[var(--status-warning)]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-ink tabular-nums">
            {kpis.stalledConversationsCount}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Prontas para follow-up em 1 clique abaixo
          </p>
        </div>
      </div>

      {/* 2. Radar de Oportunidades Proativas (1 Clique) */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink">
                Radar de Oportunidades Proativas
              </h2>
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-mono text-xs font-semibold text-accent">
                {pendingCount} pendente(s)
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink-muted">
              Ações sugeridas pela IA cruzando agenda, financeiro, serviços, estoque, equipe e retenção.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                "ALL",
                "AGENDA",
                "FINANCE",
                "CLIENTS",
                "SERVICES",
                "INVENTORY",
                "TEAM",
              ] as ModuleFilter[]
            ).map((mod) => (
              <button
                key={mod}
                type="button"
                onClick={() => setModuleFilter(mod)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  moduleFilter === mod
                    ? "bg-accent text-accent-ink"
                    : "border border-border-subtle bg-canvas/50 text-ink-secondary hover:text-ink"
                }`}
              >
                {mod === "ALL" ? "Todos" : MODULE_LABELS[mod]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-xs text-ink-muted">
            <Loader2 className="mr-2 size-4 animate-spin text-accent" />
            Carregando radar de oportunidades...
          </div>
        ) : filteredInsights.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-subtle bg-canvas/30 p-8 text-center space-y-2">
            <Sparkles className="mx-auto size-6 text-accent" />
            <p className="text-sm font-semibold text-ink">
              Nenhuma oportunidade pendente neste filtro
            </p>
            <p className="text-xs text-ink-muted">
              Clique em &quot;Atualizar Radar&quot; para rodar uma nova varredura imediata nos dados da empresa.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filteredInsights.map((card) => {
              const isUnhappyRescue = card.type === "UNHAPPY_CLIENT_RESCUE";
              const isBusy = busyInsightId === card.id;
              const rating =
                typeof card.actionPayload?.rating === "number"
                  ? card.actionPayload.rating
                  : null;
              const clientName =
                typeof card.actionPayload?.clientName === "string"
                  ? card.actionPayload.clientName
                  : null;

              return (
                <article
                  key={card.id}
                  className={`flex flex-col justify-between rounded-xl border p-4 space-y-3 ${
                    isUnhappyRescue
                      ? "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)]/35"
                      : "border-border-subtle bg-canvas/40"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md border border-accent/25 bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                        {isUnhappyRescue && (
                          <ShieldAlert className="size-3 text-[var(--status-danger)]" />
                        )}
                        {MODULE_LABELS[card.module] ?? card.module}
                      </span>
                      {card.impactLabel && (
                        <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-ink-secondary border border-border-subtle">
                          {card.impactLabel}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-ink leading-snug">
                      {card.title}
                    </h3>
                    <p className="text-xs text-ink-secondary leading-relaxed">
                      {card.description}
                    </p>

                    {isUnhappyRescue && (
                      <div className="space-y-1.5 pt-1">
                        <label
                          htmlFor={`apology-${card.id}`}
                          className="block text-[11px] font-semibold text-ink"
                        >
                          Rascunho de pedido de desculpas
                          {clientName ? ` para ${clientName}` : ""}
                          {rating !== null ? ` (Nota ${rating}/5)` : ""} — edite antes de enviar:
                        </label>
                        <textarea
                          id={`apology-${card.id}`}
                          rows={3}
                          value={apologyDraftById[card.id] ?? ""}
                          onChange={(e) =>
                            setApologyDraftById((prev) => ({
                              ...prev,
                              [card.id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-border-strong bg-surface p-2.5 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle/70 pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => void handleDismissInsight(card)}
                      className="h-8 rounded-lg border-border-subtle text-xs font-semibold text-ink-secondary hover:text-ink"
                    >
                      <XCircle size={13} />
                      <span>Dispensar</span>
                    </Button>

                    <Button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleExecuteInsight(card)}
                      className="h-8 rounded-lg bg-accent text-xs font-semibold text-accent-ink hover:bg-accent-hover"
                    >
                      {isBusy ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : isUnhappyRescue ? (
                        <Send size={13} />
                      ) : (
                        <CheckCircle2 size={13} />
                      )}
                      <span>
                        {isUnhappyRescue ? "Aprovar e Enviar" : "Executar"}
                      </span>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Funil de Conversão & Principais Objeções */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <BarChart3 size={15} className="text-accent" />
                Funil de Conversão (WhatsApp IA)
              </h2>
              <p className="text-xs text-ink-muted">
                Jornada dos contatos nos últimos {days} dias
              </p>
            </div>
            <Link
              href="/owner/whatsapp"
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <span>Abrir Inbox</span>
              <ExternalLink size={12} />
            </Link>
          </div>

          <div className="space-y-3">
            {funnelSteps.map((step) => {
              const pct = Math.round((step.value / funnelMax) * 100);
              return (
                <div key={step.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-ink">{step.label}</span>
                    <span className="font-mono font-semibold text-ink-secondary tabular-nums">
                      {step.value} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-subtle">
                    <div
                      className={`h-full rounded-full transition-all ${step.color}`}
                      style={{ width: `${Math.max(pct, step.value > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <AlertTriangle size={15} className="text-[var(--status-warning)]" />
              Principais Objeções Detectadas
            </h2>
            <p className="text-xs text-ink-muted">
              Barreiras identificadas pela IA nas conversas não convertidas
            </p>
          </div>

          {!summary || summary.objectionsBreakdown.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-muted">
              Nenhuma objeção dominante registrada neste período.
            </p>
          ) : (
            <div className="space-y-3">
              {summary.objectionsBreakdown.map((item) => (
                <div key={item.objection} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-ink">
                      {formatObjectionLabel(item.objection)}
                    </span>
                    <span className="font-mono font-semibold text-ink-secondary tabular-nums">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-subtle">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 4. Follow-up Editável em 1 Clique */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <MessageSquare size={16} className="text-accent" />
              Leads & Follow-up em 1 Clique
            </h2>
            <p className="text-xs text-ink-muted">
              Ajuste a mensagem sugerida pela IA e reative conversas paradas diretamente pelo WhatsApp.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "ALL", label: "Todos" },
                { id: "STALLED", label: "Paradas (>24h)" },
                { id: "HOT", label: "Quentes" },
                { id: "WARM", label: "Mornos" },
                { id: "COLD", label: "Frios" },
              ] as Array<{ id: LeadFilter; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLeadFilter(opt.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  leadFilter === opt.id
                    ? "bg-accent text-accent-ink"
                    : "border border-border-subtle bg-canvas/50 text-ink-secondary hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {filteredConversations.length === 0 ? (
          <p className="py-8 text-center text-xs text-ink-muted">
            Nenhuma conversa encontrada para o filtro selecionado.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredConversations.slice(0, 12).map((item) => {
              const tempMeta = getTemperatureMeta(item.leadTemperature);
              const TempIcon = tempMeta.icon;
              const isSending = sendingFollowupId === item.conversationId;

              return (
                <div
                  key={item.conversationId}
                  className="rounded-xl border border-border-subtle bg-canvas/40 p-3.5 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-bold text-ink truncate">
                        {item.contactName || item.phone}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tempMeta.badgeClass}`}
                      >
                        <TempIcon size={11} />
                        {tempMeta.label}
                      </span>
                      {item.isStalled && (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                          Parada há {item.hoursSinceLastMessage}h
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/owner/whatsapp?conversationId=${encodeURIComponent(item.conversationId)}`}
                      className="text-xs font-semibold text-accent hover:underline"
                    >
                      Ver chat
                    </Link>
                  </div>

                  <p className="text-xs text-ink-secondary">{item.summary}</p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={
                        followupDraftById[item.conversationId] ??
                        item.suggestedFollowupReply
                      }
                      onChange={(e) =>
                        setFollowupDraftById((prev) => ({
                          ...prev,
                          [item.conversationId]: e.target.value,
                        }))
                      }
                      className="h-9 flex-1 rounded-lg border border-border-subtle bg-surface px-3 text-xs text-ink focus:border-accent focus:outline-none"
                    />
                    <Button
                      type="button"
                      disabled={isSending}
                      onClick={() => void handleSendFollowup(item)}
                      className="h-9 shrink-0 rounded-lg bg-accent text-xs font-semibold text-accent-ink hover:bg-accent-hover"
                    >
                      {isSending ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Send size={13} />
                      )}
                      <span>Enviar Follow-up</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
