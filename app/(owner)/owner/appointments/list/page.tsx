"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Clock3,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  UserX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import { formatDateTimeInTimezone, formatPrice, formatTimeInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import type { Appointment, AppointmentStatus } from "@/lib/types/appointment";
import type { Collaborator } from "@/lib/types/team";

const dayInMs = 86_400_000;

function formatIsoInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

const statusBadgeStyles: Record<AppointmentStatus, { label: string; className: string }> = {
  COMPLETED: {
    label: "Concluído",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  CONFIRMED: {
    label: "Confirmado",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  PENDING: {
    label: "Agendado / Pendente",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  CANCELED: {
    label: "Cancelado",
    className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
  },
  NO_SHOW: {
    label: "Não Compareceu",
    className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
  },
};

export default function AppointmentsListPage() {
  const { session } = useSession();
  const { locale, t } = useLocale();
  const timezone = session.company.timezone;
  const currency = session.company.currency ?? "BRL";

  const todayIso = useMemo(() => formatIsoInTimezone(new Date(), timezone), [timezone]);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(Date.now() - 30 * dayInMs);
    return formatIsoInTimezone(d, timezone);
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date(Date.now() + 30 * dayInMs);
    return formatIsoInTimezone(d, timezone);
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);

  const collaboratorMap = useMemo(() => {
    const map = new Map<string, Collaborator>();
    for (const c of collaborators) map.set(c.id, c);
    return map;
  }, [collaborators]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const fromIso = `${fromDate}T00:00:00.000Z`;
      const toIso = `${toDate}T23:59:59.999Z`;

      const [apps, collabRaw] = await Promise.all([
        apiRequest<Appointment[]>("/appointments", {
          query: { from: fromIso, to: toIso },
        }),
        apiRequest<{ collaborators: Collaborator[] } | Collaborator[]>("/collaborators"),
      ]);

      setAppointments(apps);
      setCollaborators(Array.isArray(collabRaw) ? collabRaw : collabRaw.collaborators ?? []);
    } catch {
      toast.error("Erro ao carregar lista de agendamentos.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filtro em memória por busca e status
  const filteredAppointments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return appointments.filter((app) => {
      if (statusFilter !== "ALL" && app.status !== statusFilter) return false;
      if (term) {
        const matchesClient = app.clientName.toLowerCase().includes(term);
        const matchesPhone = app.clientPhone.toLowerCase().includes(term);
        const matchesService = app.serviceNameSnapshot.toLowerCase().includes(term);
        if (!matchesClient && !matchesPhone && !matchesService) return false;
      }
      return true;
    });
  }, [appointments, search, statusFilter]);

  // Exportação para arquivo CSV com UTF-8 BOM
  const handleExportCsv = () => {
    if (filteredAppointments.length === 0) {
      toast.warning("Não há agendamentos filtrados para exportar.");
      return;
    }

    const headers = [
      "Data",
      "Hora",
      "Cliente",
      "Telefone",
      "Profissional",
      "Serviço",
      "Duração (min)",
      "Valor (R$)",
      "Status",
      "Observações",
    ];

    const rows = filteredAppointments.map((app) => {
      const dateStr = formatDateTimeInTimezone(app.startsAt, timezone, locale).split(" ")[0] ?? "";
      const timeStr = formatTimeInTimezone(app.startsAt, timezone, locale);
      const collab = collaboratorMap.get(app.collaboratorId);
      const priceStr = (app.servicePriceInCentsSnapshot / 100).toFixed(2);
      const statusLabel = statusBadgeStyles[app.status]?.label ?? app.status;

      return [
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${app.clientName.replace(/"/g, '""')}"`,
        `"${app.clientPhone}"`,
        `"${(collab?.name ?? "Profissional").replace(/"/g, '""')}"`,
        `"${app.serviceNameSnapshot.replace(/"/g, '""')}"`,
        app.serviceDurationMinutesSnapshot,
        priceStr,
        `"${statusLabel}"`,
        `"${(app.notes ?? "").replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `agendamentos_${fromDate}_a_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Arquivo CSV exportado com sucesso!");
  };

  const handleQuickPeriod = (mode: "today" | "7days" | "30days" | "thisMonth") => {
    const now = new Date();
    if (mode === "today") {
      setFromDate(todayIso);
      setToDate(todayIso);
    } else if (mode === "7days") {
      setFromDate(formatIsoInTimezone(new Date(now.getTime() - 7 * dayInMs), timezone));
      setToDate(todayIso);
    } else if (mode === "30days") {
      setFromDate(formatIsoInTimezone(new Date(now.getTime() - 30 * dayInMs), timezone));
      setToDate(todayIso);
    } else if (mode === "thisMonth") {
      const [y, m] = todayIso.split("-").map(Number);
      const first = new Date(Date.UTC(y, m - 1, 1));
      const last = new Date(Date.UTC(y, m, 0));
      setFromDate(formatIsoInTimezone(first, timezone));
      setToDate(formatIsoInTimezone(last, timezone));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com título, botões de atalho e exportação */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
            Listagem de Agendamentos
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Visualize, filtre e exporte o histórico completo de atendimentos da sua empresa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || filteredAppointments.length === 0}
            className="flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download size={14} />
            Salvar em CSV
          </button>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="grid size-9 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink disabled:opacity-50 transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="rounded-2xl border border-border-subtle bg-surface p-4 space-y-4 shadow-xs">
        {/* Linha 1: Período e Botões Rápidos */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-ink-secondary">Período:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
            />
            <span className="text-ink-muted">até</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
            />
          </div>

          <div className="flex rounded-xl border border-border-subtle bg-canvas/40 p-1 text-xs">
            <button
              type="button"
              onClick={() => handleQuickPeriod("today")}
              className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => handleQuickPeriod("7days")}
              className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors"
            >
              7 dias
            </button>
            <button
              type="button"
              onClick={() => handleQuickPeriod("thisMonth")}
              className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors"
            >
              Este mês
            </button>
            <button
              type="button"
              onClick={() => handleQuickPeriod("30days")}
              className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors"
            >
              30 dias
            </button>
          </div>
        </div>

        {/* Linha 2: Busca por cliente/telefone e Filtro de Status */}
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-muted" />
            <input
              type="text"
              placeholder="Buscar por cliente, telefone ou serviço..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-canvas/40 pl-9 pr-3 py-2 text-xs text-ink outline-none focus-visible:border-accent"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink outline-none focus-visible:border-accent"
          >
            <option value="ALL">Todos os Status</option>
            <option value="PENDING">Agendado / Pendente</option>
            <option value="CONFIRMED">Confirmado</option>
            <option value="COMPLETED">Concluído</option>
            <option value="CANCELED">Cancelado</option>
            <option value="NO_SHOW">Faltou (Não Compareceu)</option>
          </select>
        </div>
      </div>

      {/* Tabela de Agendamentos */}
      <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="mt-3 text-xs text-ink-muted">Carregando listagem de agendamentos...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-muted">
            Nenhum agendamento encontrado para o filtro e período selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">Data e Hora</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Profissional</th>
                  <th className="py-3 px-4">Serviço</th>
                  <th className="py-3 px-4">Duração</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filteredAppointments.map((app) => {
                  const collab = collaboratorMap.get(app.collaboratorId);
                  const st = statusBadgeStyles[app.status] ?? statusBadgeStyles.PENDING;
                  const formattedDateTime = formatDateTimeInTimezone(app.startsAt, timezone, locale);

                  return (
                    <tr key={app.id} className="hover:bg-canvas/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-ink whitespace-nowrap">
                        {formattedDateTime}
                      </td>
                      <td className="py-3 px-4 min-w-[140px]">
                        <p className="font-semibold text-ink truncate">{app.clientName}</p>
                        <p className="text-[11px] text-ink-muted font-mono">{app.clientPhone}</p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-ink-secondary">
                        {collab?.name ?? "Profissional"}
                      </td>
                      <td className="py-3 px-4 max-w-[200px] truncate text-ink font-medium">
                        {app.serviceNameSnapshot}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-ink-muted">
                        {app.serviceDurationMinutesSnapshot} min
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-ink">
                        {formatPrice(app.servicePriceInCentsSnapshot / 100, locale, currency)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${st.className}`}
                        >
                          {st.label}
                        </span>
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
