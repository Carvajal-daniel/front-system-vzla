"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  Loader2,
  Scissors,
  Sparkles,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import {
  formatDuration,
  formatNationalPhoneDisplay,
  formatPriceFromCents,
  formatTimeInTimezone,
  getTodayIsoDateInTimezone,
  stripNonDigits,
} from "@/lib/format";
import {
  createPublicAppointment,
  getPublicAvailability,
  getPublicPortalErrorMessage,
  joinPublicWaitlist,
  type PublicAppointmentResponse,
  type PublicAvailabilitySlot,
  type PublicDepositPolicy,
  type PublicIdentifyResponse,
  type PublicPortalCompany,
  type PublicPortalService,
  type WaitlistShift,
} from "@/src/services/public-portal";
import { PublicPixCheckout } from "./public-pix-checkout";

interface BookingTabProps {
  company: PublicPortalCompany;
  depositPolicy: PublicDepositPolicy;
  services: PublicPortalService[];
  whatsappUrl: string | null;
  clientName: string;
  clientPhoneDigits: string;
  identification: PublicIdentifyResponse | null;
  identifying: boolean;
  identifyError: string | null;
  onClientNameChange: (name: string) => void;
  onClientPhoneDigitsChange: (digits: string) => void;
  onIdentify: (digits: string, name?: string) => Promise<void>;
}

interface DayOption {
  isoDate: string;
  weekdayShort: string;
  dayNumber: string;
  monthShort: string;
  fullLabel: string;
}

const WAITLIST_SHIFTS: Array<{ value: WaitlistShift; label: string; hint: string }> = [
  { value: "MORNING", label: "Manhã", hint: "08h–12h" },
  { value: "AFTERNOON", label: "Tarde", hint: "12h–18h" },
  { value: "EVENING", label: "Noite", hint: "18h–22h" },
  { value: "ANY", label: "Qualquer", hint: "Melhor horário" },
];

/**
 * Gera os próximos 14 dias respeitando o fuso horário da empresa.
 */
function buildNext14Days(timezone: string): DayOption[] {
  const todayIso = getTodayIsoDateInTimezone(timezone);
  const [year, month, day] = todayIso.split("-").map(Number);
  const baseUtc = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0));

  const weekdayFmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "short",
  });
  const monthFmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    month: "short",
  });
  const fullFmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const days: DayOption[] = [];
  for (let i = 0; i < 14; i += 1) {
    const current = new Date(baseUtc.getTime() + i * 86_400_000);
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, "0");
    const d = String(current.getUTCDate()).padStart(2, "0");
    days.push({
      isoDate: `${y}-${m}-${d}`,
      weekdayShort: weekdayFmt.format(current).replace(".", ""),
      dayNumber: d,
      monthShort: monthFmt.format(current).replace(".", ""),
      fullLabel: fullFmt.format(current),
    });
  }
  return days;
}

