"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Globe2,
  Loader2,
  Scissors,
  Sparkles,
  User,
} from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api-client";
import { displayCompanyRating, collectedClientFields, defaultCompanySettings, emptyClientFields, formatCompanyAddress, type CompanySettings } from "@/lib/company-settings";
import { googleDirections } from "@/lib/google-place";
import { useCompanySettings } from "@/lib/use-company-settings";
import { useGooglePlace } from "@/lib/use-google-place";
import { ClientDataFields } from "@/components/ui/client-data-fields";
import { CompanyRating } from "@/components/ui/company-rating";
import { GooglePlaceMap, GooglePlaceReviews } from "@/components/ui/google-place-map";
import { announcePublicBooking } from "@/lib/agenda-sync";
import {
  formatDateInTimezone,
  formatDateTimeInTimezone,
  formatDuration,
  formatPhoneToE164,
  formatPriceFromCents,
  formatTimeInTimezone,
  getTodayIsoDateInTimezone,
  isValidInternationalPhone,
} from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import {
  clientWhatsAppUrl,
  getClientBookingStatus,
  getCompanyBookingPhone,
  registerClientIfMissing,
  subscribeToClientStorage,
} from "@/lib/use-clients";
import type { Appointment } from "@/lib/types/appointment";
import type {
  AvailabilitySlot,
  CreatePublicAppointmentPayload,
  PhoneCountryCode,
  PublicAvailabilityResponse,
  PublicCompany,
  PublicService,
} from "@/lib/types/public-booking";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { PhoneInput } from "@/components/ui/phone-input";
import { Skeleton } from "@/components/ui/skeleton";

interface BookingWizardProps {
  company: PublicCompany & { whatsapp?: string | null };
  services: PublicService[];
  initialSettings?: CompanySettings;
}

type Step = 1 | 2 | 3 | 4 | 5;

