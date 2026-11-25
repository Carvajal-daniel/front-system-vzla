"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck2,
  Clock,
  ExternalLink,
  Flame,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Snowflake,
  Sparkles,
  Sun,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { ApiError } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import {
  whatsappIntelligenceApi,
  type DetectedObjection,
  type IntelligenceConversationItem,
  type LeadTemperature,
  type WhatsAppIntelligenceSummaryResponse,
} from "@/lib/whatsapp-intelligence";
import { WhatsAppTabs } from "../_components/whatsapp-tabs";

type FilterOption = "ALL" | "STALLED" | LeadTemperature;

function formatObjectionLabel(
  objection: DetectedObjection,
  es: boolean,
): string {
  switch (objection) {
    case "PRICE":
      return es ? "Precio" : "Preço";
    case "SCHEDULE_FULL":
      return es ? "Agenda Llena" : "Agenda Cheia";
    case "TIMING":
      return es ? "Momento / Horario" : "Momento";
    case "PAYMENT_METHOD":
      return es ? "Forma de Pago" : "Pagamento";
    case "OTHER":
      return es ? "Otras" : "Outras";
    default:
      return es ? "Sin objeción" : "Sem objeção";
  }
}

function getTemperatureMeta(temp: LeadTemperature, es: boolean) {
  switch (temp) {
    case "HOT":
      return {
        label: es ? "Caliente" : "Quente",
        badgeClass:
          "border-rose-500/30 bg-rose-500/12 text-rose-600 dark:text-rose-300",
        icon: Flame,
      };
    case "COLD":
      return {
        label: es ? "Frío" : "Frio",
        badgeClass:
          "border-sky-500/30 bg-sky-500/12 text-sky-600 dark:text-sky-300",
        icon: Snowflake,
      };
    default:
      return {
        label: es ? "Tibio" : "Morno",
        badgeClass:
          "border-amber-500/30 bg-amber-500/12 text-amber-600 dark:text-amber-300",
        icon: Sun,
      };
  }
}

