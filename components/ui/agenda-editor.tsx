"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock,
  Clock3,
  Flame,
  Info,
  LoaderCircle,
  Plus,
  ShieldAlert,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { clientPhoneKey, getClientBookingStatus, useClients } from "@/lib/use-clients";
import { ApiError, apiRequest } from "@/lib/api-client";
import { agendaMonth, shiftAgendaDay } from "@/lib/agenda";
import {
  formatNationalPhoneDisplay,
  formatPhoneToE164,
  formatPriceFromCents,
  formatTimeInTimezone,
  isValidInternationalPhone,
  stripNonDigits,
} from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { agendaStrings } from "@/lib/i18n/agenda";
import type {
  Appointment,
  CreateAppointmentPayload,
  RescheduleAppointmentPayload,
} from "@/lib/types/appointment";
import type { Company } from "@/lib/types/auth";
import type { PhoneCountryCode, PublicAvailabilityResponse } from "@/lib/types/public-booking";
import type { Service, ServiceCollaboratorsResponse } from "@/lib/types/service";
import type { Collaborator } from "@/lib/types/team";
import { useWaitlist } from "@/lib/use-waitlist";
import { AgendaBlockForm } from "./agenda-block-form";
import { AgendaMonthGrid } from "./agenda-calendar";
import { AgendaDialog, AgendaSelect } from "./agenda-controls";

const field =
  "min-h-10 w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent";
const emptyDays = new Set<string>();

type Result<T> = { key: string; value?: T; failed?: boolean };
export type AgendaEditorTab = "appointment" | "block" | "waitlist";

function splitClientPhone(value: string, fallback: PhoneCountryCode) {
  const digits = stripNonDigits(value);
  if (/^55\d{10,11}$/.test(digits)) return { country: "+55" as const, digits: digits.slice(2) };
  if (/^58\d{10}$/.test(digits)) return { country: "+58" as const, digits: digits.slice(2) };
  return { country: fallback, digits };
}

