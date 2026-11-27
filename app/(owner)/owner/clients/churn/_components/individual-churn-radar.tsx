"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Loader2,
  Radar,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/ui/auth-guard";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { ApiError } from "@/lib/api-client";
import { formatDateTimeInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import {
  operationsApi,
  type ChurnRadarResponse,
  type IndividualChurnCandidate,
} from "@/lib/operations-api";

const MARGIN_OPTIONS = [4, 7, 14] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Painel do Radar de Churn Individual (GET /retention/churn-radar e POST /retention/churn-radar/:clientId/reactivate).
 * Identifica clientes que ultrapassaram o próprio ciclo médio de retorno e permite reativação em 1 clique via WhatsApp.
 */
export function IndividualChurnRadar() {
  const { session } = useSession();
  const { locale } = useLocale();
  const { timezone } = session.company;

  const [marginDays, setMarginDays] = useState<number>(4);
  const [data, setData] = useState<ChurnRadarResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [sendingClientId, setSendingClientId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Record<string, true>>({});

  const loadRadar = useCallback(
    async (signal?: AbortSignal) => {
      setStatus("loading");
      setErrorMessage("");
      try {
        const result = await operationsApi.getChurnRadar({ marginDays }, signal);
        if (signal?.aborted) return;
        setData(result);
        setStatus("ready");
      } catch (err) {
        if (signal?.aborted) return;
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar o Radar de Churn individual.",
        );
        setStatus("error");
      }
    },
    [marginDays],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadRadar(controller.signal);
    return () => controller.abort();
  }, [loadRadar]);

  async function handleReactivate(client: IndividualChurnCandidate) {
    if (sendingClientId) return;
    setSendingClientId(client.clientId);
    try {
      const result = await operationsApi.reactivateChurnClient(client.clientId, {
        marginDays,
      });
      if (result.delivered) {
        setSentIds((prev) => ({ ...prev, [client.clientId]: true }));
        toast.success(`Convite enviado via WhatsApp para ${client.clientName}.`);
      } else {
        toast.warning(
          `Mensagem preparada para ${client.clientName}, mas o WhatsApp não confirmou a entrega.`,
        );
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Não foi possível enviar o convite via WhatsApp.",
      );
    } finally {
      setSendingClientId(null);
    }
  }

  const panel = "rounded-2xl border border-border-subtle bg-surface";
  const clients = data?.clients ?? [];

  return (
    <div className="space-y-5">
      {/* KPIs do Radar Individual */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={`${panel} flex items-center justify-between p-4 shadow-xs`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Clientes no Radar
            </p>
            <p className="mt-1.5 text-2xl font-bold text-ink tabular-nums">
              {status === "loading" ? "—" : (data?.totalAtRisk ?? 0)}
            </p>
          </div>
          <span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent">
            <Users size={18} />
          </span>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4 shadow-xs">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
              Alto Risco (HIGH_RISK)
            </p>
            <p className="mt-1.5 text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              {status === "loading" ? "—" : (data?.highRiskCount ?? 0)}
            </p>
          </div>
          <span className="grid size-10 place-items-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
            <ShieldAlert size={18} />
          </span>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 shadow-xs">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Atenção (WARNING)
            </p>
            <p className="mt-1.5 text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
              {status === "loading" ? "—" : (data?.warningCount ?? 0)}
            </p>
          </div>
          <span className="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
            <AlertTriangle size={18} />
          </span>
        </div>
      </section>

      {/* Barra de controles do Radar */}
      <section className={`${panel} flex flex-wrap items-center justify-between gap-3 p-4 shadow-xs`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary">
            <Radar className="size-4 text-accent" aria-hidden="true" />
            Margem de tolerância após o ciclo médio:
          </span>
          <div className="inline-flex gap-1 rounded-xl border border-border-subtle bg-canvas/50 p-1">
            {MARGIN_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setMarginDays(days)}
                className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  marginDays === days
                    ? "bg-accent text-accent-ink shadow-2xs"
                    : "text-ink-secondary hover:text-ink"
                }`}
              >
                +{days} dias
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={status === "loading"}
          onClick={() => void loadRadar()}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={14} className={status === "loading" ? "animate-spin" : ""} />
          Atualizar radar
        </button>
      </section>

      {/* Lista de clientes fora do próprio ciclo */}
      <section className="space-y-3" aria-label="Clientes no Radar de Churn Individual">
        {status === "loading" ? (
          <div className={`${panel} flex flex-col items-center justify-center py-16 text-xs text-ink-muted`}>
            <Loader2 className="size-7 animate-spin text-accent" />
          </div>
        ) : status === "error" ? (
          <div className={`${panel} space-y-2 p-6 text-center`}>
            <p className="text-sm text-rose-500">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void loadRadar()}
              className="cursor-pointer rounded-xl border border-border-subtle px-4 py-2 text-xs font-semibold text-ink hover:border-accent"
            >
              Tentar novamente
            </button>
          </div>
        ) : clients.length === 0 ? (
          <div className={`${panel} space-y-1.5 py-16 text-center`}>
            <p className="text-sm font-semibold text-ink">
              Nenhum cliente fora do ciclo individual de retorno.
            </p>
            <p className="text-xs text-ink-muted">
              O radar monitora automaticamente clientes com pelo menos 2 atendimentos concluídos.
            </p>
          </div>
        ) : (
          clients.map((client) => {
            const isHighRisk = client.risk === "HIGH_RISK";
            const isSending = sendingClientId === client.clientId;
            const isSent = Boolean(sentIds[client.clientId]);

            return (
              <article
                key={client.clientId}
                className={`${panel} p-4 sm:p-5 shadow-xs transition-colors hover:border-border-strong`}
              >
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
                  {/* Cliente + Ciclo Individual */}
                  <div className="flex min-w-0 items-start gap-3 lg:col-span-5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-bold text-accent">
                      {getInitials(client.clientName)}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-sm font-bold text-ink">
                          {client.clientName}
                        </h2>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                            isHighRisk
                              ? "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300"
                              : "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300"
                          }`}
                        >
                          {isHighRisk ? "Alto Risco" : "Atenção"}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-ink-muted">
                        {client.clientPhone}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                          <CalendarClock className="size-3" aria-hidden="true" />
                          volta a cada {client.averageCycleDays} dias
                        </span>
                        <span className="inline-flex rounded-full bg-canvas px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                          {client.visitCount} visitas
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Atraso + Última Visita */}
                  <div className="space-y-1.5 border-y border-border-subtle/60 py-3 lg:col-span-4 lg:border-x lg:border-y-0 lg:px-4 lg:py-0">
                    <p className="text-xs font-bold text-ink">
                      <span
                        className={
                          isHighRisk
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-amber-700 dark:text-amber-400"
                        }
                      >
                        {client.overdueDays} dia(s) de atraso
                      </span>{" "}
                      <span className="font-normal text-ink-secondary">
                        ({client.daysSinceLastVisit} dias desde a última visita)
                      </span>
                    </p>
                    <p className="text-[11px] text-ink-secondary">
                      Último serviço:{" "}
                      <strong className="text-ink">
                        {client.lastServiceName || "Atendimento anterior"}
                      </strong>
                      {client.lastCollaboratorName
                        ? ` · ${client.lastCollaboratorName}`
                        : ""}
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      Última visita:{" "}
                      {formatDateTimeInTimezone(client.lastVisitAt, timezone, locale)}
                    </p>
                  </div>

                  {/* Ação 1 clique WhatsApp */}
                  <div className="flex flex-col items-stretch justify-end gap-2 lg:col-span-3 lg:items-end">
                    <button
                      type="button"
                      disabled={isSending}
                      onClick={() => void handleReactivate(client)}
                      className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-xs font-bold text-[#0F172A] shadow-2xs transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
                    >
                      {isSending ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Enviando…
                        </>
                      ) : (
                        <>
                          <WhatsAppIcon className="size-4 shrink-0" />
                          Enviar convite WhatsApp
                        </>
                      )}
                    </button>

                    {isSent && (
                      <span className="inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <Check size={13} />
                        Convite enviado
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
