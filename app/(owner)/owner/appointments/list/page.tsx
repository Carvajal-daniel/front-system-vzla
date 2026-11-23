"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import { formatDateTimeInTimezone, formatPrice, formatTimeInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { AgendaStatusBadge } from "@/components/ui/agenda-status";
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

const statusLabels: Record<AppointmentStatus, string> = {
  COMPLETED: "Concluído",
  CONFIRMED: "Confirmado",
  PENDING: "Agendado / Pendente",
  CANCELED: "Cancelado",
  NO_SHOW: "Não Compareceu",
};

const focusClass = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const filterControl = `h-10 min-w-0 rounded-lg border border-border-strong bg-surface px-3 text-sm text-ink ${focusClass}`;
const dateControl = `${filterControl} dark:[color-scheme:dark]`;

export default function AppointmentsListPage() {
  const { session } = useSession();
  const { locale } = useLocale();
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
      const statusLabel = Object.hasOwn(statusLabels, app.status) ? statusLabels[app.status] : app.status;

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
          <h2 id="appointments-list-title" className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
            Listagem de Agendamentos
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-secondary">
            Visualize, filtre e exporte o histórico completo de atendimentos da sua empresa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || filteredAppointments.length === 0}
            className={`flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer ${focusClass}`}
          >
            <Download size={14} aria-hidden="true" />
            Salvar em CSV
          </button>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className={`grid size-9 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink disabled:opacity-50 transition-colors ${focusClass}`}
            aria-label="Atualizar lista"
            title="Atualizar lista"
          >
            <RefreshCw size={14} aria-hidden="true" className={loading ? "animate-spin" : ""} />
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
              aria-label="Data inicial"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={dateControl}
            />
            <div className="flex items-center gap-2">
              <span className="text-ink-secondary">até</span>
              <input
                type="date"
                aria-label="Data final"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className={dateControl}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1 rounded-xl border border-border-subtle bg-canvas/40 p-1 text-xs">
            <button
              type="button"
              onClick={() => handleQuickPeriod("today")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors ${focusClass}`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => handleQuickPeriod("7days")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors ${focusClass}`}
            >
              7 dias
            </button>
            <button
              type="button"
              onClick={() => handleQuickPeriod("thisMonth")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors ${focusClass}`}
            >
              Este mês
            </button>
            <button
              type="button"
              onClick={() => handleQuickPeriod("30days")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors ${focusClass}`}
            >
              30 dias
            </button>
          </div>
        </div>

        {/* Linha 2: Busca por cliente/telefone e Filtro de Status */}
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="relative min-w-0">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-secondary" />
            <input
              type="text"
              autoComplete="off"
              aria-label="Buscar por cliente, telefone ou serviço"
              placeholder="Buscar por cliente, telefone ou serviço..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${filterControl} w-full pl-9 placeholder:text-ink-secondary`}
            />
          </div>

          <select
            aria-label="Status do agendamento"
            autoComplete="off"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${filterControl} w-full`}
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
          <div role="status" className="flex flex-col items-center justify-center py-20">
            <Loader2 aria-hidden="true" className="size-8 animate-spin text-accent" />
            <p className="mt-3 text-xs text-ink-secondary">Carregando listagem de agendamentos...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div role="status" className="py-16 text-center text-xs text-ink-secondary">
            Nenhum agendamento encontrado para o filtro e período selecionados.
          </div>
        ) : (
          <div
            role="region"
            aria-labelledby="appointments-list-title"
            tabIndex={0}
            className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          >
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas/50 border-b border-border-subtle text-ink-secondary font-semibold">
                <tr>
                  <th scope="col" className="py-3 px-4">Data e Hora</th>
                  <th scope="col" className="py-3 px-4">Cliente</th>
                  <th scope="col" className="py-3 px-4">Profissional</th>
                  <th scope="col" className="py-3 px-4">Serviço</th>
                  <th scope="col" className="py-3 px-4 text-right">Duração</th>
                  <th scope="col" className="py-3 px-4 text-right">Valor</th>
                  <th scope="col" className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filteredAppointments.map((app) => {
                  const collab = collaboratorMap.get(app.collaboratorId);
                  const status = Object.hasOwn(statusLabels, app.status) ? app.status : "PENDING";
                  const formattedDateTime = formatDateTimeInTimezone(app.startsAt, timezone, locale);

                  return (
                    <tr key={app.id} className="hover:bg-canvas/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-ink whitespace-nowrap">
                        {formattedDateTime}
                      </td>
                      <td className="py-3 px-4 min-w-[140px]">
                        <p className="font-semibold text-ink truncate">{app.clientName}</p>
                        <p className="text-[11px] text-ink-secondary font-mono">{app.clientPhone}</p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-ink-secondary">
                        {collab?.name ?? "Profissional"}
                      </td>
                      <td className="py-3 px-4 max-w-[200px] truncate text-ink font-medium">
                        {app.serviceNameSnapshot}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right tabular-nums text-ink-secondary">
                        {app.serviceDurationMinutesSnapshot} min
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right font-medium tabular-nums text-ink">
                        {formatPrice(app.servicePriceInCentsSnapshot / 100, locale, currency)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <AgendaStatusBadge status={status} label={statusLabels[status]} />
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
