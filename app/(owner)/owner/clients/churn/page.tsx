"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  Clock,
  Download,
  ExternalLink,
  HeartCrack,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeInTimezone, formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import { useClients } from "@/lib/use-clients";

export default function ChurnClientsPage() {
  const { session } = useSession();
  const { locale } = useLocale();
  const timezone = session.company.timezone;
  const currency = session.company.currency ?? "BRL";
  const companyId = session.company.id;

  const { clients, loading, refresh } = useClients(companyId);

  const [daysThreshold, setDaysThreshold] = useState<number>(30);
  const [search, setSearch] = useState("");

  // Filtra clientes ausentes há mais de X dias sem agendamento futuro
  const inactiveClients = useMemo(() => {
    const now = new Date().getTime();
    const q = search.trim().toLowerCase();

    return clients
      .filter((c) => {
        // Precisa ter visitado ao menos 1 vez
        if (!c.lastVisitAt) return false;

        // Não pode ter agendamento futuro marcado
        if (c.futureAppointments.length > 0) return false;

        // Calcula dias de ausência
        const lastVisitTime = new Date(c.lastVisitAt).getTime();
        const diffDays = Math.floor((now - lastVisitTime) / 86_400_000);

        if (diffDays < daysThreshold) return false;

        // Busca por nome ou telefone
        if (q) {
          const matchName = c.name.toLowerCase().includes(q);
          const matchPhone = c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""));
          if (!matchName && !matchPhone) return false;
        }

        return true;
      })
      .map((c) => {
        const lastVisitTime = new Date(c.lastVisitAt!).getTime();
        const daysAway = Math.floor((now - lastVisitTime) / 86_400_000);
        const lastApp = c.appointments[0];

        return {
          ...c,
          daysAway,
          lastService: lastApp?.serviceNameSnapshot || "Serviço",
          lastProfessional: lastApp ? "Equipe" : "—",
        };
      })
      .sort((a, b) => b.daysAway - a.daysAway);
  }, [clients, daysThreshold, search]);

  // KPIs de retenção
  const kpis = useMemo(() => {
    const totalInactive = inactiveClients.length;
    let potentialRevenueRiskCents = 0;

    for (const c of inactiveClients) {
      const avgTicket = c.totalVisits > 0 ? c.totalSpentCents / c.totalVisits : 0;
      potentialRevenueRiskCents += avgTicket;
    }

    const churnRate =
      clients.length > 0 ? Math.round((totalInactive / clients.length) * 100) : 0;

    return { totalInactive, potentialRevenueRiskCents, churnRate };
  }, [inactiveClients, clients.length]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <HeartCrack className="size-6 text-rose-500" />
            Clientes Sumidos (Resgate de Clientes)
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Identifique clientes sem visitas recentes e envie mensagens carinhosas no WhatsApp para
            reativar sua agenda.
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

      {/* 3 KPIs de Churn */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 shadow-xs">
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
            Clientes Ausentes
          </span>
          <div className="mt-2 text-3xl font-bold text-rose-600 dark:text-rose-400">
            {kpis.totalInactive}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Sem retorno há mais de {daysThreshold} dias e sem horário agendado
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 shadow-xs">
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
            Receita Estimada em Risco
          </span>
          <div className="mt-2 text-3xl font-bold text-amber-600 dark:text-amber-400">
            <SensitiveValue>
              {formatPriceFromCents(kpis.potentialRevenueRiskCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Ticket médio histórico desses clientes</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            Impacto na Carteira
          </span>
          <div className="mt-2 text-3xl font-bold text-ink">{kpis.churnRate}%</div>
          <p className="mt-1 text-xs text-ink-muted">Percentual da base total de clientes</p>
        </div>
      </div>

      {/* Barra de Filtros e Seletor de Dias */}
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
            <span className="font-semibold text-ink-secondary mr-1">Ausente há mais de:</span>
            {[30, 45, 60, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setDaysThreshold(days)}
                className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                  daysThreshold === days
                    ? "bg-accent text-accent-ink font-semibold"
                    : "text-ink-secondary hover:text-ink hover:bg-canvas/50"
                }`}
              >
                {days} dias
              </button>
            ))}
          </div>
        </div>

        <span className="text-xs text-ink-muted">{inactiveClients.length} cliente(s)</span>
      </div>

      {/* Lista de Clientes Sumidos */}
      <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="mt-3 text-xs text-ink-muted">Analisando frequência dos clientes...</p>
          </div>
        ) : inactiveClients.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-muted space-y-1">
            <p className="font-bold text-sm text-ink">Excelente! Nenhum cliente sumido nesta faixa.</p>
            <p>Sua taxa de retenção para clientes com mais de {daysThreshold} dias está ótima.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Tempo de Ausência</th>
                  <th className="py-3 px-4">Último Serviço Realizado</th>
                  <th className="py-3 px-4">Histórico</th>
                  <th className="py-3 px-4 text-right">Ação de Resgate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {inactiveClients.map((client) => {
                  const phoneDigits = client.phone.replace(/\D/g, "");
                  const rescueMessage = encodeURIComponent(
                    `Olá ${client.name}! Tudo bem? Sentimos muito a sua falta aqui no ${session.company.companyName}! 🥰\n\nQue tal dar um trato no visual essa semana? Estamos com horários abertos para você. Vamos agendar?`,
                  );
                  const waLink = phoneDigits
                    ? `https://wa.me/55${phoneDigits}?text=${rescueMessage}`
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
                        <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 font-bold text-rose-500">
                          <Clock size={11} />
                          Ausente há {client.daysAway} dias
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <p className="font-medium text-ink">{client.lastService}</p>
                        <p className="text-[11px] text-ink-muted">Em {lastVisitDate}</p>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-ink-secondary">
                        {client.totalVisits} visitas realizadas
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
                            Resgatar no WhatsApp
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
