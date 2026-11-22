"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  ExternalLink,
  Gift,
  Loader2,
  MessageCircle,
  PartyPopper,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { useClients } from "@/lib/use-clients";

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export default function ClientBirthdaysPage() {
  const { session } = useSession();
  const companyId = session.company.id;
  const { clients, loading, refresh } = useClients(companyId);

  const currentMonth = new Date().getMonth() + 1; // 1..12
  const currentDay = new Date().getDate();

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [filterTodayOnly, setFilterTodayOnly] = useState<boolean>(false);
  const [search, setSearch] = useState("");

  // Filtra aniversariantes pelo mês e dia
  const birthdayClients = useMemo(() => {
    const q = search.trim().toLowerCase();

    return clients
      .filter((c) => {
        if (!c.birthDate) return false;
        // Espera formato YYYY-MM-DD ou MM-DD
        const parts = c.birthDate.split("-");
        let bMonth = 0;
        let bDay = 0;

        if (parts.length === 3) {
          bMonth = Number(parts[1]);
          bDay = Number(parts[2]);
        } else if (parts.length === 2) {
          bMonth = Number(parts[0]);
          bDay = Number(parts[1]);
        }

        if (filterTodayOnly) {
          if (bMonth !== currentMonth || bDay !== currentDay) return false;
        } else {
          if (bMonth !== selectedMonth) return false;
        }

        if (q) {
          const matchName = c.name.toLowerCase().includes(q);
          const matchPhone = c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""));
          if (!matchName && !matchPhone) return false;
        }

        return true;
      })
      .map((c) => {
        const parts = c.birthDate!.split("-");
        let bYear = parts.length === 3 ? Number(parts[0]) : null;
        let bMonth = parts.length === 3 ? Number(parts[1]) : Number(parts[0]);
        let bDay = parts.length === 3 ? Number(parts[2]) : Number(parts[1]);

        const isToday = bMonth === currentMonth && bDay === currentDay;
        const currentYear = new Date().getFullYear();
        const age = bYear ? currentYear - bYear : null;

        return {
          ...c,
          bDay,
          bMonth,
          isToday,
          age,
        };
      })
      .sort((a, b) => a.bDay - b.bDay);
  }, [clients, selectedMonth, filterTodayOnly, currentMonth, currentDay, search]);

  // Contagem de hoje
  const todayCount = useMemo(() => {
    return clients.filter((c) => {
      if (!c.birthDate) return false;
      const parts = c.birthDate.split("-");
      const bMonth = parts.length === 3 ? Number(parts[1]) : Number(parts[0]);
      const bDay = parts.length === 3 ? Number(parts[2]) : Number(parts[1]);
      return bMonth === currentMonth && bDay === currentDay;
    }).length;
  }, [clients, currentMonth, currentDay]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <PartyPopper className="size-6 text-amber-500" />
            Aniversariantes
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Fortaleça o relacionamento enviando mensagens de parabéns e mimos exclusivos aos seus
            clientes no WhatsApp.
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

      {/* 2 KPIs Rápidos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 shadow-xs">
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
            Aniversariantes de Hoje
          </span>
          <div className="mt-2 text-3xl font-bold text-amber-600 dark:text-amber-400">
            {todayCount}
          </div>
          <p className="mt-1 text-xs text-ink-muted">Clientes comemorando aniversário neste dia</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            Aniversariantes do Mês ({monthNames[selectedMonth - 1]})
          </span>
          <div className="mt-2 text-3xl font-bold text-ink">{birthdayClients.length}</div>
          <p className="mt-1 text-xs text-ink-muted">Clientes com data cadastrada no período</p>
        </div>
      </div>

      {/* Barra de Filtros por Mês */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-ink-muted" />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-canvas/40 pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setFilterTodayOnly(true);
                setSelectedMonth(currentMonth);
              }}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                filterTodayOnly
                  ? "bg-amber-500 text-white font-semibold"
                  : "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              }`}
            >
              🎂 Apenas Hoje ({todayCount})
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterTodayOnly(false);
                setSelectedMonth(currentMonth);
              }}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                !filterTodayOnly && selectedMonth === currentMonth
                  ? "bg-accent text-accent-ink font-semibold"
                  : "text-ink-secondary hover:text-ink hover:bg-canvas/50"
              }`}
            >
              Este Mês
            </button>

            <select
              value={selectedMonth}
              onChange={(e) => {
                setFilterTodayOnly(false);
                setSelectedMonth(Number(e.target.value));
              }}
              className="rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
            >
              {monthNames.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <span className="text-xs text-ink-muted">{birthdayClients.length} aniversariante(s)</span>
      </div>

      {/* Lista de Aniversariantes */}
      <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="mt-3 text-xs text-ink-muted">Carregando aniversariantes...</p>
          </div>
        ) : birthdayClients.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-muted space-y-1">
            <p className="font-bold text-sm text-ink">Nenhum aniversariante encontrado.</p>
            <p>
              Cadastre a data de nascimento dos seus clientes na ficha para receber os alertas aqui.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Dia do Aniversário</th>
                  <th className="py-3 px-4">Idade</th>
                  <th className="py-3 px-4">Total de Visitas</th>
                  <th className="py-3 px-4 text-right">Mensagem de Parabéns</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {birthdayClients.map((client) => {
                  const phoneDigits = client.phone.replace(/\D/g, "");
                  const congratulationsMsg = encodeURIComponent(
                    `Parabéns, ${client.name}! 🎂🎉\n\nToda a equipe do ${session.company.companyName} deseja a você um novo ciclo repleto de saúde, beleza e muitas conquistas!\n\nPara comemorar, preparamos um carinho especial para o seu próximo atendimento conosco. Venha celebrar com a gente!`,
                  );
                  const waLink = phoneDigits
                    ? `https://wa.me/55${phoneDigits}?text=${congratulationsMsg}`
                    : null;

                  return (
                    <tr
                      key={client.id}
                      className={`hover:bg-canvas/30 transition-colors ${
                        client.isToday ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/owner/clients/${client.id}`}
                            className="font-semibold text-ink hover:text-accent hover:underline"
                          >
                            {client.name}
                          </Link>
                          {client.isToday && (
                            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-amber-500 text-white shadow-xs">
                              Hoje! 🎂
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-ink-muted font-mono">{client.phone}</span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-bold text-ink">
                        Dia {client.bDay} de {monthNames[client.bMonth - 1]}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-ink-muted">
                        {client.age ? `${client.age} anos` : "—"}
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
                            Enviar Parabéns
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
