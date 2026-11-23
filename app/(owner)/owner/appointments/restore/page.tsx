"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import {
  formatDateTimeInTimezone,
  formatPrice,
  formatTimeInTimezone,
} from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { AgendaDialog } from "@/components/ui/agenda-controls";
import type { Appointment, CreateAppointmentPayload } from "@/lib/types/appointment";
import type { PublicAvailabilityResponse } from "@/lib/types/public-booking";
import type { ServiceCollaboratorsResponse } from "@/lib/types/service";
import type { Collaborator } from "@/lib/types/team";

const dayInMs = 86_400_000;

interface AvailableCollaboratorOption {
  collaborator: Collaborator;
  isOriginal: boolean;
  slots: Array<{ startsAt: string; endsAt: string }>;
}

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
  const { locale } = useLocale();
  const isEs = locale === "es";
  const timezone = session.company.timezone;
  const currency = session.company.currency ?? "BRL";

  const copy = useMemo(
    () =>
      isEs
        ? {
            title: "Restaurar Citas",
            subtitle:
              "Recupera reservas canceladas y reubícalas en un horario libre compatible con el servicio.",
            openAgenda: "Abrir Agenda",
            refreshTitle: "Actualizar lista",
            periodLabel: "Período de cancelación:",
            until: "hasta",
            foundCount: (count: number) => `${count} cita(s) cancelada(s) encontrada(s)`,
            loadingList: "Buscando cancelaciones en el período...",
            emptyList: "No se encontraron citas canceladas en este período.",
            loadError: "Error al cargar las citas canceladas.",
            colOriginalDate: "Fecha Original",
            colClient: "Cliente",
            colProfessional: "Profesional",
            colService: "Servicio",
            colPrice: "Valor",
            colReason: "Motivo de Cancelación",
            colAction: "Acción",
            defaultProfessional: "Profesional",
            noReason: "Motivo no informado",
            restoreBtn: "Restaurar",
            modalTitle: "Reagendar / Encajar Cita Cancelada",
            clientLabel: "Cliente",
            serviceLabel: "Servicio",
            durationLabel: (min: number) => `${min} min`,
            originalSlotLabel: "Horario cancelado",
            newDateLabel: "Nueva fecha",
            searchingDate: "Buscando próxima fecha con disponibilidad...",
            suggestedNextDate: (date: string) => `Próxima fecha libre sugerida: ${date}`,
            availableProfessionalsLabel: "Profesionales libres en esta fecha",
            originalBadge: "Original",
            slotsCount: (n: number) => `${n} horario(s)`,
            loadingSlots: "Consultando disponibilidad en la agenda...",
            noProfessionalsAvailable:
              "No hay profesionales con horarios libres para este servicio en la fecha elegida. Prueba otra fecha.",
            availableTimesLabel: "Horarios libres compatibles",
            statusLabel: "Estado inicial de la cita",
            statusConfirmed: "Confirmada",
            statusPending: "Pendiente",
            cancelBtn: "Cancelar",
            confirmRestoreBtn: "Confirmar Encaje",
            savingBtn: "Guardando...",
            restoreSuccess: (clientName: string) =>
              `¡Cita de ${clientName} restaurada y encajada con éxito!`,
            restoreError:
              "No fue posible restaurar la cita. El horario pudo haber sido ocupado recientemente.",
            restoredNoteTag: "Restaurado de cita cancelada",
          }
        : {
            title: "Restaurar Agendamentos",
            subtitle:
              "Recupere reservas canceladas e encaixe-as em um horário livre compatível com a duração do serviço.",
            openAgenda: "Abrir Agenda",
            refreshTitle: "Atualizar lista",
            periodLabel: "Período de cancelamento:",
            until: "até",
            foundCount: (count: number) =>
              `${count} agendamento(s) cancelado(s) encontrado(s)`,
            loadingList: "Buscando cancelamentos no período...",
            emptyList: "Nenhum agendamento cancelado encontrado neste período.",
            loadError: "Erro ao carregar agendamentos cancelados.",
            colOriginalDate: "Data Original",
            colClient: "Cliente",
            colProfessional: "Profissional",
            colService: "Serviço",
            colPrice: "Valor",
            colReason: "Motivo do Cancelamento",
            colAction: "Ação",
            defaultProfessional: "Profissional",
            noReason: "Motivo não informado",
            restoreBtn: "Restaurar",
            modalTitle: "Reagendar / Encaixar Agendamento",
            clientLabel: "Cliente",
            serviceLabel: "Serviço",
            durationLabel: (min: number) => `${min} min`,
            originalSlotLabel: "Horário cancelado",
            newDateLabel: "Nova data",
            searchingDate: "Buscando próxima data com horário livre...",
            suggestedNextDate: (date: string) => `Próxima data livre sugerida: ${date}`,
            availableProfessionalsLabel: "Profissionais livres nesta data",
            originalBadge: "Original",
            slotsCount: (n: number) => `${n} horário(s)`,
            loadingSlots: "Consultando disponibilidade na agenda...",
            noProfessionalsAvailable:
              "Nenhum profissional com horário livre para este serviço na data escolhida. Tente outra data.",
            availableTimesLabel: "Horários livres compatíveis",
            statusLabel: "Status inicial do agendamento",
            statusConfirmed: "Confirmado",
            statusPending: "Pendente",
            cancelBtn: "Cancelar",
            confirmRestoreBtn: "Confirmar Encaixe",
            savingBtn: "Salvando...",
            restoreSuccess: (clientName: string) =>
              `Agendamento de ${clientName} restaurado e encaixado com sucesso!`,
            restoreError:
              "Não foi possível restaurar o agendamento. O horário pode ter sido ocupado recentemente.",
            restoredNoteTag: "Restaurado de agendamento cancelado",
          },
    [isEs],
  );

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

  // Estado do Modal de Reagendamento / Encaixe Inteligente
  const [selectedApp, setSelectedApp] = useState<Appointment | null>(null);
  const [eligibleCollaborators, setEligibleCollaborators] = useState<Collaborator[]>([]);
  const [targetDate, setTargetDate] = useState<string>("");
  const [suggestedDate, setSuggestedDate] = useState<string | null>(null);
  const [findingInitialDate, setFindingInitialDate] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availableOptions, setAvailableOptions] = useState<AvailableCollaboratorOption[]>([]);
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string>("");
  const [selectedSlotStartsAt, setSelectedSlotStartsAt] = useState<string>("");
  const [initialStatus, setInitialStatus] = useState<"CONFIRMED" | "PENDING">("CONFIRMED");
  const [submitting, setSubmitting] = useState(false);

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
      toast.error(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, fromDate, toDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Ao abrir o modal de encaixe, identifica profissionais habilitados para o serviço e sugere hoje ou a próxima data livre
  useEffect(() => {
    if (!selectedApp) return;

    const controller = new AbortController();
    let cancelled = false;

    async function prepareModal() {
      if (!selectedApp) return;
      setFindingInitialDate(true);
      setAvailableOptions([]);
      setSelectedCollaboratorId("");
      setSelectedSlotStartsAt("");
      setSuggestedDate(null);
      setInitialStatus("CONFIRMED");

      try {
        const serviceLinks = await apiRequest<ServiceCollaboratorsResponse>(
          `/services/${encodeURIComponent(selectedApp.serviceId)}/collaborators`,
          { signal: controller.signal },
        ).catch(() => null);

        const activeLinkedIds = serviceLinks
          ? new Set(
              serviceLinks.collaborators
                .filter((entry) => entry.isActive)
                .map((entry) => entry.collaboratorId),
            )
          : null;

        // Filtra apenas profissionais ativos habilitados para o serviço, mantendo o original em primeiro lugar
        const activeCollabs = collaborators
          .filter(
            (c) =>
              c.isActive &&
              (activeLinkedIds ? activeLinkedIds.has(c.id) : true),
          )
          .sort((a, b) => {
            if (a.id === selectedApp.collaboratorId) return -1;
            if (b.id === selectedApp.collaboratorId) return 1;
            return a.name.localeCompare(b.name);
          });

        if (cancelled) return;
        setEligibleCollaborators(activeCollabs);

        const rangeEndIso = formatIsoInTimezone(new Date(Date.now() + 30 * dayInMs), timezone);

        // Consulta dias livres nos próximos 30 dias para sugerir hoje ou a próxima data livre
        const dayResults = await Promise.all(
          activeCollabs.map((c) =>
            apiRequest<{ availableDays?: string[] }>("/appointments/availability", {
              query: {
                serviceId: selectedApp.serviceId,
                collaboratorId: c.id,
                from: todayIso,
                to: rangeEndIso,
              },
              signal: controller.signal,
            })
              .then((res) => ({
                collaboratorId: c.id,
                days: Array.isArray(res.availableDays) ? res.availableDays : [],
              }))
              .catch(() => ({ collaboratorId: c.id, days: [] as string[] })),
          ),
        );

        if (cancelled) return;

        const allFreeDays = Array.from(
          new Set(dayResults.flatMap((r) => r.days).filter((d) => d >= todayIso)),
        ).sort();

        const nextFreeDate = allFreeDays[0] ?? todayIso;
        setTargetDate(nextFreeDate);
        setSuggestedDate(allFreeDays[0] ?? null);
      } finally {
        if (!cancelled) setFindingInitialDate(false);
      }
    }

    void prepareModal();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [collaborators, selectedApp, timezone, todayIso]);

  // Sempre que a data escolhida ou a lista de profissionais elegíveis mudar, consulta horários livres em /appointments/availability
  useEffect(() => {
    if (!selectedApp || !targetDate || findingInitialDate) return;

    const controller = new AbortController();
    let cancelled = false;

    async function loadAvailabilityForDate() {
      if (!selectedApp) return;
      setLoadingSlots(true);
      setAvailableOptions([]);
      setSelectedCollaboratorId("");
      setSelectedSlotStartsAt("");

      try {
        const results = await Promise.all(
          eligibleCollaborators.map((collab) =>
            apiRequest<PublicAvailabilityResponse>("/appointments/availability", {
              query: {
                serviceId: selectedApp.serviceId,
                collaboratorId: collab.id,
                date: targetDate,
              },
              signal: controller.signal,
            })
              .then((res) => ({
                collaborator: collab,
                isOriginal: collab.id === selectedApp.collaboratorId,
                slots: Array.isArray(res.slots) ? res.slots : [],
              }))
              .catch(() => ({
                collaborator: collab,
                isOriginal: collab.id === selectedApp.collaboratorId,
                slots: [] as Array<{ startsAt: string; endsAt: string }>,
              })),
          ),
        );

        if (cancelled) return;

        // Mantém apenas profissionais que possuem ao menos 1 horário livre, destacando o profissional original no topo
        const freeOnly = results
          .filter((item) => item.slots.length > 0)
          .sort((a, b) => {
            if (a.isOriginal && !b.isOriginal) return -1;
            if (!a.isOriginal && b.isOriginal) return 1;
            return a.collaborator.name.localeCompare(b.collaborator.name);
          });

        setAvailableOptions(freeOnly);
        if (freeOnly.length > 0) {
          setSelectedCollaboratorId(freeOnly[0].collaborator.id);
          setSelectedSlotStartsAt(freeOnly[0].slots[0]?.startsAt ?? "");
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }

    void loadAvailabilityForDate();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [eligibleCollaborators, findingInitialDate, selectedApp, targetDate]);

  const activeCollaboratorOption = useMemo(
    () =>
      availableOptions.find((opt) => opt.collaborator.id === selectedCollaboratorId) ??
      null,
    [availableOptions, selectedCollaboratorId],
  );

  const closeModal = () => {
    if (submitting) return;
    setSelectedApp(null);
    setTargetDate("");
    setAvailableOptions([]);
    setSelectedCollaboratorId("");
    setSelectedSlotStartsAt("");
  };

  // Confirma a restauração criando o novo agendamento no horário livre escolhido
  const handleConfirmRestore = async () => {
    if (!selectedApp || !selectedCollaboratorId || !selectedSlotStartsAt) return;
    setSubmitting(true);
    try {
      const payload: CreateAppointmentPayload = {
        serviceId: selectedApp.serviceId,
        collaboratorId: selectedCollaboratorId,
        startsAt: selectedSlotStartsAt,
        clientName: selectedApp.clientName,
        clientPhone: selectedApp.clientPhone,
        initialStatus,
        notes: selectedApp.notes
          ? `${selectedApp.notes} [${copy.restoredNoteTag}]`
          : copy.restoredNoteTag,
      };

      await apiRequest<Appointment>("/appointments", {
        method: "POST",
        body: payload,
      });

      setCanceledAppointments((prev) => prev.filter((item) => item.id !== selectedApp.id));
      toast.success(copy.restoreSuccess(selectedApp.clientName));
      setSelectedApp(null);
    } catch {
      toast.error(copy.restoreError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <RotateCcw className="size-6 text-accent" />
            {copy.title}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">{copy.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/owner/appointments"
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-xs font-semibold text-ink hover:border-accent transition-colors"
          >
            {copy.openAgenda}
            <ExternalLink size={13} />
          </Link>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="grid size-9 cursor-pointer place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            title={copy.refreshTitle}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filtro de Período */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-ink-secondary">{copy.periodLabel}</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="cursor-pointer rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
          />
          <span className="text-ink-muted">{copy.until}</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="cursor-pointer rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
          />
        </div>

        <span className="text-xs text-ink-muted">
          {copy.foundCount(canceledAppointments.length)}
        </span>
      </div>

      {/* Lista de Agendamentos Cancelados com Botão de Restaurar */}
      <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="mt-3 text-xs text-ink-muted">{copy.loadingList}</p>
          </div>
        ) : canceledAppointments.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-muted">{copy.emptyList}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">{copy.colOriginalDate}</th>
                  <th className="py-3 px-4">{copy.colClient}</th>
                  <th className="py-3 px-4">{copy.colProfessional}</th>
                  <th className="py-3 px-4">{copy.colService}</th>
                  <th className="py-3 px-4">{copy.colPrice}</th>
                  <th className="py-3 px-4">{copy.colReason}</th>
                  <th className="py-3 px-4 text-right">{copy.colAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {canceledAppointments.map((app) => {
                  const collab = collaboratorMap.get(app.collaboratorId);
                  const formattedDateTime = formatDateTimeInTimezone(
                    app.startsAt,
                    timezone,
                    locale,
                  );

                  return (
                    <tr key={app.id} className="hover:bg-canvas/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-ink whitespace-nowrap">
                        {formattedDateTime}
                      </td>
                      <td className="py-3 px-4 min-w-[140px]">
                        <p className="font-semibold text-ink truncate">{app.clientName}</p>
                        <p className="text-[11px] text-ink-muted font-mono">
                          {app.clientPhone}
                        </p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-ink-secondary">
                        {collab?.name ?? copy.defaultProfessional}
                      </td>
                      <td className="py-3 px-4 max-w-[180px] truncate text-ink font-medium">
                        {app.serviceNameSnapshot}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-ink">
                        {formatPrice(app.servicePriceInCentsSnapshot / 100, locale, currency)}
                      </td>
                      <td className="py-3 px-4 max-w-[220px]">
                        <span className="text-rose-500 font-medium">
                          {app.cancellationReason || copy.noReason}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedApp(app)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors"
                        >
                          <RotateCcw size={13} />
                          {copy.restoreBtn}
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

      {/* Modal de Reagendamento / Encaixe Inteligente */}
      {selectedApp && (
        <AgendaDialog
          centered
          title={copy.modalTitle}
          closeDisabled={submitting}
          onClose={closeModal}
        >
          <div className="space-y-4">
            {/* Resumo pré-preenchido do Cliente e Serviço */}
            <div className="rounded-xl border border-border-subtle bg-subtle/40 p-3.5 space-y-2 text-xs">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-[11px] font-medium text-ink-muted">
                    {copy.clientLabel}
                  </span>
                  <p className="font-semibold text-ink">{selectedApp.clientName}</p>
                  <p className="font-mono text-[11px] text-ink-secondary">
                    {selectedApp.clientPhone}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-ink-muted">
                    {copy.serviceLabel}
                  </span>
                  <p className="font-semibold text-ink">
                    {selectedApp.serviceNameSnapshot}
                  </p>
                  <p className="text-[11px] text-ink-secondary">
                    {copy.durationLabel(selectedApp.serviceDurationMinutesSnapshot)} ·{" "}
                    {formatPrice(
                      selectedApp.servicePriceInCentsSnapshot / 100,
                      locale,
                      currency,
                    )}
                  </p>
                </div>
              </div>
              <div className="border-t border-border-subtle/70 pt-2 text-[11px] text-ink-muted flex items-center gap-1.5">
                <CalendarDays size={12} className="shrink-0" />
                <span>
                  {copy.originalSlotLabel}:{" "}
                  <strong className="text-ink-secondary">
                    {formatDateTimeInTimezone(selectedApp.startsAt, timezone, locale)}
                  </strong>
                </span>
              </div>
            </div>

            {/* Escolha da Nova Data */}
            <div className="space-y-1.5">
              <label
                htmlFor="restore-target-date"
                className="block text-xs font-semibold text-ink"
              >
                {copy.newDateLabel}
              </label>
              <input
                id="restore-target-date"
                type="date"
                min={todayIso}
                value={targetDate}
                disabled={findingInitialDate || submitting}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full cursor-pointer rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-60"
              />
              {findingInitialDate ? (
                <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                  <Loader2 size={12} className="animate-spin text-accent" />
                  {copy.searchingDate}
                </p>
              ) : (
                suggestedDate && (
                  <p className="flex items-center gap-1.5 text-[11px] text-accent">
                    <Sparkles size={12} />
                    {copy.suggestedNextDate(suggestedDate)}
                  </p>
                )
              )}
            </div>

            {/* Profissionais Livres + Horários Disponíveis */}
            {!findingInitialDate && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-ink">
                  {copy.availableProfessionalsLabel}
                </p>

                {loadingSlots ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-border-subtle bg-canvas/40 py-6 text-xs text-ink-muted">
                    <Loader2 size={15} className="animate-spin text-accent" />
                    {copy.loadingSlots}
                  </div>
                ) : availableOptions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border-subtle bg-canvas/40 p-4 text-center text-xs text-ink-muted">
                    {copy.noProfessionalsAvailable}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {availableOptions.map((option) => {
                        const selected =
                          option.collaborator.id === selectedCollaboratorId;
                        return (
                          <button
                            key={option.collaborator.id}
                            type="button"
                            onClick={() => {
                              setSelectedCollaboratorId(option.collaborator.id);
                              setSelectedSlotStartsAt(option.slots[0]?.startsAt ?? "");
                            }}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                              selected
                                ? "border-accent bg-accent/15 text-accent"
                                : "border-border-subtle bg-surface text-ink hover:border-accent/60"
                            }`}
                          >
                            <UserCheck size={13} />
                            <span>{option.collaborator.name}</span>
                            {option.isOriginal && (
                              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                {copy.originalBadge}
                              </span>
                            )}
                            <span className="text-[10px] opacity-75">
                              ({copy.slotsCount(option.slots.length)})
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {activeCollaboratorOption && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                          <Clock size={13} className="text-accent" />
                          {copy.availableTimesLabel}
                        </p>
                        <div className="grid max-h-44 grid-cols-3 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-4">
                          {activeCollaboratorOption.slots.map((slot) => {
                            const active = selectedSlotStartsAt === slot.startsAt;
                            return (
                              <button
                                key={slot.startsAt}
                                type="button"
                                onClick={() => setSelectedSlotStartsAt(slot.startsAt)}
                                className={`cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                                  active
                                    ? "border-accent bg-accent text-accent-ink shadow-xs"
                                    : "border-border-subtle bg-surface text-ink hover:border-accent"
                                }`}
                              >
                                {formatTimeInTimezone(slot.startsAt, timezone, locale)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Status inicial do agendamento (padrão CONFIRMED, com opção de PENDING) */}
            <div className="space-y-1.5 border-t border-border-subtle pt-3">
              <p className="text-xs font-semibold text-ink">{copy.statusLabel}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInitialStatus("CONFIRMED")}
                  className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    initialStatus === "CONFIRMED"
                      ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "border-border-subtle bg-surface text-ink-secondary hover:border-accent"
                  }`}
                >
                  <CheckCircle2 size={14} />
                  {copy.statusConfirmed}
                </button>
                <button
                  type="button"
                  onClick={() => setInitialStatus("PENDING")}
                  className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    initialStatus === "PENDING"
                      ? "border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      : "border-border-subtle bg-surface text-ink-secondary hover:border-accent"
                  }`}
                >
                  <Clock size={14} />
                  {copy.statusPending}
                </button>
              </div>
            </div>

            {/* Rodapé de ações */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={closeModal}
                className="min-h-10 cursor-pointer rounded-xl border border-border-subtle bg-surface px-4 text-xs font-semibold text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-55"
              >
                {copy.cancelBtn}
              </button>
              <button
                type="button"
                disabled={
                  submitting ||
                  findingInitialDate ||
                  loadingSlots ||
                  !selectedCollaboratorId ||
                  !selectedSlotStartsAt
                }
                onClick={() => void handleConfirmRestore()}
                className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-4 text-xs font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-55"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {copy.savingBtn}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    {copy.confirmRestoreBtn}
                  </>
                )}
              </button>
            </div>
          </div>
        </AgendaDialog>
      )}
    </div>
  );
}
