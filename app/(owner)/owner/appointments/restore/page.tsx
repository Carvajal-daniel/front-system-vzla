"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  UserX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import { formatDateTimeInTimezone, formatPrice, formatTimeInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import type { Appointment, CreateAppointmentPayload } from "@/lib/types/appointment";
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

export default function RestoreAppointmentsPage() {
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

  const [canceledAppointments, setCanceledAppointments] = useState<Appointment[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

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
          query: { from: fromIso, to: toIso, status: "CANCELED" },
        }),
        apiRequest<{ collaborators: Collaborator[] } | Collaborator[]>("/collaborators"),
      ]);

      setCanceledAppointments(apps.filter((a) => a.status === "CANCELED"));
      setCollaborators(Array.isArray(collabRaw) ? collabRaw : collabRaw.collaborators ?? []);
    } catch {
      toast.error("Erro ao carregar agendamentos cancelados.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Restauração do agendamento para a Agenda (status PENDING) via API
  const handleRestoreAppointment = async (app: Appointment) => {
    setRestoringId(app.id);
    try {
      const payload: CreateAppointmentPayload = {
        serviceId: app.serviceId,
        collaboratorId: app.collaboratorId,
        startsAt: app.startsAt,
        clientName: app.clientName,
        clientPhone: app.clientPhone,
        initialStatus: "PENDING",
        notes: app.notes ? `${app.notes} [Restaurado de agendamento cancelado]` : "Restaurado de agendamento cancelado",
      };

      await apiRequest<Appointment>("/appointments", {
        method: "POST",
        body: payload,
      });

      // Remove da lista de cancelados
      setCanceledAppointments((prev) => prev.filter((item) => item.id !== app.id));
      toast.success(`Agendamento de ${app.clientName} restaurado com sucesso para a agenda!`);
    } catch (err) {
      toast.error(
        "Não foi possível restaurar o agendamento. Verifique se o horário já não foi ocupado por outro cliente.",
      );
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <RotateCcw className="size-6 text-accent" />
            Restaurar Agendamentos
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Recupere reservas canceladas no período e retorne-as para o calendário com status pendente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/owner/appointments"
            className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-xs font-semibold text-ink hover:border-accent transition-colors"
          >
            Abrir Agenda
            <ExternalLink size={13} />
          </Link>

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

      {/* Filtro de Período */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-ink-secondary">Período de cancelamento:</span>
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

        <span className="text-xs text-ink-muted">
          {canceledAppointments.length} agendamento(s) cancelado(s) encontrado(s)
        </span>
      </div>

      {/* Lista de Agendamentos Cancelados com Botão de Restaurar */}
      <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="mt-3 text-xs text-ink-muted">Buscando cancelamentos no período...</p>
          </div>
        ) : canceledAppointments.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-muted">
            Nenhum agendamento cancelado encontrado neste período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">Data Original</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Profissional</th>
                  <th className="py-3 px-4">Serviço</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Motivo do Cancelamento</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {canceledAppointments.map((app) => {
                  const collab = collaboratorMap.get(app.collaboratorId);
                  const formattedDateTime = formatDateTimeInTimezone(app.startsAt, timezone, locale);
                  const isRestoring = restoringId === app.id;

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
                      <td className="py-3 px-4 max-w-[180px] truncate text-ink font-medium">
                        {app.serviceNameSnapshot}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-ink">
                        {formatPrice(app.servicePriceInCentsSnapshot / 100, locale, currency)}
                      </td>
                      <td className="py-3 px-4 max-w-[220px]">
                        <span className="text-rose-500 font-medium">
                          {app.cancellationReason || "Motivo não informado"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isRestoring}
                          onClick={() => void handleRestoreAppointment(app)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isRestoring ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <RotateCcw size={13} />
                          )}
                          Restaurar
                        </button>
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
