"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Clock,
  ExternalLink,
  Loader2,
  MessageCircle,
  RefreshCw,
  Repeat,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeInTimezone, formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import { useClients } from "@/lib/use-clients";

export default function ClientReturnsPage() {
  const { session } = useSession();
  const { locale } = useLocale();
  const timezone = session.company.timezone;
  const currency = session.company.currency ?? "BRL";
  const companyId = session.company.id;

  const { clients, loading, refresh } = useClients(companyId);

  const [minDays, setMinDays] = useState<number>(15);
  const [maxDays, setMaxDays] = useState<number>(30);
  const [search, setSearch] = useState("");

  // Filtra clientes atendidos entre minDays e maxDays sem agendamento futuro
  const returnClients = useMemo(() => {
    const now = new Date().getTime();
    const q = search.trim().toLowerCase();

    return clients
      .filter((c) => {
        if (!c.lastVisitAt) return false;
        // Não pode ter agendamento futuro
        if (c.futureAppointments.length > 0) return false;

        const lastVisitTime = new Date(c.lastVisitAt).getTime();
        const diffDays = Math.floor((now - lastVisitTime) / 86_400_000);

        if (diffDays < minDays || diffDays > maxDays) return false;

        if (q) {
          const matchName = c.name.toLowerCase().includes(q);
          const matchPhone = c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""));
          if (!matchName && !matchPhone) return false;
        }

        return true;
      })
      .map((c) => {
        const lastVisitTime = new Date(c.lastVisitAt!).getTime();
        const daysAgo = Math.floor((now - lastVisitTime) / 86_400_000);
        const lastApp = c.appointments[0];

        return {
          ...c,
          daysAgo,
          lastService: lastApp?.serviceNameSnapshot || "Serviço",
          lastPriceCents: lastApp?.servicePriceInCentsSnapshot || 0,
        };
      })
      .sort((a, b) => b.daysAgo - a.daysAgo);
  }, [clients, minDays, maxDays, search]);

  // KPIs de retorno
  const kpis = useMemo(() => {
    const count = returnClients.length;
    let potentialCents = 0;
    let totalDays = 0;

    for (const c of returnClients) {
      potentialCents += c.lastPriceCents;
      totalDays += c.daysAgo;
    }

    const avgDays = count > 0 ? Math.round(totalDays / count) : 0;

    return { count, potentialCents, avgDays };
  }, [returnClients]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Repeat className="size-6 text-accent" />
            Ciclo de Retornos (Reagendamento Ativo)
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Clientes atendidos recentemente na janela ideal de manutenção (15–30 dias) e que ainda
            não possuem horário marcado.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="grid size-9 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink disabled:opacity-50 transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* 3 KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            Prontos para Retorno
          </span>
          <div className="mt-2 text-3xl font-bold text-accent">{kpis.count}</div>
          <p className="mt-1 text-xs text-ink-muted">
            Clientes atendidos entre {minDays} e {maxDays} dias atrás
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
            Potencial de Faturamento
          </span>
          <div className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            <SensitiveValue>
              {formatPriceFromCents(kpis.potentialCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Valor estimado ao reagendar estes clientes</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            Média de Dias Desde a Visita
          </span>
          <div className="mt-2 text-3xl font-bold text-ink">
            {kpis.avgDays > 0 ? `${kpis.avgDays} dias` : "—"}
          </div>
          <p className="mt-1 text-xs text-ink-muted">Tempo médio de intervalo para o retorno</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-ink-muted" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-canvas/40 pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-ink-secondary mr-1">Janela de Retorno:</span>
            <button
              type="button"
              onClick={() => {
                setMinDays(15);
                setMaxDays(30);
              }}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                minDays === 15 && maxDays === 30
                  ? "bg-accent text-accent-ink font-semibold"
                  : "text-ink-secondary hover:text-ink hover:bg-canvas/50"
              }`}
            >
              15 a 30 dias (Padrão)
            </button>
            <button
              type="button"
              onClick={() => {
                setMinDays(30);
                setMaxDays(45);
              }}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                minDays === 30 && maxDays === 45
                  ? "bg-accent text-accent-ink font-semibold"
                  : "text-ink-secondary hover:text-ink hover:bg-canvas/50"
              }`}
            >
              30 a 45 dias
            </button>
          </div>
        </div>

        <span className="text-xs text-ink-muted">{returnClients.length} cliente(s)</span>
      </div>

      {/* Tabela de Retornos */}
      <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="mt-3 text-xs text-ink-muted">Calculando ciclo de retornos...</p>
          </div>
        ) : returnClients.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-muted space-y-1">
            <p className="font-bold text-sm text-ink">Nenhum cliente nesta janela no momento.</p>
            <p>Seus clientes recentes já estão com horários futuros marcados ou fora da janela.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Intervalo</th>
                  <th className="py-3 px-4">Último Serviço Realizado</th>
                  <th className="py-3 px-4">Valor Habitual</th>
                  <th className="py-3 px-4 text-right">Ação de Reagendamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {returnClients.map((client) => {
                  const phoneDigits = client.phone.replace(/\D/g, "");
                  const returnMessage = encodeURIComponent(
                    `Olá ${client.name}! Já se passaram ${client.daysAgo} dias desde o seu último atendimento de ${client.lastService} no ${session.company.companyName}. ✨\n\nQue tal garantir seu horário para a manutenção e retoque nesta semana? Vamos reservar sua vaga?`,
                  );
                  const waLink = phoneDigits
                    ? `https://wa.me/55${phoneDigits}?text=${returnMessage}`
                    : null;
                  const lastVisitDate = formatDateTimeInTimezone(
                    client.lastVisitAt!,
                    timezone,
                    locale,
                  ).split(" ")[0];

                  return (
                    <tr key={client.id} className="hover:bg-canvas/30 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          href={`/owner/clients/${client.id}`}
                          className="font-semibold text-ink hover:text-accent hover:underline block truncate"
                        >
                          {client.name}
                        </Link>
                        <span className="text-[11px] text-ink-muted font-mono">{client.phone}</span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 font-bold text-accent">
                          <Clock size={11} />
                          Há {client.daysAgo} dias
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <p className="font-semibold text-ink">{client.lastService}</p>
                        <p className="text-[11px] text-ink-muted">Realizado em {lastVisitDate}</p>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-medium text-ink">
                        <SensitiveValue>
                          {formatPriceFromCents(client.lastPriceCents, locale, currency)}
                        </SensitiveValue>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer shadow-xs"
                          >
                            <MessageCircle size={13} />
                            Lembrar no WhatsApp
                          </a>
                        )}

                        <Link
                          href={`/owner/clients/${client.id}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-border-subtle bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-accent transition-colors"
                        >
                          Ficha
                          <ExternalLink size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