export default function WhatsAppIntelligencePage() {
  const { locale } = useLocale();
  const es = locale === "es";

  const [days, setDays] = useState<number>(30);
  const [summary, setSummary] =
    useState<WhatsAppIntelligenceSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterOption>("ALL");
  const [draftById, setDraftById] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  const loadSummary = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await whatsappIntelligenceApi.getSummary(days);
        setSummary(data);
        setDraftById((prev) => {
          const next = { ...prev };
          for (const item of data.conversations) {
            if (next[item.conversationId] === undefined) {
              next[item.conversationId] = item.suggestedFollowupReply;
            }
          }
          return next;
        });
      } catch (error) {
        if (!silent) {
          toast.error(
            error instanceof ApiError
              ? error.message
              : es
                ? "No fue posible cargar WhatsApp Intelligence."
                : "Não foi possível carregar o painel WhatsApp Intelligence.",
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [days, es],
  );

  useEffect(() => {
    void loadSummary(false);
  }, [loadSummary]);

  const filteredConversations = useMemo(() => {
    const items = summary?.conversations ?? [];
    if (filter === "ALL") return items;
    if (filter === "STALLED") return items.filter((item) => item.isStalled);
    return items.filter((item) => item.leadTemperature === filter);
  }, [filter, summary]);

  async function handleSendFollowup(item: IntelligenceConversationItem) {
    if (sendingId) return;
    const textToSend = (
      draftById[item.conversationId] ?? item.suggestedFollowupReply
    ).trim();

    if (!textToSend) {
      toast.error(
        es
          ? "Escribe un mensaje de follow-up antes de enviar."
          : "Escreva uma mensagem de follow-up antes de enviar.",
      );
      return;
    }

    setSendingId(item.conversationId);
    try {
      await whatsappIntelligenceApi.sendFollowup(
        item.conversationId,
        textToSend,
      );
      toast.success(
        es
          ? `Follow-up enviado a ${item.contactName ?? item.phone}.`
          : `Follow-up enviado para ${item.contactName ?? item.phone}!`,
      );
      await loadSummary(true);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : es
            ? "No fue posible enviar el follow-up."
            : "Não foi possível enviar o follow-up.",
      );
    } finally {
      setSendingId(null);
    }
  }

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

  const funnel = summary?.funnel ?? {
    started: 0,
    opportunities: 0,
    hotLeads: 0,
    converted: 0,
  };
  const funnelMax = Math.max(funnel.started, 1);

  const funnelSteps = [
    {
      label: es ? "Conversaciones Iniciadas" : "Conversas Iniciadas",
      value: funnel.started,
      barClass: "bg-accent",
    },
    {
      label: es ? "Oportunidades Activas" : "Oportunidades Ativas",
      value: funnel.opportunities,
      barClass: "bg-sky-500",
    },
    {
      label: es ? "Leads Calientes" : "Leads Quentes",
      value: funnel.hotLeads,
      barClass: "bg-amber-500",
    },
    {
      label: es ? "Agendamientos Convertidos" : "Agendamentos Convertidos",
      value: funnel.converted,
      barClass: "bg-emerald-500",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Cabeçalho + Seletor de Período */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2.5 text-xl sm:text-2xl font-bold tracking-tight text-ink">
            <span className="grid size-9 place-items-center rounded-xl bg-[#25D366]/15 text-[#25D366]">
              <WhatsAppIcon className="size-5" />
            </span>
            WhatsApp Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted">
            {es
              ? "Embudo de conversión, objeciones detectadas por la IA y follow-up en 1 clic para recuperar reservas."
              : "Funil de conversão, objeções detectadas pela IA e follow-up em 1 clique para recuperar agendamentos."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-border-subtle bg-surface p-1 text-xs font-semibold">
            {[7, 30, 90].map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setDays(period)}
                className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
                  days === period
                    ? "bg-accent text-accent-ink"
                    : "text-ink-secondary hover:text-ink"
                }`}
              >
                {period}d
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void loadSummary(false)}
            disabled={loading}
            className="rounded-xl border-border-subtle bg-surface text-xs font-semibold text-ink"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {es ? "Actualizar" : "Atualizar"}
          </Button>
        </div>
      </div>

      <WhatsAppTabs active="intelligence" />

      {/* 4 KPIs Principais */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
            <span>{es ? "Conversaciones Iniciadas" : "Conversas Iniciadas"}</span>
            <MessageSquare size={16} className="text-accent" />
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">
            {loading ? "—" : kpis.totalConversations}
          </p>
          <p className="mt-1 text-[11px] text-ink-muted">
            {es ? `Últimos ${days} días` : `Últimos ${days} dias`}
          </p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
            <span>
              {es ? "Conversiones (Citas)" : "Conversões (Agendamentos)"}
            </span>
            <CalendarCheck2 size={16} className="text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">
            {loading ? "—" : kpis.convertedAppointments}
          </p>
          <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            {es
              ? `${kpis.hotLeadsCount} leads calientes`
              : `${kpis.hotLeadsCount} leads quentes`}
          </p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
            <span>{es ? "Tasa de Conversión" : "Taxa de Conversão"}</span>
            <TrendingUp size={16} className="text-sky-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">
            {loading ? "—" : `${kpis.conversionRate}%`}
          </p>
          <p className="mt-1 text-[11px] text-ink-muted">
            {es ? "Conversas → Citas" : "Conversas → Agendamentos"}
          </p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
            <span>
              {es ? "Conversaciones Paradas (>24h)" : "Conversas Paradas (>24h)"}
            </span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">
            {loading ? "—" : kpis.stalledConversationsCount}
          </p>
          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            {es
              ? "Prioridad para follow-up"
              : "Prioridade para follow-up"}
          </p>
        </div>
      </div>

      {/* Funil de Conversão + Principais Objeções */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Funil */}
        <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <BarChart3 size={16} className="text-accent" />
                {es ? "Embudo de Conversión" : "Funil de Conversão"}
              </h2>
              <p className="text-xs text-ink-muted">
                {es
                  ? "Evolución de leads atendidos en WhatsApp."
                  : "Evolução dos leads atendidos no WhatsApp."}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {funnelSteps.map((step) => {
              const pct =
                funnel.started > 0
                  ? Math.round((step.value / funnelMax) * 100)
                  : 0;
              return (
                <div key={step.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-ink">{step.label}</span>
                    <span className="font-bold text-ink">
                      {step.value}{" "}
                      <span className="font-normal text-ink-muted">
                        ({pct}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-subtle">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${step.barClass}`}
                      style={{ width: `${Math.max(pct, step.value > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Principais Objeções */}
        <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              {es ? "Principales Objeciones" : "Principais Objeções"}
            </h2>
            <p className="text-xs text-ink-muted">
              {es
                ? "Barreras identificadas automáticamente en conversaciones no convertidas."
                : "Barreiras identificadas automaticamente nas conversas ainda não convertidas."}
            </p>
          </div>

          <div className="space-y-3">
            {(summary?.objectionsBreakdown ?? []).map((item) => (
              <div key={item.objection} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink">
                    {formatObjectionLabel(item.objection, es)}
                  </span>
                  <span className="font-bold text-ink">
                    {item.count}{" "}
                    <span className="font-normal text-ink-muted">
                      ({item.percentage}%)
                    </span>
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-subtle">
                  <div
                    className="h-full rounded-full bg-amber-500/85 transition-all duration-300"
                    style={{
                      width: `${Math.max(item.percentage, item.count > 0 ? 5 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            ))}

            {!loading &&
              (summary?.objectionsBreakdown ?? []).every((o) => o.count === 0) && (
                <p className="rounded-xl border border-dashed border-border-subtle bg-canvas/40 p-4 text-center text-xs text-ink-muted">
                  {es
                    ? "Ninguna objeción registrada en este período todavía."
                    : "Nenhuma objeção registrada neste período ainda."}
                </p>
              )}
          </div>
        </section>
      </div>

      {/* Lista de Conversas Analisadas & Follow-up */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              {es
                ? "Conversaciones Analizadas & Follow-up Recomendado"
                : "Conversas Analisadas & Follow-up Recomendado"}
            </h2>
            <p className="text-xs text-ink-muted">
              {es
                ? "Edita el mensaje sugerido si lo deseas y envíalo en 1 clic por WhatsApp."
                : "Ajuste a mensagem sugerida se quiser e envie em 1 clique direto pelo WhatsApp."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "ALL", label: es ? "Todas" : "Todas" },
                { id: "STALLED", label: es ? "Paradas (>24h)" : "Paradas (>24h)" },
                { id: "HOT", label: es ? "Caliente" : "Quente" },
                { id: "WARM", label: es ? "Tibio" : "Morno" },
                { id: "COLD", label: es ? "Frío" : "Frio" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilter(opt.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  filter === opt.id
                    ? "bg-accent text-accent-ink"
                    : "border border-border-subtle bg-canvas/50 text-ink-secondary hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-ink-muted">
            <Loader2 size={16} className="animate-spin text-accent" />
            <span>
              {es ? "Analizando conversaciones..." : "Carregando inteligência..."}
            </span>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-subtle bg-canvas/40 p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-ink">
              {es
                ? "No hay conversaciones para este filtro."
                : "Nenhuma conversa encontrada para este filtro."}
            </p>
            <p className="text-xs text-ink-muted">
              {es
                ? "Usa el simulador en la Inbox o recibe mensajes de clientes para ver el análisis automático de la IA."
                : "Use o simulador na Inbox ou receba mensagens de clientes para ver a análise automática da IA."}
            </p>
            <div className="pt-2">
              <Link
                href="/owner/whatsapp"
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors"
              >
                <MessageSquare size={14} />
                {es ? "Ir a la Inbox" : "Ir para a Inbox"}
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredConversations.map((item) => {
              const tempMeta = getTemperatureMeta(item.leadTemperature, es);
              const TempIcon = tempMeta.icon;
              const isSending = sendingId === item.conversationId;
              const draftValue =
                draftById[item.conversationId] ?? item.suggestedFollowupReply;

              return (
                <article
                  key={item.conversationId}
                  className="rounded-2xl border border-border-subtle bg-canvas/40 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-ink">
                          {item.contactName || item.phone}
                        </h3>
                        <span className="text-xs text-ink-muted font-mono">
                          {item.phone}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tempMeta.badgeClass}`}
                        >
                          <TempIcon size={12} />
                          {tempMeta.label} · {item.leadScore}
                        </span>
                        {item.status === "CONVERTED" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
                            <CalendarCheck2 size={12} />
                            {es ? "Convertido" : "Convertido"}
                          </span>
                        )}
                        {item.isStalled && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                            <Clock size={12} />
                            {es
                              ? `Parada (${item.hoursSinceLastMessage}h)`
                              : `Parada (${item.hoursSinceLastMessage}h)`}
                          </span>
                        )}
                        {item.detectedObjection !== "NONE" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-secondary">
                            {es ? "Objeción:" : "Objeção:"}{" "}
                            {formatObjectionLabel(item.detectedObjection, es)}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-ink-secondary">
                        <span className="font-semibold text-ink">
                          {es ? "Resumen IA:" : "Resumo IA:"}
                        </span>{" "}
                        {item.summary}
                      </p>
                      <p className="text-xs text-ink-muted">
                        <span className="font-semibold text-ink-secondary">
                          {es ? "Próxima acción:" : "Próxima ação:"}
                        </span>{" "}
                        {item.recommendedNextAction}
                      </p>
                    </div>
                  </div>

                  {/* Preview editável do follow-up + Botões de ação */}
                  <div className="space-y-2 rounded-xl border border-border-subtle bg-surface p-3">
                    <label
                      htmlFor={`followup-${item.conversationId}`}
                      className="block text-[11px] font-semibold uppercase tracking-wider text-ink-muted"
                    >
                      {es
                        ? "Mensaje de follow-up sugerido (editable)"
                        : "Mensagem de follow-up sugerida (editável)"}
                    </label>
                    <textarea
                      id={`followup-${item.conversationId}`}
                      rows={2}
                      value={draftValue}
                      onChange={(e) =>
                        setDraftById((prev) => ({
                          ...prev,
                          [item.conversationId]: e.target.value,
                        }))
                      }
                      className="w-full resize-none rounded-xl border border-border-subtle bg-canvas/50 px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                    />
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Link
                        href={`/owner/whatsapp?conversationId=${encodeURIComponent(item.conversationId)}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-border-subtle bg-canvas px-3 text-xs font-semibold text-ink hover:border-accent transition-colors"
                      >
                        <ExternalLink size={13} />
                        {es ? "Abrir Conversación" : "Abrir Conversa"}
                      </Link>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isSending}
                        onClick={() => void handleSendFollowup(item)}
                        className="h-8 rounded-xl bg-accent px-3 text-xs font-semibold text-accent-ink hover:bg-accent-hover"
                      >
                        {isSending ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Send size={13} />
                        )}
                        {es ? "Enviar Follow-up" : "Enviar Follow-up"}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