export function BookingTab({
  company,
  depositPolicy,
  services,
  whatsappUrl,
  clientName,
  clientPhoneDigits,
  identification,
  identifying,
  identifyError,
  onClientNameChange,
  onClientPhoneDigitsChange,
  onIdentify,
}: BookingTabProps) {
  const timezone = company.timezone || "America/Sao_Paulo";
  const currency = company.currency || "BRL";

  const [days, setDays] = useState<DayOption[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<PublicAvailabilitySlot | null>(null);

  const [slots, setSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsRefreshKey, setSlotsRefreshKey] = useState(0);

  // Estado da Fila de Espera Inteligente
  const [waitlistShift, setWaitlistShift] = useState<WaitlistShift>("ANY");
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [waitlistSuccess, setWaitlistSuccess] = useState<string | null>(null);

  // Estado de criação do agendamento e Pix
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<PublicAppointmentResponse | null>(null);
  const [pixConfirmed, setPixConfirmed] = useState(false);

  const lastAutoIdentifiedRef = useRef<string>("");

  // Calcula os próximos 14 dias apenas no cliente para evitar mismatch de hidratação.
  useEffect(() => {
    const generated = buildNext14Days(timezone);
    setDays(generated);
    setSelectedDate((current) => current || generated[0]?.isoDate || "");
  }, [timezone]);

  // Identifica automaticamente quando o cliente completa 10 ou 11 dígitos.
  useEffect(() => {
    if (
      clientPhoneDigits.length >= 10 &&
      clientPhoneDigits !== lastAutoIdentifiedRef.current
    ) {
      const timer = window.setTimeout(() => {
        lastAutoIdentifiedRef.current = clientPhoneDigits;
        void onIdentify(clientPhoneDigits, clientName.trim() || undefined);
      }, 450);
      return () => window.clearTimeout(timer);
    }
  }, [clientPhoneDigits, clientName, onIdentify]);

  const selectedService = useMemo(
    () => services.find((item) => item.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  const activeSubscription =
    identification?.isSubscriber && identification.subscription
      ? identification.subscription
      : null;

  const hasRemainingClubUses =
    activeSubscription !== null &&
    (activeSubscription.remainingUses === null ||
      activeSubscription.remainingUses > 0);

  const isServiceCoveredByClub = useCallback(
    (serviceId: string): boolean => {
      if (!activeSubscription || !hasRemainingClubUses) return false;
      return activeSubscription.includedServiceIds.includes(serviceId);
    },
    [activeSubscription, hasRemainingClubUses],
  );

  // Busca horários disponíveis quando serviço, profissional ou data mudam.
  useEffect(() => {
    if (!selectedServiceId || !selectedDate) {
      setSlots([]);
      return;
    }

    const controller = new AbortController();
    setLoadingSlots(true);
    setSlotsError(null);
    setSelectedSlot(null);
    setWaitlistSuccess(null);
    setWaitlistError(null);

    void getPublicAvailability(
      company.slug,
      {
        serviceId: selectedServiceId,
        date: selectedDate,
        collaboratorId: selectedCollaboratorId ?? undefined,
      },
      controller.signal,
    )
      .then((response) => {
        if (controller.signal.aborted) return;
        setSlots(response.slots ?? []);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSlots([]);
        setSlotsError(
          getPublicPortalErrorMessage(
            error,
            "Não foi possível carregar os horários disponíveis.",
          ),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingSlots(false);
        }
      });

    return () => controller.abort();
  }, [
    company.slug,
    selectedServiceId,
    selectedCollaboratorId,
    selectedDate,
    slotsRefreshKey,
  ]);

  // Quando "Qualquer profissional" está ativo, deduplica horários iguais mantendo o primeiro barbeiro livre.
  const displayedSlots = useMemo(() => {
    if (selectedCollaboratorId !== null) return slots;
    const seen = new Set<string>();
    return slots.filter((slot) => {
      if (seen.has(slot.startsAt)) return false;
      seen.add(slot.startsAt);
      return true;
    });
  }, [slots, selectedCollaboratorId]);

  const selectedServiceCovered = selectedService
    ? isServiceCoveredByClub(selectedService.id)
    : false;

  const isExemptFromDeposit = Boolean(
    activeSubscription &&
      hasRemainingClubUses &&
      (activeSubscription.exemptsDeposit || selectedServiceCovered),
  );

  const depositApplies = Boolean(
    selectedService &&
      depositPolicy.enabled &&
      depositPolicy.depositPercentage > 0 &&
      !isExemptFromDeposit,
  );

  const depositAmountCents =
    selectedService && depositApplies
      ? Math.round(
          (selectedService.priceInCents * depositPolicy.depositPercentage) / 100,
        )
      : 0;

  const providerUnavailableWarning =
    depositApplies && !depositPolicy.hasActivePaymentProvider;

  function handleSelectService(service: PublicPortalService) {
    setSelectedServiceId(service.id);
    setSelectedCollaboratorId(null);
    setSelectedSlot(null);
    setBookingError(null);
  }

  async function handleJoinWaitlist(event: React.FormEvent) {
    event.preventDefault();
    setWaitlistError(null);

    if (clientName.trim().length < 2) {
      setWaitlistError("Informe seu nome para entrar na fila de espera.");
      return;
    }
    if (clientPhoneDigits.length < 10) {
      setWaitlistError("Informe um telefone válido com DDD.");
      return;
    }

    setWaitlistSubmitting(true);
    try {
      const response = await joinPublicWaitlist(company.slug, {
        customerName: clientName.trim(),
        customerPhone: clientPhoneDigits,
        desiredDate: selectedDate,
        collaboratorId: selectedCollaboratorId ?? undefined,
        preferredShift: waitlistShift,
      });
      setWaitlistSuccess(
        `Você entrou na Fila de Espera Inteligente para ${response.desiredDate.split("-").reverse().join("/")}. Avisaremos assim que surgir uma vaga!`,
      );
    } catch (error) {
      setWaitlistError(
        getPublicPortalErrorMessage(
          error,
          "Não foi possível entrar na fila de espera. Tente novamente.",
        ),
      );
    } finally {
      setWaitlistSubmitting(false);
    }
  }

  async function handleConfirmBooking() {
    if (!selectedService || !selectedSlot) return;
    setBookingError(null);

    if (clientName.trim().length < 2) {
      setBookingError("Preencha seu nome na etapa de identificação antes de confirmar.");
      return;
    }
    if (clientPhoneDigits.length < 10) {
      setBookingError("Preencha seu telefone com DDD antes de confirmar.");
      return;
    }

    setSubmittingBooking(true);
    try {
      const response = await createPublicAppointment(company.slug, {
        serviceId: selectedService.id,
        collaboratorId: selectedSlot.collaboratorId,
        startsAt: selectedSlot.startsAt,
        clientName: clientName.trim(),
        clientPhone: clientPhoneDigits,
      });
      setBookingResult(response);
      setPixConfirmed(!response.requiresDeposit);
    } catch (error) {
      setBookingError(
        getPublicPortalErrorMessage(
          error,
          "Não foi possível concluir o agendamento. Tente novamente.",
        ),
      );
      setSlotsRefreshKey((n) => n + 1);
    } finally {
      setSubmittingBooking(false);
    }
  }

  function handleResetBooking() {
    setBookingResult(null);
    setPixConfirmed(false);
    setSelectedSlot(null);
    setBookingError(null);
    setSlotsRefreshKey((n) => n + 1);
  }

  // Tela de Checkout Pix para pagamento de sinal
  if (bookingResult && bookingResult.requiresDeposit && bookingResult.payment && !pixConfirmed) {
    return (
      <PublicPixCheckout
        slug={company.slug}
        charge={bookingResult.payment}
        currency={currency}
        title="Pagamento do Sinal via Pix"
        subtitle={
          selectedService
            ? `${selectedService.name} • ${selectedSlot?.collaboratorName ?? ""}`
            : undefined
        }
        onConfirmed={() => setPixConfirmed(true)}
        onClose={() => {
          setBookingResult(null);
          setPixConfirmed(false);
        }}
      />
    );
  }

  // Tela final de Agendamento Confirmado
  if (bookingResult && pixConfirmed) {
    const confirmedDateLabel =
      days.find((d) => d.isoDate === selectedDate)?.fullLabel ?? selectedDate;
    const confirmedTime = selectedSlot
      ? formatTimeInTimezone(selectedSlot.startsAt, timezone, "pt-BR")
      : formatTimeInTimezone(bookingResult.appointment.startsAt, timezone, "pt-BR");

    return (
      <section className="rounded-2xl border border-[var(--status-success-border)] bg-surface p-6 text-center shadow-xs space-y-5">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--status-success-bg)] text-[var(--status-success-ink)]">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </div>
        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--status-success-bg)] px-3 py-1 text-xs font-semibold text-[var(--status-success-ink)]">
            Agendamento Confirmado
          </span>
          <h2 className="mt-2 text-xl font-bold text-ink">
            Tudo certo, {clientName.trim().split(" ")[0]}!
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Seu horário em <strong className="text-ink">{company.companyName}</strong>{" "}
            está garantido.
          </p>
        </div>

        <div className="rounded-xl border border-border-subtle bg-subtle/60 p-4 text-left text-sm space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink-secondary">Serviço</span>
            <span className="font-semibold text-ink">
              {selectedService?.name ?? bookingResult.appointment.serviceName ?? "Serviço"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink-secondary">Profissional</span>
            <span className="font-medium text-ink">
              {selectedSlot?.collaboratorName ??
                bookingResult.appointment.collaboratorName ??
                "Profissional"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink-secondary">Data</span>
            <span className="font-medium capitalize text-ink">
              {confirmedDateLabel}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink-secondary">Horário</span>
            <span className="font-semibold tabular-nums text-ink">
              {confirmedTime}
            </span>
          </div>
          {bookingResult.coveredByClub && (
            <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
              <span className="text-ink-secondary">Benefício</span>
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--status-success-ink)]">
                <Crown className="size-3.5" aria-hidden="true" />
                Incluso no Clube VIP
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleResetBooking}
          className="cursor-pointer flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
        >
          Fazer novo agendamento
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {/* Etapa 1: Identificação Rápida */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">
              1
            </span>
            <h2 className="text-sm font-semibold text-ink">
              Identificação rápida
            </h2>
          </div>
          {identifying && (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
              <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />
              Verificando…
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="portal-client-phone"
              className="mb-1 block text-xs font-medium text-ink-secondary"
            >
              WhatsApp / Telefone *
            </label>
            <input
              id="portal-client-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="(11) 99999-9999"
              value={formatNationalPhoneDisplay("+55", clientPhoneDigits)}
              onChange={(e) => {
                const digits = stripNonDigits(e.target.value).slice(0, 11);
                onClientPhoneDigitsChange(digits);
              }}
              className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink tabular-nums placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="portal-client-name"
              className="mb-1 block text-xs font-medium text-ink-secondary"
            >
              Seu nome *
            </label>
            <input
              id="portal-client-name"
              type="text"
              autoComplete="name"
              placeholder="Como podemos te chamar?"
              value={clientName}
              onChange={(e) => onClientNameChange(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        {clientPhoneDigits.length >= 10 && !activeSubscription && (
          <div className="flex justify-end">
            <button
              type="button"
              disabled={identifying}
              onClick={() => {
                lastAutoIdentifiedRef.current = clientPhoneDigits;
                void onIdentify(clientPhoneDigits, clientName.trim() || undefined);
              }}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-accent-soft transition-colors disabled:opacity-50"
            >
              <UserCheck className="size-3.5" aria-hidden="true" />
              Verificar assinatura Clube VIP
            </button>
          </div>
        )}

        {identifyError && (
          <p role="alert" className="text-xs text-[var(--status-danger-ink)]">
            {identifyError}
          </p>
        )}

        {activeSubscription && (
          <div className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--status-success-ink)]">
                <Crown className="size-4" aria-hidden="true" />
                Membro VIP • {activeSubscription.planName}
              </span>
              <span className="rounded-full bg-surface/80 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--status-success-ink)]">
                {activeSubscription.remainingUses === null
                  ? "Usos ilimitados"
                  : `${activeSubscription.remainingUses} ${
                      activeSubscription.remainingUses === 1
                        ? "uso restante"
                        : "usos restantes"
                    }`}
              </span>
            </div>
            <p className="text-xs text-[var(--status-success-ink)]/90">
              {activeSubscription.exemptsDeposit
                ? "Você tem isenção de sinal online"
                : "Benefícios do seu plano aplicados automaticamente"}
              {activeSubscription.includedServiceIds.length > 0
                ? ` e ${activeSubscription.includedServiceIds.length} ${
                    activeSubscription.includedServiceIds.length === 1
                      ? "serviço coberto"
                      : "serviços cobertos"
                  } no seu clube.`
                : "."}
            </p>
          </div>
        )}
      </section>

      {/* Etapa 2: Escolha do Serviço */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">
            2
          </span>
          <h2 className="text-sm font-semibold text-ink">Escolha o serviço</h2>
        </div>

        {services.length === 0 ? (
          <p className="rounded-xl bg-subtle p-4 text-center text-sm text-ink-secondary">
            Nenhum serviço disponível para agendamento online no momento.
          </p>
        ) : (
          <div className="space-y-2.5">
            {services.map((service) => {
              const selected = service.id === selectedServiceId;
              const covered = isServiceCoveredByClub(service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => handleSelectService(service)}
                  className={[
                    "cursor-pointer w-full rounded-xl border p-3.5 text-left transition-all",
                    selected
                      ? "border-accent bg-accent-soft/60 ring-1 ring-accent"
                      : "border-border-subtle bg-surface hover:border-border-strong hover:bg-subtle/40",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-ink truncate">
                          {service.name}
                        </p>
                        {selected && (
                          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
                            <Check className="size-3" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                      {service.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-ink-secondary">
                          {service.description}
                        </p>
                      )}
                      <span className="mt-2 inline-flex items-center gap-1 text-xs text-ink-muted">
                        <Clock className="size-3.5" aria-hidden="true" />
                        {formatDuration(service.durationMinutes, "pt-BR")}
                      </span>
                    </div>

                    <div className="shrink-0 text-right">
                      {covered ? (
                        <div className="space-y-0.5">
                          <p className="text-xs text-ink-muted line-through tabular-nums">
                            {formatPriceFromCents(
                              service.priceInCents,
                              "pt-BR",
                              currency,
                            )}
                          </p>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--status-success-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--status-success-ink)]">
                            <Crown className="size-3" aria-hidden="true" />
                            Incluso no Clube (R$ 0,00)
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm font-bold tabular-nums text-ink">
                          {formatPriceFromCents(
                            service.priceInCents,
                            "pt-BR",
                            currency,
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Etapa 3: Escolha do Profissional */}
      {selectedService && (
        <section className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">
              3
            </span>
            <h2 className="text-sm font-semibold text-ink">
              Escolha o profissional
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelectedCollaboratorId(null)}
              className={[
                "cursor-pointer flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                selectedCollaboratorId === null
                  ? "border-accent bg-accent-soft/60 ring-1 ring-accent"
                  : "border-border-subtle bg-surface hover:border-border-strong",
              ].join(" ")}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-subtle text-ink">
                <Users className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  Qualquer profissional disponível
                </p>
                <p className="text-xs text-ink-muted">Mais opções de horário</p>
              </div>
            </button>

            {selectedService.collaborators.map((collaborator) => {
              const selected = selectedCollaboratorId === collaborator.id;
              return (
                <button
                  key={collaborator.id}
                  type="button"
                  onClick={() => setSelectedCollaboratorId(collaborator.id)}
                  className={[
                    "cursor-pointer flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                    selected
                      ? "border-accent bg-accent-soft/60 ring-1 ring-accent"
                      : "border-border-subtle bg-surface hover:border-border-strong",
                  ].join(" ")}
                >
                  {collaborator.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar externo do profissional
                    <img
                      src={collaborator.avatarUrl}
                      alt={collaborator.name}
                      className="size-10 shrink-0 rounded-full object-cover border border-border-subtle"
                    />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-subtle text-ink-secondary">
                      <User className="size-4" aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {collaborator.name}
                    </p>
                    {collaborator.specialty && (
                      <p className="truncate text-xs text-ink-muted">
                        {collaborator.specialty}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Etapa 4: Data e Horários Livres */}
      {selectedService && (
        <section className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">
              4
            </span>
            <h2 className="text-sm font-semibold text-ink">
              Data e horários livres
            </h2>
          </div>

          {/* Seletor horizontal de 14 dias */}
          <div
            role="listbox"
            aria-label="Selecione uma data"
            className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1"
          >
            {days.map((day) => {
              const active = day.isoDate === selectedDate;
              return (
                <button
                  key={day.isoDate}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => setSelectedDate(day.isoDate)}
                  className={[
                    "cursor-pointer flex min-w-[4.25rem] shrink-0 flex-col items-center rounded-xl border px-2.5 py-2.5 transition-all",
                    active
                      ? "border-accent bg-accent text-accent-ink shadow-xs"
                      : "border-border-subtle bg-surface text-ink hover:border-border-strong hover:bg-subtle/60",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "text-[11px] font-medium uppercase",
                      active ? "text-accent-ink/80" : "text-ink-muted",
                    ].join(" ")}
                  >
                    {day.weekdayShort}
                  </span>
                  <span className="mt-0.5 text-lg font-bold tabular-nums leading-none">
                    {day.dayNumber}
                  </span>
                  <span
                    className={[
                      "mt-0.5 text-[10px] uppercase",
                      active ? "text-accent-ink/80" : "text-ink-muted",
                    ].join(" ")}
                  >
                    {day.monthShort}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Grade de horários */}
          {loadingSlots ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-11 animate-pulse rounded-xl bg-subtle"
                />
              ))}
            </div>
          ) : slotsError ? (
            <div
              role="alert"
              className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3.5 text-xs text-[var(--status-danger-ink)] flex items-center justify-between gap-2"
            >
              <span>{slotsError}</span>
              <button
                type="button"
                onClick={() => setSlotsRefreshKey((n) => n + 1)}
                className="cursor-pointer shrink-0 rounded-lg bg-surface px-2.5 py-1 font-semibold text-ink border border-border-subtle"
              >
                Tentar de novo
              </button>
            </div>
          ) : displayedSlots.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {displayedSlots.map((slot) => {
                const isSelected =
                  selectedSlot?.startsAt === slot.startsAt &&
                  selectedSlot?.collaboratorId === slot.collaboratorId;
                return (
                  <button
                    key={`${slot.collaboratorId}-${slot.startsAt}`}
                    type="button"
                    onClick={() => {
                      setSelectedSlot(slot);
                      setBookingError(null);
                    }}
                    className={[
                      "cursor-pointer min-h-11 rounded-xl border px-2 py-2 text-center text-sm font-semibold tabular-nums transition-all",
                      isSelected
                        ? "border-accent bg-accent text-accent-ink shadow-xs"
                        : "border-border-subtle bg-surface text-ink hover:border-border-strong hover:bg-subtle/60",
                    ].join(" ")}
                  >
                    {formatTimeInTimezone(slot.startsAt, timezone, "pt-BR")}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Dia Lotado → Fila de Espera Inteligente */
            <div className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]/60 p-4 space-y-3.5">
              <div className="flex items-start gap-2.5">
                <CalendarDays
                  className="mt-0.5 size-5 shrink-0 text-[var(--status-warning-ink)]"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--status-warning-ink)]">
                    Sem horários livres nesta data
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--status-warning-ink)]/90">
                    Entre na nossa fila de espera e avisaremos automaticamente se
                    houver desistência.
                  </p>
                </div>
              </div>

              {waitlistSuccess ? (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-3 text-xs font-medium text-[var(--status-success-ink)]"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{waitlistSuccess}</span>
                </div>
              ) : (
                <form onSubmit={handleJoinWaitlist} className="space-y-3">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-ink">
                      Turno preferido
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {WAITLIST_SHIFTS.map((shift) => {
                        const active = waitlistShift === shift.value;
                        return (
                          <button
                            key={shift.value}
                            type="button"
                            onClick={() => setWaitlistShift(shift.value)}
                            className={[
                              "cursor-pointer rounded-xl border px-2.5 py-2 text-center transition-colors",
                              active
                                ? "border-accent bg-accent text-accent-ink"
                                : "border-border-subtle bg-surface text-ink hover:bg-subtle",
                            ].join(" ")}
                          >
                            <span className="block text-xs font-semibold">
                              {shift.label}
                            </span>
                            <span
                              className={[
                                "block text-[10px]",
                                active ? "text-accent-ink/80" : "text-ink-muted",
                              ].join(" ")}
                            >
                              {shift.hint}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {waitlistError && (
                    <p
                      role="alert"
                      className="text-xs font-medium text-[var(--status-danger-ink)]"
                    >
                      {waitlistError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={waitlistSubmitting}
                    className="cursor-pointer flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
                  >
                    {waitlistSubmitting ? (
                      <Loader2
                        className="size-4 motion-safe:animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Sparkles className="size-4" aria-hidden="true" />
                    )}
                    Entrar na Fila de Espera Inteligente
                  </button>
                </form>
              )}
            </div>
          )}
        </section>
      )}

      {/* Etapa 5: Resumo & Confirmação */}
      {selectedService && selectedSlot && (
        <section className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">
              5
            </span>
            <h2 className="text-sm font-semibold text-ink">
              Resumo e confirmação
            </h2>
          </div>

          <div className="rounded-xl bg-subtle/70 p-4 text-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-secondary">Serviço</span>
              <span className="font-semibold text-ink">{selectedService.name}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-secondary">Profissional</span>
              <span className="font-medium text-ink">
                {selectedSlot.collaboratorName}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-secondary">Data e horário</span>
              <span className="font-semibold tabular-nums text-ink">
                {selectedDate.split("-").reverse().join("/")} às{" "}
                {formatTimeInTimezone(selectedSlot.startsAt, timezone, "pt-BR")}
              </span>
            </div>

            <div className="border-t border-border-subtle pt-2.5 flex items-center justify-between gap-2">
              <span className="text-ink-secondary">Valor do serviço</span>
              {selectedServiceCovered ? (
                <span className="font-bold text-[var(--status-success-ink)]">
                  Incluso no Clube (R$ 0,00)
                </span>
              ) : (
                <span className="font-bold tabular-nums text-ink">
                  {formatPriceFromCents(
                    selectedService.priceInCents,
                    "pt-BR",
                    currency,
                  )}
                </span>
              )}
            </div>

            {depositApplies && (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-ink-secondary">
                  Sinal via Pix ({depositPolicy.depositPercentage}%)
                </span>
                <span className="font-semibold tabular-nums text-accent">
                  {formatPriceFromCents(depositAmountCents, "pt-BR", currency)}
                </span>
              </div>
            )}
          </div>

          {providerUnavailableWarning && (
            <div
              role="alert"
              className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3.5 text-xs text-[var(--status-warning-ink)] space-y-2"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>
                  Este estabelecimento exige sinal de{" "}
                  <strong>{depositPolicy.depositPercentage}%</strong>, mas o
                  pagamento online via Pix está temporariamente indisponível.
                </p>
              </div>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer inline-flex items-center font-semibold underline underline-offset-2"
                >
                  Falar pelo WhatsApp para agendar
                </a>
              )}
            </div>
          )}

          {bookingError && (
            <div
              role="alert"
              className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3.5 text-xs font-medium text-[var(--status-danger-ink)]"
            >
              {bookingError}
            </div>
          )}

          <button
            type="button"
            disabled={submittingBooking}
            onClick={() => void handleConfirmBooking()}
            className="cursor-pointer flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {submittingBooking ? (
              <>
                <Loader2
                  className="size-4 motion-safe:animate-spin"
                  aria-hidden="true"
                />
                Confirmando agendamento…
              </>
            ) : depositApplies ? (
              <>
                <Scissors className="size-4" aria-hidden="true" />
                Pagar sinal e confirmar horário
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Confirmar agendamento
              </>
            )}
          </button>
        </section>
      )}
    </div>
  );
}