export function AgendaEditor({
  company,
  collaborators,
  services,
  today,
  focusDate,
  initialDate,
  initialTime,
  initialEndTime,
  initialPersonId,
  initialTab = "appointment",
  initialClientName,
  initialClientPhone,
  initialServiceId,
  appointment,
  onClose,
  onSaved,
  onBlockSaved,
}: {
  company: Company;
  collaborators: Collaborator[];
  services: Service[];
  today: string;
  focusDate: string;
  initialDate?: string;
  initialTime?: string;
  initialEndTime?: string;
  initialPersonId?: string;
  initialTab?: AgendaEditorTab;
  initialClientName?: string;
  initialClientPhone?: string;
  initialServiceId?: string;
  appointment?: Appointment;
  onClose: () => void;
  onSaved: (appointment: Appointment) => void;
  onBlockSaved?: () => void;
}) {
  const { locale, t } = useLocale();
  const copy = agendaStrings(locale);
  const waitlist = useWaitlist(company.id);
  const { clients, loading: clientsLoading, createClient } = useClients(company.id);

  // Controle de abas: Novo Agendamento, Bloquear Agenda, Fila de Espera
  const [activeTab, setActiveTab] = useState<AgendaEditorTab>(
    appointment ? "appointment" : initialTab,
  );

  // ==========================================
  // ESTADOS DA ABA 1: NOVO AGENDAMENTO
  // ==========================================
  const initialD = appointment ? "" : initialDate ?? "";
  const [serviceId, setServiceId] = useState(
    appointment?.serviceId ?? initialServiceId ?? (services.length === 1 ? services[0].id : ""),
  );
  const [additionalServiceIds, setAdditionalServiceIds] = useState<string[]>([]);
  const [personId, setPersonId] = useState(
    appointment?.collaboratorId ?? initialPersonId ?? "",
  );
  const [month, setMonth] = useState(
    initialD && initialD >= today ? initialD : focusDate >= today ? focusDate : today,
  );
  const [date, setDate] = useState(initialD);
  const [time, setTime] = useState(appointment ? appointment.startsAt : initialTime ?? "");
  const selectedRange = initialTime && initialEndTime && initialD === date ? { start: initialTime, end: initialEndTime } : null;
  const [name, setName] = useState(initialClientName ?? "");
  const initialPhone = splitClientPhone(initialClientPhone ?? "", locale === "es" ? "+58" : "+55");
  const [phone, setPhone] = useState(initialPhone.digits);
  const [country, setCountry] = useState<PhoneCountryCode>(initialPhone.country);
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<"weekly" | "biweekly" | "monthly">(
    "weekly",
  );
  const [sendWhatsAppReminder, setSendWhatsAppReminder] = useState(true);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [phoneValidationError, setPhoneValidationError] = useState("");
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const [savingAppointment, setSavingAppointment] = useState(false);
  const [appointmentError, setAppointmentError] = useState("");
  const [refreshAvailability, setRefreshAvailability] = useState(0);

  const [links, setLinks] = useState<Result<string[]>>({ key: "" });
  const [availability, setAvailability] = useState<Result<string[]>>({ key: "" });
  const [slots, setSlots] = useState<Result<PublicAvailabilityResponse>>({ key: "" });

  // ==========================================
  // ESTADOS DA ABA 2: BLOQUEAR AGENDA
  // ==========================================
  const [savingBlock, setSavingBlock] = useState(false);

  // ==========================================
  // ESTADOS DA ABA 3: FILA DE ESPERA
  // ==========================================
  const [waitClientName, setWaitClientName] = useState(initialClientName ?? "");
  const [waitClientPhone, setWaitClientPhone] = useState(initialClientPhone ?? "");
  const [waitCountry, setWaitCountry] = useState<PhoneCountryCode>(
    locale === "es" ? "+58" : "+55",
  );
  const [waitServiceId, setWaitServiceId] = useState(initialServiceId ?? "");
  const [waitCollaboratorId, setWaitCollaboratorId] = useState("");
  const [waitTimingMode, setWaitTimingMode] = useState<"ANY_TIME" | "SPECIFIC">("ANY_TIME");
  const [waitPreferredDate, setWaitPreferredDate] = useState(initialD || today);
  const [waitPreferredTime, setWaitPreferredTime] = useState("14:00");
  const [waitNotes, setWaitNotes] = useState("");
  const [savingWaitlist, setSavingWaitlist] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");

  // ==========================================
  // LÓGICA DE MULTI-SERVIÇOS E PREÇO TOTAL
  // ==========================================
  const primaryService = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );

  const selectedServices = useMemo(() => {
    const list: Service[] = [];
    if (primaryService) list.push(primaryService);
    for (const id of additionalServiceIds) {
      const extra = services.find((s) => s.id === id);
      if (extra && !list.some((s) => s.id === extra.id)) {
        list.push(extra);
      }
    }
    return list;
  }, [primaryService, additionalServiceIds, services]);

  const totalDurationMinutes = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0),
    [selectedServices],
  );

  const totalPriceInCents = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.priceInCents, 0),
    [selectedServices],
  );

  // ==========================================
  // REGRA DO LEMBRETE WHATSAPP (MÍNIMO 6 HORAS)
  // ==========================================
  const isLessThanSixHours = useMemo(() => {
    if (!time) return false;
    const timeMs = new Date(time).getTime();
    if (Number.isNaN(timeMs)) return false;
    const sixHoursLater = Date.now() + 6 * 60 * 60 * 1000;
    return timeMs < sixHoursLater;
  }, [time]);

  // ==========================================
  // CONSULTAS DE DISPONIBILIDADE
  // ==========================================
  const { start, end } = agendaMonth(month);
  const from = start < today ? today : start;
  const to = shiftAgendaDay(end, -1);
  const availabilityKey = `${serviceId}/${personId}/${from}/${to}/${refreshAvailability}`;
  const slotKey = `${serviceId}/${personId}/${date}/${refreshAvailability}`;
  const appointmentId = appointment?.id;

  useEffect(() => {
    if (!serviceId) return;
    const controller = new AbortController();
    void apiRequest<ServiceCollaboratorsResponse>(
      `/services/${encodeURIComponent(serviceId)}/collaborators`,
      { signal: controller.signal },
    )
      .then((data) =>
        setLinks({
          key: serviceId,
          value: data.collaborators.filter((entry) => entry.isActive).map((entry) => entry.collaboratorId),
        }),
      )
      .catch(() => {
        if (!controller.signal.aborted) setLinks({ key: serviceId, failed: true });
      });
    return () => controller.abort();
  }, [serviceId]);

  useEffect(() => {
    if (!serviceId || !personId || from > to) return;
    const controller = new AbortController();
    void apiRequest<{ availableDays: string[] }>("/appointments/availability", {
      query: { serviceId, collaboratorId: personId, from, to, appointmentId },
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted)
          setAvailability({ key: availabilityKey, value: data.availableDays });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setAvailability({ key: availabilityKey, failed: true });
      });
    return () => controller.abort();
  }, [availabilityKey, appointmentId, from, personId, serviceId, to]);

  useEffect(() => {
    if (!serviceId || !personId || !date) return;
    const controller = new AbortController();
    void apiRequest<PublicAvailabilityResponse>("/appointments/availability", {
      query: { serviceId, collaboratorId: personId, date, appointmentId },
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setSlots({ key: slotKey, value: data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setSlots({ key: slotKey, failed: true });
      });
    return () => controller.abort();
  }, [appointmentId, date, personId, serviceId, slotKey]);

  const availableDays =
    availability.key === availabilityKey && availability.value
      ? new Set(availability.value)
      : emptyDays;
  const people = collaborators.filter((person) => person.isActive && (
    links.key === serviceId && links.value
      ? links.value.includes(person.id)
      : person.id === initialPersonId
  ));
  const activeSlots = slots.key === slotKey ? slots.value?.slots.filter((slot) => {
    if (!selectedRange) return true;
    const start = Date.parse(slot.startsAt);
    const end = Math.max(Date.parse(slot.endsAt), start + totalDurationMinutes * 60_000);
    return start >= Date.parse(selectedRange.start) && end <= Date.parse(selectedRange.end);
  }) : undefined;

  const matchingClients = useMemo(() => {
    if (!name.trim()) return [];
    const q = name.trim().toLowerCase();
    return clients.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").replace(/\D/g, "").includes(q),
    );
  }, [clients, name]);

  const clientPhone = appointment?.clientPhone || (isValidInternationalPhone(country, phone) ? formatPhoneToE164(country, phone) : "");
  const phoneKey = clientPhoneKey(clientPhone);
  const matchedClients = useMemo(() => clients.filter((client) => client.id === selectedClientId || Boolean(phoneKey && (
    clientPhoneKey(client.phone) === phoneKey || client.appointments.some((visit) => clientPhoneKey(visit.clientPhone) === phoneKey)
  ))), [clients, phoneKey, selectedClientId]);
  const isClientBlocked = matchedClients.some((client) => client.isBlocked) || getClientBookingStatus(company.id, clientPhone).isBlocked;
  const pendingDebt = matchedClients.reduce((sum, client) => sum + client.pendingDebtCents, 0);
  const canSaveAppointment = !!activeSlots?.some((slot) => Date.parse(slot.startsAt) === Date.parse(time)) && !isClientBlocked && !clientsLoading;
  const isChecking =
    !!serviceId && !!personId && from <= to && availability.key !== availabilityKey;
  const availabilityFailed = availability.key === availabilityKey && availability.failed;
  const slotsFailed = slots.key === slotKey && slots.failed;

  const selectDate = (day: string) => {
    setDate(day);
    setTime(day && day === initialD ? initialTime ?? "" : "");
  };

  // Cadastro rápido de novo cliente exigindo telefone válido (mínimo 8 dígitos)
  const handleQuickCreateClient = () => {
    const cleanDigits = stripNonDigits(phone);
    if (cleanDigits.length < 8) {
      setPhoneValidationError("Informe o WhatsApp/telefone obrigatório para cadastrar o cliente");
      phoneInputRef.current?.focus();
      return;
    }
    setPhoneValidationError("");
    try {
      createClient({ name: name.trim(), phone: formatPhoneToE164(country, phone) });
      toast.success(`Cliente "${name.trim()}" cadastrado com sucesso!`);
      setIsClientDropdownOpen(false);
    } catch {
      toast.error(t.errors.unexpectedDescription);
    }
  };

  // ==========================================
  // SUBMISSÃO: ABA 1 (NOVO AGENDAMENTO)
  // ==========================================
  async function submitAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSaveAppointment || savingAppointment || getClientBookingStatus(company.id, clientPhone).isBlocked) return;
    if (!appointment) {
      const cleanDigits = stripNonDigits(phone);
      if (cleanDigits.length < 8) {
        setPhoneValidationError("Informe o WhatsApp/telefone obrigatório para cadastrar o cliente");
        phoneInputRef.current?.focus();
        return;
      }
      if (!isValidInternationalPhone(country, phone)) {
        setPhoneValidationError(t.errors.invalidPhone);
        setAppointmentError(t.errors.invalidPhone);
        phoneInputRef.current?.focus();
        return;
      }
    }
    setPhoneValidationError("");
    setSavingAppointment(true);
    setAppointmentError("");

    // Constrói as notas incluindo serviços adicionais e recorrência se selecionados
    const extraServicesNote =
      additionalServiceIds.length > 0
        ? `\n[Serviços Adicionais]: ${selectedServices
            .slice(1)
            .map((s) => s.name)
            .join(", ")}`
        : "";
    const recurrenceNote = isRecurring ? `\n[Recorrência]: ${recurrenceInterval}` : "";
    const combinedNotes = `${notes.trim()}${extraServicesNote}${recurrenceNote}`.trim();

    const payload: CreateAppointmentPayload | RescheduleAppointmentPayload = appointment
      ? { startsAt: time, collaboratorId: personId }
      : {
          serviceId,
          collaboratorId: personId,
          startsAt: time,
          clientName: name.trim(),
          clientPhone: formatPhoneToE164(country, phone),
          notes: combinedNotes || undefined,
          initialStatus: confirmed ? "CONFIRMED" : "PENDING",
        };

    try {
      const saved = await apiRequest<Appointment>(
        appointment ? `/appointments/${appointment.id}/reschedule` : "/appointments",
        {
          method: appointment ? "PATCH" : "POST",
          body: payload,
        },
      );
      toast.success(
        appointment ? "Agendamento reprogramado com sucesso!" : "Agendamento criado com sucesso!",
      );
      onSaved(saved);
    } catch (failure) {
      setAppointmentError(
        failure instanceof ApiError &&
          /^Appointment must start on a \d+-minute boundary\.$/.test(failure.message)
          ? copy.slotBoundary
          : failure instanceof ApiError && failure.status === 409
            ? t.common.noAvailableSlotsForDay
            : t.errors.networkDescription,
      );
      setTime("");
      setRefreshAvailability((value) => value + 1);
    } finally {
      setSavingAppointment(false);
    }
  }

  // ==========================================
  // SUBMISSÃO: ABA 3 (FILA DE ESPERA)
  // ==========================================
  async function submitWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingWaitlist) return;

    if (!waitClientName.trim()) {
      setWaitlistError("Informe o nome do cliente.");
      return;
    }
    if (!isValidInternationalPhone(waitCountry, waitClientPhone)) {
      setWaitlistError(t.errors.invalidPhone);
      return;
    }
    if (!waitServiceId) {
      setWaitlistError("Selecione um serviço desejado.");
      return;
    }

    setSavingWaitlist(true);
    setWaitlistError("");

    try {
      const chosenService = services.find((s) => s.id === waitServiceId);
      const chosenCollab = collaborators.find((c) => c.id === waitCollaboratorId);

      waitlist.addEntry({
        clientName: waitClientName.trim(),
        clientPhone: formatPhoneToE164(waitCountry, waitClientPhone),
        serviceId: waitServiceId,
        serviceName: chosenService?.name ?? "Serviço",
        collaboratorId: waitCollaboratorId || null,
        collaboratorName: chosenCollab?.name ?? "Qualquer profissional",
        preferredTiming: waitTimingMode,
        preferredDate: waitTimingMode === "SPECIFIC" ? waitPreferredDate : undefined,
        preferredTime: waitTimingMode === "SPECIFIC" ? waitPreferredTime : undefined,
        notes: waitNotes.trim() || undefined,
      });

      toast.success("Cliente adicionado à fila de espera!");
      onClose();
    } catch {
      setWaitlistError("Falha ao registrar cliente na fila.");
    } finally {
      setSavingWaitlist(false);
    }
  }

  const dialogTitle = appointment
    ? t.owner.reschedule
    : activeTab === "appointment"
      ? "Novo Agendamento"
      : activeTab === "block"
        ? t.owner.newBlock
        : "Fila de Espera";

  return (
    <AgendaDialog
      title={dialogTitle}
      closeDisabled={savingAppointment || savingBlock || savingWaitlist}
      onClose={onClose}
    >
      {/* Abas superiores 3 em 1 (apenas quando não é reprogramação direta) */}
      {!appointment && (
        <div className="mb-4 flex rounded-xl border border-border-subtle bg-canvas/60 p-1 text-xs">
          <button
            type="button"
            disabled={savingBlock || savingAppointment || savingWaitlist}
            onClick={() => setActiveTab("appointment")}
            className={`flex-1 rounded-lg py-2 font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "appointment"
                ? "bg-accent text-accent-ink shadow-xs"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <CalendarDays className="size-3.5" />
            Novo Agendamento
          </button>

          <button
            type="button"
            disabled={savingBlock || savingAppointment || savingWaitlist}
            onClick={() => setActiveTab("block")}
            className={`flex-1 rounded-lg py-2 font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "block"
                ? "bg-accent text-accent-ink shadow-xs"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <Ban className="size-3.5" />
            Bloquear Agenda
          </button>

          <button
            type="button"
            disabled={savingBlock || savingAppointment || savingWaitlist}
            onClick={() => setActiveTab("waitlist")}
            className={`flex-1 rounded-lg py-2 font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "waitlist"
                ? "bg-accent text-accent-ink shadow-xs"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <Users className="size-3.5" />
            Fila de Espera
            {waitlist.count > 0 && (
              <span className="rounded-full bg-surface px-1.5 py-0.2 text-[10px] font-bold text-accent">
                {waitlist.count}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 1: NOVO AGENDAMENTO */}
      {/* ========================================================= */}
      {activeTab === "appointment" && (
        <form onSubmit={submitAppointment} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {appointment ? (
              <div>
                <p className="text-xs font-semibold text-ink-secondary">
                  {t.booking.stepService}
                </p>
                <p className="mt-2 text-sm font-semibold">{appointment.serviceNameSnapshot}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AgendaSelect
                  label={t.booking.stepService}
                  placeholder={copy.pickService}
                  value={serviceId}
                  options={services
                    .filter((service) => service.active)
                    .map((service) => ({
                      value: service.id,
                      label: `${service.name} · ${formatPriceFromCents(service.priceInCents, locale, company.currency)}`,
                    }))}
                  onChange={(value) => {
                    setServiceId(value);
                    if (!initialPersonId) setPersonId("");
                    if (!initialDate) selectDate("");
                  }}
                  disabled={savingAppointment}
                />

                {/* Opção de Múltiplos Serviços Adicionais */}
                {serviceId && services.filter((s) => s.active && s.id !== serviceId).length > 0 && (
                  <div className="rounded-xl border border-border-subtle/80 bg-canvas/30 p-2.5">
                    <p className="text-xs font-semibold text-ink-secondary mb-1.5">
                      + Adicionar serviços complementares:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {services
                        .filter((s) => s.active && s.id !== serviceId)
                        .map((extra) => {
                          const isSelected = additionalServiceIds.includes(extra.id);
                          return (
                            <button
                              key={extra.id}
                              type="button"
                              onClick={() => {
                                setAdditionalServiceIds((prev) =>
                                  isSelected
                                    ? prev.filter((id) => id !== extra.id)
                                    : [...prev, extra.id],
                                );
                              }}
                              className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors border ${
                                isSelected
                                  ? "border-accent bg-accent/15 text-accent font-semibold"
                                  : "border-border-subtle bg-surface text-ink-secondary hover:text-ink"
                              }`}
                            >
                              {isSelected ? "✓ " : "+ "}
                              {extra.name} ({formatPriceFromCents(extra.priceInCents, locale, company.currency)})
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <AgendaSelect
              label={copy.professional}
              placeholder={copy.pickProfessional}
              value={personId}
              options={people.map((person) => ({
                value: person.id,
                label: person.name,
                person,
              }))}
              onChange={(value) => {
                setPersonId(value);
                if (!initialDate) selectDate("");
              }}
              disabled={savingAppointment || !serviceId || links.key !== serviceId}
            />
          </div>

          {selectedRange && (
            <p className="rounded-xl bg-blue-500/10 px-3 py-2 text-sm text-ink">
              Intervalo selecionado · {formatTimeInTimezone(selectedRange.start, company.timezone, locale)}–{formatTimeInTimezone(selectedRange.end, company.timezone, locale)}
            </p>
          )}

          {/* Resumo acumulado de serviços, duração e valor */}
          {selectedServices.length > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-accent-soft/30 px-3 py-2 text-xs text-ink border border-accent/20">
              <span className="font-medium">
                {selectedServices.length} {selectedServices.length === 1 ? "serviço" : "serviços"} · Duração: {totalDurationMinutes} min
              </span>
              <span className="font-bold text-accent">
                Total: {formatPriceFromCents(totalPriceInCents, locale, company.currency)}
              </span>
            </div>
          )}

          {links.key === serviceId && links.failed && (
            <p role="alert" className="text-xs text-[var(--status-danger-ink)]">
              {t.errors.networkDescription}
            </p>
          )}

          {/* Grid do Mês e Horários Disponíveis */}
          <div className="grid gap-4 rounded-2xl border border-border-subtle bg-subtle/40 p-3 sm:grid-cols-[14rem_1fr] sm:p-4">
            <div className="mx-auto w-full max-w-58 sm:max-w-none">
              <AgendaMonthGrid
                month={month}
                selected={date}
                today={today}
                company={company}
                booking
                available={availableDays}
                onMonth={(value) => {
                  setMonth(value);
                  selectDate("");
                }}
                onSelect={selectDate}
              />
            </div>
            <div className="min-w-0 space-y-3 sm:border-l sm:border-border-subtle sm:pl-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Clock size={15} className="text-accent" />
                {t.common.availableSlotsLabel}
              </p>
              {!serviceId || !personId ? (
                <p className="text-xs text-ink-secondary">
                  {t.common.selectServiceAndProForSlots}
                </p>
              ) : isChecking || (date && slots.key !== slotKey) ? (
                <p role="status" className="text-xs text-ink-secondary">
                  {t.common.loading}
                </p>
              ) : availabilityFailed || slotsFailed ? (
                <button
                  type="button"
                  onClick={() => setRefreshAvailability((value) => value + 1)}
                  className="cursor-pointer text-xs text-accent underline"
                >
                  {t.common.retry}
                </button>
              ) : !date ? (
                <p className="text-xs text-ink-secondary">
                  {availableDays.size ? copy.pickDate : copy.noAvailability}
                </p>
              ) : activeSlots?.length ? (
                <div className="grid max-h-55 grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-3">
                  {activeSlots.map((slot) => (
                    <button
                      key={slot.startsAt}
                      type="button"
                      aria-pressed={Date.parse(time) === Date.parse(slot.startsAt)}
                      onClick={() => setTime(slot.startsAt)}
                      disabled={savingAppointment}
                      className={`cursor-pointer rounded-lg border p-2 text-xs font-semibold tabular-nums hover:border-accent disabled:cursor-not-allowed ${
                        Date.parse(time) === Date.parse(slot.startsAt)
                          ? "border-accent bg-accent text-accent-ink"
                          : "border-border-subtle bg-surface text-ink"
                      }`}
                    >
                      {formatTimeInTimezone(slot.startsAt, company.timezone, locale)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-secondary">{copy.noSlots}</p>
              )}
            </div>
          </div>

          {isClientBlocked && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
              <ShieldAlert aria-hidden="true" size={18} className="shrink-0" />
              <span>{locale === "es" ? "Cliente bloqueado. Desbloquea su ficha para continuar." : "Cliente bloqueado para agendamentos. Desbloqueie na ficha do cliente para continuar."}</span>
            </div>
          )}
          {pendingDebt > 0 && (
            <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-800 dark:text-amber-300">
              <Info aria-hidden="true" size={18} className="shrink-0" />
              <span>{locale === "es" ? "Saldo pendiente" : "Saldo devedor"} · {formatPriceFromCents(pendingDebt, locale, company.currency)}</span>
            </div>
          )}
          {!appointment && (
            <>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative space-y-1.5 text-xs font-semibold text-ink-secondary" onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setIsClientDropdownOpen(false);
                }}>
                  <label htmlFor="agenda-client-name" className="block">
                    {copy.clientName}
                  </label>
                  <input
                    id="agenda-client-name"
                    className={field}
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="off"
                    value={name}
                    onFocus={() => setIsClientDropdownOpen(true)}
                    onChange={(event) => {
                      setName(event.target.value);
                      setSelectedClientId(null);
                      setIsClientDropdownOpen(true);
                    }}
                  />

                  {/* Sugestões de clientes cadastrados */}
                  {isClientDropdownOpen && matchingClients.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border-strong bg-surface py-1 shadow-xl text-xs">
                      {matchingClients.slice(0, 5).map((c) => (
                        <li key={c.id}>
                          <button type="button" onClick={() => {
                            const nextPhone = splitClientPhone(c.phone, country);
                            setSelectedClientId(c.id);
                            setName(c.name);
                            setCountry(nextPhone.country);
                            setPhone(nextPhone.digits);
                            setPhoneValidationError("");
                            setIsClientDropdownOpen(false);
                          }}
                          className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                            <div className="min-w-0 pr-2">
                              <p className="font-semibold text-ink truncate">{c.name}</p>
                              <p className="text-xs text-ink-muted">{c.phone}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {c.isBlocked && (
                                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-500 font-bold">
                                  Bloqueado
                                </span>
                              )}
                              {c.pendingDebtCents > 0 && (
                                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-500 font-bold">
                                  Débito
                                </span>
                              )}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Cadastro Rápido Inline se não existir na base */}
                  {name.trim().length >= 2 && matchedClients.length === 0 && (
                    <button
                      type="button"
                      onClick={handleQuickCreateClient}
                      className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline cursor-pointer"
                    >
                      <UserPlus size={13} className="shrink-0" />
                      + Cadastrar novo cliente: &quot;{name.trim()}&quot;
                    </button>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="agenda-phone"
                    className="mb-1.5 block text-xs font-semibold text-ink-secondary"
                  >
                    {t.booking.whatsappLabel} <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-[6.1rem_1fr] gap-2">
                    <AgendaSelect
                      label={t.phone.countryLabel}
                      compact
                      value={country}
                      options={[
                        { value: "+55", label: "BR +55" },
                        { value: "+58", label: "VE +58" },
                      ]}
                      onChange={(value) => {
                        if (value === "+55" || value === "+58") {
                          setCountry(value);
                          setPhone("");
                          setPhoneValidationError("");
                        }
                      }}
                      disabled={savingAppointment}
                    />
                    <input
                      ref={phoneInputRef}
                      className={`${field} ${phoneValidationError ? "border-rose-500 focus-visible:border-rose-500" : ""}`}
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      required
                      id="agenda-phone"
                      aria-invalid={Boolean(phoneValidationError)}
                      value={formatNationalPhoneDisplay(country, phone)}
                      placeholder={
                        country === "+55" ? t.phone.placeholderBR : t.phone.placeholderVE
                      }
                      onChange={(event) => {
                        setPhone(stripNonDigits(event.target.value).slice(0, 11));
                        if (phoneValidationError) setPhoneValidationError("");
                      }}
                    />
                  </div>
                  {phoneValidationError && (
                    <p role="alert" className="mt-1 text-xs font-semibold text-rose-500">
                      {phoneValidationError}
                    </p>
                  )}
                </div>
              </div>

              <label className="block space-y-1.5 text-xs font-semibold text-ink-secondary">
                {copy.notes}
                <textarea
                  className={`${field} min-h-16 resize-y`}
                  maxLength={1000}
                  value={notes}
                  placeholder={copy.notesPlaceholder}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>

              {/* Opções de Recorrência e Lembrete WhatsApp */}
              <div className="space-y-2.5 rounded-xl border border-border-subtle bg-canvas/30 p-3">
                <div className="flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer accent-accent"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                    />
                    Agendamento Recorrente
                  </label>

                  {isRecurring && (
                    <select
                      value={recurrenceInterval}
                      onChange={(e) =>
                        setRecurrenceInterval(
                          e.target.value as "weekly" | "biweekly" | "monthly",
                        )
                      }
                      className="rounded-lg border border-border-subtle bg-surface px-2.5 py-1 text-xs text-ink"
                    >
                      <option value="weekly">Semanal</option>
                      <option value="biweekly">Quinzenal</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  )}
                </div>

                {/* Checkbox de WhatsApp com aviso de 6 horas */}
                <div className="flex flex-col gap-1">
                  <label
                    className={`flex items-center gap-2 text-xs font-semibold ${
                      isLessThanSixHours
                        ? "cursor-not-allowed opacity-60 text-ink-muted"
                        : "cursor-pointer text-ink"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={isLessThanSixHours}
                      className="size-4 accent-accent cursor-pointer disabled:cursor-not-allowed"
                      checked={!isLessThanSixHours && sendWhatsAppReminder}
                      onChange={(e) => setSendWhatsAppReminder(e.target.checked)}
                    />
                    Enviar lembrete via WhatsApp
                  </label>
                  {isLessThanSixHours && (
                    <p className="text-xs font-medium text-amber-500 pl-6 flex items-center gap-1">
                      <Info className="size-3 shrink-0" />
                      Apenas com 6 horas de antecedência!
                    </p>
                  )}
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer accent-accent"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  {t.owner.createAsConfirmed}
                </label>
              </div>
            </>
          )}

          {appointmentError && (
            <p
              role="alert"
              className="rounded-xl bg-[var(--status-danger-bg)] p-3 text-xs text-[var(--status-danger-ink)]"
            >
              {appointmentError}
            </p>
          )}

          <button
            disabled={savingAppointment || !canSaveAppointment}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-55 transition-colors"
            type="submit"
          >
            {savingAppointment && <LoaderCircle size={16} className="animate-spin" />}
            {t.common.save}
          </button>
        </form>
      )}

      {/* ========================================================= */}
      {/* ABA 2: BLOQUEAR AGENDA */}
      {/* ========================================================= */}
      {!appointment && (
        <div hidden={activeTab !== "block"}>
          <AgendaBlockForm
            company={company}
            collaborators={collaborators}
            initialDate={initialD || focusDate}
            initialTime={initialTime}
            initialEndTime={initialEndTime}
            initialPersonId={initialPersonId}
            onClose={onClose}
            onSavingChange={setSavingBlock}
            onCreated={(created, complete) => {
              onBlockSaved?.();
              const conflicts = new Set(created.flatMap((response) => (response.affectedAppointments ?? []).map((row) => row.id)));
              if (conflicts.size) toast.warning(`Agendamentos em conflito com os bloqueios criados: ${conflicts.size}.`);
              else if (complete) toast.success(created.length > 1 ? "Bloqueios criados com sucesso!" : "Bloqueio criado com sucesso!");
            }}
          />
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 3: FILA DE ESPERA */}
      {/* ========================================================= */}
      {activeTab === "waitlist" && (
        <form onSubmit={submitWaitlist} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-ink-secondary">
              {copy.clientName}
              <input
                className={field}
                required
                minLength={2}
                maxLength={120}
                placeholder="Nome do cliente"
                value={waitClientName}
                onChange={(e) => setWaitClientName(e.target.value)}
              />
            </label>

            <div>
              <label
                htmlFor="wait-phone"
                className="mb-1.5 block text-xs font-semibold text-ink-secondary"
              >
                {t.booking.whatsappLabel}
              </label>
              <div className="grid grid-cols-[6.1rem_1fr] gap-2">
                <AgendaSelect
                  label={t.phone.countryLabel}
                  compact
                  value={waitCountry}
                  options={[
                    { value: "+55", label: "BR +55" },
                    { value: "+58", label: "VE +58" },
                  ]}
                  onChange={(value) => {
                    if (value === "+55" || value === "+58") {
                      setWaitCountry(value);
                      setWaitClientPhone("");
                    }
                  }}
                  disabled={savingWaitlist}
                />
                <input
                  className={field}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  required
                  id="wait-phone"
                  value={formatNationalPhoneDisplay(waitCountry, waitClientPhone)}
                  placeholder={
                    waitCountry === "+55" ? t.phone.placeholderBR : t.phone.placeholderVE
                  }
                  onChange={(e) =>
                    setWaitClientPhone(stripNonDigits(e.target.value).slice(0, 11))
                  }
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-secondary">
                Serviço Desejado
              </label>
              <select
                className={field}
                required
                value={waitServiceId}
                onChange={(e) => setWaitServiceId(e.target.value)}
              >
                <option value="">Selecione o serviço...</option>
                {services
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatPriceFromCents(s.priceInCents, locale, company.currency)})
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-secondary">
                Profissional Preferido
              </label>
              <select
                className={field}
                value={waitCollaboratorId}
                onChange={(e) => setWaitCollaboratorId(e.target.value)}
              >
                <option value="">Qualquer profissional (Mais rápido)</option>
                {collaborators
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Preferência de Horário */}
          <div className="space-y-2 rounded-xl border border-border-subtle bg-canvas/40 p-3">
            <p className="text-xs font-semibold text-ink">Preferência de Horário:</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                <input
                  type="radio"
                  name="timingMode"
                  checked={waitTimingMode === "ANY_TIME"}
                  onChange={() => setWaitTimingMode("ANY_TIME")}
                  className="accent-accent cursor-pointer"
                />
                Qualquer horário livre
              </label>
              <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                <input
                  type="radio"
                  name="timingMode"
                  checked={waitTimingMode === "SPECIFIC"}
                  onChange={() => setWaitTimingMode("SPECIFIC")}
                  className="accent-accent cursor-pointer"
                />
                Data e horário específico
              </label>
            </div>

            {waitTimingMode === "SPECIFIC" && (
              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                <input
                  type="date"
                  className={field}
                  value={waitPreferredDate}
                  onChange={(e) => setWaitPreferredDate(e.target.value)}
                />
                <input
                  type="time"
                  className={field}
                  value={waitPreferredTime}
                  onChange={(e) => setWaitPreferredTime(e.target.value)}
                />
              </div>
            )}
          </div>

          <label className="block space-y-1.5 text-xs font-semibold text-ink-secondary">
            Observações do Cliente
            <textarea
              className={`${field} min-h-16 resize-y`}
              placeholder="Ex: Pode encaixar se alguém cancelar pela manhã..."
              maxLength={500}
              value={waitNotes}
              onChange={(e) => setWaitNotes(e.target.value)}
            />
          </label>

          {waitlistError && (
            <p
              role="alert"
              className="rounded-xl bg-[var(--status-danger-bg)] p-3 text-xs text-[var(--status-danger-ink)]"
            >
              {waitlistError}
            </p>
          )}

          <button
            disabled={savingWaitlist}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-55 transition-colors"
            type="submit"
          >
            {savingWaitlist && <LoaderCircle size={16} className="animate-spin" />}
            Salvar na Fila de Espera
          </button>
        </form>
      )}
    </AgendaDialog>
  );
}