export function BookingWizard({ company, services, initialSettings = defaultCompanySettings }: BookingWizardProps) {
  const { locale, t } = useLocale();
  const { settings } = useCompanySettings(company.id, initialSettings);
  const { place: googlePlace } = useGooglePlace(company.id, settings.googlePlaceId);
  const address = formatCompanyAddress(settings.address);
  const displayAddress = googlePlace?.address || address;
  const mapsDirectionsUrl = googleDirections(googlePlace, settings.googleMapsUrl, displayAddress);
  const [clientDetails, setClientDetails] = useState<Record<string, string>>(emptyClientFields);

  const [step, setStep] = useState<Step>(1);
  const [selectedService, setSelectedService] = useState<PublicService | null>(
    null,
  );
  // null = "Qualquer disponível"
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<
    string | null
  >(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const availabilityRequest = useRef<AbortController | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(
    null,
  );

  const [clientName, setClientName] = useState("");
  const [countryCode, setCountryCode] = useState<PhoneCountryCode>(company.timezone === "America/Caracas" ? "+58" : "+55");
  const [clientPhoneDigits, setClientPhoneDigits] = useState("");
  const [clientStatus, setClientStatus] = useState({ isBlocked: false, hasDebt: false });
  const [companyWhatsApp, setCompanyWhatsApp] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelLink, setCancelLink] = useState("");
  const [confirmedAppointment, setConfirmedAppointment] =
    useState<Appointment | null>(null);
  const [confirmedCollaboratorName, setConfirmedCollaboratorName] =
    useState<string>("");

  useEffect(() => () => availabilityRequest.current?.abort(), []);

  const bookingPhone = isValidInternationalPhone(countryCode, clientPhoneDigits)
    ? formatPhoneToE164(countryCode, clientPhoneDigits)
    : "";
  useEffect(() => {
    if (step !== 4) return;
    const check = () => {
      setClientStatus(getClientBookingStatus(company.id, bookingPhone));
      const companyPhone = company.whatsapp || getCompanyBookingPhone(company.id);
      setCompanyWhatsApp(clientWhatsAppUrl(companyPhone, company.timezone === "America/Caracas" ? "+58" : "+55"));
    };
    check();
    return subscribeToClientStorage(check);
  }, [step, company.id, company.whatsapp, company.timezone, bookingPhone]);

  const fetchAvailability = useCallback(
    async (serviceId: string, date: string, collaboratorId: string | null) => {
      availabilityRequest.current?.abort();
      const controller = new AbortController();
      availabilityRequest.current = controller;
      setSlotsLoading(true);
      setSlotsError(null);
      setSelectedSlot(null);

      try {
        const res = await apiRequest<PublicAvailabilityResponse>(
          `/public/companies/${encodeURIComponent(company.id)}/availability`,
          {
            auth: false,
            signal: controller.signal,
            query: {
              serviceId,
              date,
              collaboratorId: collaboratorId ?? undefined,
            },
          },
        );
        if (!controller.signal.aborted) setSlots(res.slots);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSlots([]);
        setSlotsError(
          error instanceof ApiError
            ? error.message
            : t.errors.networkDescription,
        );
      } finally {
        if (!controller.signal.aborted) setSlotsLoading(false);
      }
    },
    [company.id, t.errors.networkDescription],
  );

  const handleSelectService = (service: PublicService) => {
    availabilityRequest.current?.abort();
    setSelectedService(service);
    setSelectedCollaboratorId(null);
    setSelectedSlot(null);
    setStep(2);
  };

  const handleSelectProfessional = (collaboratorId: string | null) => {
    const initialDate =
      selectedDate || getTodayIsoDateInTimezone(company.timezone);
    setSelectedCollaboratorId(collaboratorId);
    setSelectedDate(initialDate);
    setSelectedSlot(null);
    setStep(3);
    if (selectedService) {
      void fetchAvailability(selectedService.id, initialDate, collaboratorId);
    }
  };

  const handleDateChange = (nextDate: string) => {
    setSelectedDate(nextDate);
    if (!nextDate) {
      availabilityRequest.current?.abort();
      setSlots([]);
      setSelectedSlot(null);
      setSlotsLoading(false);
      return;
    }
    if (selectedService && nextDate) {
      void fetchAvailability(
        selectedService.id,
        nextDate,
        selectedCollaboratorId,
      );
    }
  };

  const handleConfirmBooking = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedService || !selectedSlot || submitting) return;

    const trimmedName = clientName.trim();
    if (trimmedName.length < 2) {
      setFormError(t.errors.requiredField);
      return;
    }

    if (!bookingPhone) {
      setFormError(t.errors.invalidPhone);
      return;
    }

    const currentClientStatus = getClientBookingStatus(company.id, bookingPhone);
    setClientStatus(currentClientStatus);
    if (currentClientStatus.isBlocked) return;

    setSubmitting(true);
    setFormError(null);

    const payload: CreatePublicAppointmentPayload = {
      serviceId: selectedService.id,
      collaboratorId: selectedSlot.collaboratorId,
      startsAt: selectedSlot.startsAt,
      clientName: trimmedName,
      clientPhone: bookingPhone,
      clientData: collectedClientFields(clientDetails, settings),
    };

    try {
      const created = await apiRequest<Appointment & { cancellationToken?: string }>(
        `/public/companies/${encodeURIComponent(company.id)}/appointments`,
        {
          method: "POST",
          auth: false,
          body: payload,
        },
      );
      announcePublicBooking(company.id, created.id);
      // Registra automaticamente o cliente na base local da empresa caso ainda não exista pelo telefone
      registerClientIfMissing(company.id, {
        name: created.clientName || trimmedName,
        phone: created.clientPhone || payload.clientPhone,
      });
      setConfirmedAppointment(created);
      setCancelLink(created.cancellationToken ? `/book/${company.id}/cancel?appointment=${created.id}#${created.cancellationToken}` : "");
      setConfirmedCollaboratorName(selectedSlot.collaboratorName);
      setStep(5);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFormError(t.errors.conflictSlot);
        setStep(3);
        void fetchAvailability(
          selectedService.id,
          selectedDate,
          selectedCollaboratorId,
        );
      } else {
        setFormError(
          error instanceof ApiError
            ? error.message
            : t.errors.unexpectedDescription,
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    availabilityRequest.current?.abort();
    setStep(1);
    setSelectedService(null);
    setSelectedCollaboratorId(null);
    setSelectedSlot(null);
    setClientName("");
    setClientPhoneDigits("");
    setClientDetails(emptyClientFields);
    setFormError(null);
    setConfirmedAppointment(null);
    setCancelLink("");
    setConfirmedCollaboratorName("");
  };

  const stepsMeta = [
    { id: 1 as Step, label: t.booking.stepService },
    { id: 2 as Step, label: t.booking.stepProfessional },
    { id: 3 as Step, label: t.booking.stepDateTime },
    { id: 4 as Step, label: t.booking.stepContact },
  ];

  const selectedCollaboratorName =
    selectedCollaboratorId && selectedService
      ? selectedService.collaborators.find(
          (c) => c.id === selectedCollaboratorId,
        )?.name
      : null;

  return (
    <main className="min-h-dvh bg-canvas pb-28 sm:pb-12">
      <header className="border-b border-border-subtle bg-surface/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {company.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.avatarUrl}
                alt={company.companyName}
                className="h-12 w-12 shrink-0 rounded-2xl object-cover border border-border-subtle shadow-xs"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-xs">
                <Scissors className="h-6 w-6" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
                {t.common.appName}
              </p>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2">
                <h1 className="min-w-0 break-words text-display-md text-ink">{company.companyName}</h1>
                <CompanyRating rating={displayCompanyRating(settings, googlePlace)} />
              </div>
              {displayAddress && <address className="mt-1 break-words text-xs not-italic text-ink-secondary">{displayAddress}</address>}
              {mapsDirectionsUrl && <a href={mapsDirectionsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-9 items-center text-xs font-semibold text-ink underline underline-offset-4">
                {locale === "es" ? "Cómo llegar en Google Maps" : "Como chegar no Google Maps"}
              </a>}
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <Globe2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {t.booking.timezoneNotice}:{" "}
                  <strong className="font-mono text-ink-secondary">
                    {company.timezone}
                  </strong>
                </span>
              </p>
            </div>
          </div>
          <LocaleSwitcher className="shrink-0" />
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-6">
        {step < 5 && (
          <nav aria-label="Etapas da reserva" className="grid grid-cols-4 gap-2">
            {stepsMeta.map((item) => {
              const completed = step > item.id;
              const current = step === item.id;
              return (
                <div key={item.id} className="space-y-1.5 min-w-0">
                  <div
                    className={[
                      "h-1.5 rounded-full transition-colors",
                      completed || current ? "bg-accent" : "bg-border-subtle",
                    ].join(" ")}
                  />
                  <p
                    className={[
                      "text-[11px] font-medium truncate",
                      current ? "text-accent font-semibold" : "text-ink-muted",
                    ].join(" ")}
                  >
                    {item.label}
                  </p>
                </div>
              );
            })}
          </nav>
        )}

        {formError && step !== 4 && (
          <div
            role="alert"
            className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3 text-sm font-medium text-[var(--status-warning-ink)]"
          >
            {formError}
          </div>
        )}

        {/* Etapa 1: Serviço */}
        {step === 1 && (
          <section className="space-y-4">
            <h2 className="text-title-sm font-bold text-ink">
              {t.booking.chooseService}
            </h2>
            {services.length === 0 ? (
              <EmptyState
                title={t.booking.noServicesTitle}
                description={t.booking.noServicesDescription}
                icon={<Scissors className="h-6 w-6" aria-hidden="true" />}
              />
            ) : (
              <div className="space-y-3">
                {services.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => handleSelectService(service)}
                    className="w-full min-h-16 rounded-2xl border border-border-subtle bg-surface p-4 text-left shadow-xs transition-all hover:border-accent hover:shadow-sm focus-visible:border-accent cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3.5 min-w-0">
                        {service.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={service.imageUrl}
                            alt={service.name}
                            className="h-14 w-14 shrink-0 rounded-xl object-cover border border-border-subtle shadow-xs"
                          />
                        ) : (
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                            <Scissors className="h-6 w-6" aria-hidden="true" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-ink">
                            {service.name}
                          </p>
                          {service.description && (
                            <p className="mt-1 text-xs text-ink-secondary line-clamp-2">
                              {service.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-bold text-accent tabular-nums">
                          {formatPriceFromCents(service.priceInCents, locale, company.currency)}
                        </p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-muted tabular-nums">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {formatDuration(service.durationMinutes, locale)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Etapa 2: Profissional */}
        {step === 2 && selectedService && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-title-sm font-bold text-ink">
                {t.booking.chooseProfessional}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {t.common.back}
              </Button>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleSelectProfessional(null)}
                className="flex w-full min-h-16 items-center gap-3 rounded-2xl border-2 border-accent/30 bg-accent-soft/40 p-4 text-left transition-colors hover:border-accent cursor-pointer"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">
                    {t.common.anyAvailable}
                  </p>
                  <p className="text-xs text-ink-secondary">
                    {selectedService.name}
                  </p>
                </div>
              </button>

              {selectedService.collaborators.length === 0 ? (
                <p className="rounded-xl border border-border-subtle bg-subtle/70 px-4 py-3 text-xs text-ink-secondary">
                  {t.booking.noProfessionalsLinked}
                </p>
              ) : (
                selectedService.collaborators.map((collab) => (
                  <button
                    key={collab.id}
                    type="button"
                    onClick={() => handleSelectProfessional(collab.id)}
                    className="flex w-full min-h-16 items-center gap-3 rounded-2xl border border-border-subtle bg-surface p-4 text-left shadow-xs transition-colors hover:border-accent cursor-pointer"
                  >
                    {collab.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={collab.avatarUrl}
                        alt={collab.name}
                        className="h-11 w-11 shrink-0 rounded-full object-cover border border-border-subtle"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-subtle text-ink-secondary">
                        <User className="h-5 w-5" aria-hidden="true" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">
                        {collab.name}
                      </p>
                      {collab.specialty && (
                        <p className="text-xs text-ink-secondary truncate">
                          {collab.specialty}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        )}

        {/* Etapa 3: Data e Horário */}
        {step === 3 && selectedService && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-title-sm font-bold text-ink">
                {t.booking.chooseDateTime}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep(2)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {t.common.back}
              </Button>
            </div>

            <Card className="rounded-2xl border border-border-subtle bg-surface shadow-xs">
              <CardContent className="space-y-1.5 pt-1">
                <Label htmlFor="booking-date">{t.booking.stepDateTime}</Label>
                <Input
                  id="booking-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5 tabular-nums"
                />
              </CardContent>
            </Card>

            {slotsLoading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : slotsError ? (
              <ErrorState
                title={t.errors.networkTitle}
                description={slotsError}
                retryLabel={t.common.retry}
                onRetry={() =>
                  void fetchAvailability(
                    selectedService.id,
                    selectedDate,
                    selectedCollaboratorId,
                  )
                }
              />
            ) : slots.length === 0 ? (
              <EmptyState
                title={t.booking.noSlotsTitle}
                description={t.booking.noSlotsDescription}
                icon={<Calendar className="h-6 w-6" aria-hidden="true" />}
              />
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {slots.map((slot) => {
                  const key = `${slot.startsAt}-${slot.collaboratorId}`;
                  const isSelected =
                    selectedSlot?.startsAt === slot.startsAt &&
                    selectedSlot?.collaboratorId === slot.collaboratorId;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      aria-pressed={isSelected}
                      className={[
                        "min-h-12 rounded-xl border px-2 py-2 text-center transition-colors cursor-pointer",
                        isSelected
                          ? "border-accent bg-accent text-accent-ink shadow-xs"
                          : "border-border-subtle bg-surface text-ink hover:border-accent",
                      ].join(" ")}
                    >
                      <span className="block font-mono text-sm font-bold tabular-nums">
                        {formatTimeInTimezone(
                          slot.startsAt,
                          company.timezone,
                          locale,
                        )}
                      </span>
                      {!selectedCollaboratorId && (
                        <span
                          className={[
                            "mt-0.5 block text-[10px] truncate",
                            isSelected ? "text-accent-ink/90" : "text-ink-muted",
                          ].join(" ")}
                        >
                          {slot.collaboratorName}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Etapa 4: Dados do cliente */}
        {step === 4 && selectedService && selectedSlot && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-title-sm font-bold text-ink">
                {t.booking.yourDetails}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep(3)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {t.common.back}
              </Button>
            </div>

            <Card className="rounded-2xl border border-border-subtle bg-surface shadow-xs">
              <CardContent className="pt-1">
                <form onSubmit={handleConfirmBooking} className="space-y-4">
                  <div className="rounded-xl bg-subtle p-3.5 text-xs space-y-1">
                    <p className="font-semibold text-ink">
                      {selectedService.name} ·{" "}
                      <span className="tabular-nums">
                        {formatPriceFromCents(selectedService.priceInCents, locale, company.currency)}
                      </span>
                    </p>
                    <p className="text-ink-secondary">
                      {selectedSlot.collaboratorName} ·{" "}
                      <span className="font-mono font-semibold text-ink tabular-nums">
                        {formatDateTimeInTimezone(
                          selectedSlot.startsAt,
                          company.timezone,
                          locale,
                        )}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="client-name">{t.booking.clientNameLabel}</Label>
                    <Input
                      id="client-name"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      required
                      minLength={2}
                      maxLength={120}
                      autoComplete="name"
                      className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5"
                    />
                  </div>

                  <PhoneInput
                    id="client-whatsapp"
                    label={t.booking.whatsappLabel}
                    countryCode={countryCode}
                    value={clientPhoneDigits}
                    onCountryCodeChange={setCountryCode}
                    onChange={setClientPhoneDigits}
                  />
                  <ClientDataFields settings={settings} values={clientDetails} onChange={setClientDetails}
                    today={getTodayIsoDateInTimezone(company.timezone)} fieldClass="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm" />

                  {clientStatus.isBlocked ? (
                    <div role="alert" className="space-y-2 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs text-[var(--status-danger-ink)]">
                      <p>{locale === "es"
                        ? "No pudimos completar tu cita. Tu registro tiene una restricción. Por favor, comunícate directamente con la empresa."
                        : "Não foi possível concluir seu agendamento. Seu cadastro possui uma restrição/bloqueio — por favor, entre em contato diretamente com a empresa."}</p>
                      {companyWhatsApp && (
                        <a href={companyWhatsApp} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-lg border border-current px-2.5 py-1.5 font-semibold hover:underline">
                          {locale === "es" ? "Contactar por WhatsApp" : "Entrar em contato pelo WhatsApp"}
                        </a>
                      )}
                    </div>
                  ) : clientStatus.hasDebt && (
                    <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                      {locale === "es" ? "Hay un saldo pendiente que puedes abonar en el establecimiento." : "Consta uma pendência financeira em aberto para acerto no estabelecimento."}
                    </p>
                  )}

                  {formError && (
                    <p
                      role="alert"
                      className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger-ink)]"
                    >
                      {formError}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting || clientStatus.isBlocked}
                    className="min-h-11 w-full rounded-full bg-accent text-accent-ink hover:bg-accent-hover cursor-pointer"
                  >
                    {submitting && (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    )}
                    {t.booking.confirmBooking}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Etapa 5: Confirmação */}
        {step === 5 && confirmedAppointment && (
          <Card className="rounded-2xl border border-border-subtle bg-surface p-2 sm:p-4 text-center shadow-xs">
            <CardContent className="space-y-4 pt-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--status-success-bg)] text-[var(--status-success-ink)]">
                <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-display-md text-ink">
                  {t.booking.confirmedTitle}
                </h2>
                <p className="mt-1 text-sm text-ink-secondary">
                  {t.booking.confirmedSubtitle}
                </p>
              </div>
              <div className="rounded-xl border border-border-subtle bg-canvas p-4 text-left text-sm space-y-1.5">
                <p className="font-semibold text-ink">
                  {confirmedAppointment.serviceNameSnapshot}
                </p>
                <p className="text-ink-secondary">
                  {confirmedCollaboratorName}
                </p>
                <p className="font-mono font-semibold text-ink tabular-nums">
                  {formatDateTimeInTimezone(
                    confirmedAppointment.startsAt,
                    company.timezone,
                    locale,
                  )}
                </p>
                <p className="text-xs text-ink-muted">
                  {company.timezone} ·{" "}
                  <span className="tabular-nums">
                    {formatPriceFromCents(
                      confirmedAppointment.servicePriceInCentsSnapshot,
                      locale,
                      company.currency,
                    )}
                  </span>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="min-h-11 rounded-xl px-5 cursor-pointer"
              >
                {t.booking.newBooking}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {step === 5 && cancelLink && <div className="mx-auto mt-5 max-w-2xl px-4">
        <a className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline" href={cancelLink}>{locale === "es" ? "Cancelar reserva" : "Cancelar agendamento"}</a>
      </div>}
      {(displayAddress || googlePlace || mapsDirectionsUrl) && (
        <footer className="mx-auto mt-8 max-w-2xl space-y-4 px-4">
          <section className="space-y-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <h2 className="text-sm font-bold text-ink">{locale === "es" ? "Ubicación" : "Localização"}</h2>
                {displayAddress && <address className="text-xs not-italic text-ink-secondary">{displayAddress}</address>}
              </div>
              {mapsDirectionsUrl && (
                <a
                  href={mapsDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center rounded-xl border border-border-strong bg-canvas px-3 text-xs font-semibold text-ink hover:border-accent"
                >
                  {locale === "es" ? "Cómo llegar en Google Maps" : "Como chegar no Google Maps"}
                </a>
              )}
            </div>
            <GooglePlaceMap
              place={googlePlace}
              address={displayAddress}
              title={locale === "es" ? `Mapa de ${company.companyName}` : `Mapa de ${company.companyName}`}
            />
          </section>
          {googlePlace && <GooglePlaceReviews place={googlePlace} spanish={locale === "es"} />}
        </footer>
      )}

      {/* Resumo fixo na zona do polegar (mobile) na etapa de seleção de horário */}
      {step === 3 && selectedService && selectedSlot && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-surface/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-ink truncate">
                {selectedService.name}
                {selectedCollaboratorName
                  ? ` · ${selectedCollaboratorName}`
                  : ` · ${selectedSlot.collaboratorName}`}
              </p>
              <p className="font-mono text-ink-secondary tabular-nums">
                {formatDateInTimezone(
                  selectedSlot.startsAt,
                  company.timezone,
                  locale,
                )}{" "}
                ·{" "}
                {formatTimeInTimezone(
                  selectedSlot.startsAt,
                  company.timezone,
                  locale,
                )}
              </p>
            </div>
            <Button type="button" onClick={() => setStep(4)}>
              {t.common.next}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
