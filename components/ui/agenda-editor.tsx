"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Clock, LoaderCircle } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api-client";
import { agendaMonth, shiftAgendaDay } from "@/lib/agenda";
import { formatNationalPhoneDisplay, formatPhoneToE164, formatPriceFromCents, formatTimeInTimezone, isValidInternationalPhone, stripNonDigits } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { agendaStrings } from "@/lib/i18n/agenda";
import type { Appointment, CreateAppointmentPayload, RescheduleAppointmentPayload } from "@/lib/types/appointment";
import type { Company } from "@/lib/types/auth";
import type { PhoneCountryCode, PublicAvailabilityResponse } from "@/lib/types/public-booking";
import type { Service, ServiceCollaboratorsResponse } from "@/lib/types/service";
import type { Collaborator } from "@/lib/types/team";
import { AgendaMonthGrid } from "./agenda-calendar";
import { AgendaDialog, AgendaSelect } from "./agenda-controls";

const field = "min-h-10 w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent";
const emptyDays = new Set<string>();

type Result<T> = { key: string; value?: T; failed?: boolean };

export function AgendaEditor({
  company,
  collaborators,
  services,
  today,
  focusDate,
  initialDate,
  initialTime,
  initialPersonId,
  appointment,
  onClose,
  onSaved,
}: {
  company: Company;
  collaborators: Collaborator[];
  services: Service[];
  today: string;
  focusDate: string;
  initialDate?: string;
  initialTime?: string;
  initialPersonId?: string;
  appointment?: Appointment;
  onClose: () => void;
  onSaved: (appointment: Appointment) => void;
}) {
  const { locale, t } = useLocale();
  const copy = agendaStrings(locale);
  const initialD = appointment ? "" : initialDate ?? "";
  const [serviceId, setServiceId] = useState(appointment?.serviceId ?? (services.length === 1 ? services[0].id : ""));
  const [personId, setPersonId] = useState(appointment?.collaboratorId ?? initialPersonId ?? "");
  const [month, setMonth] = useState(initialD && initialD >= today ? initialD : focusDate >= today ? focusDate : today);
  const [date, setDate] = useState(initialD);
  const [time, setTime] = useState(appointment ? appointment.startsAt : initialTime ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<PhoneCountryCode>(locale === "es" ? "+58" : "+55");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  const [links, setLinks] = useState<Result<string[]>>({ key: "" });
  const [availability, setAvailability] = useState<Result<string[]>>({ key: "" });
  const [slots, setSlots] = useState<Result<PublicAvailabilityResponse>>({ key: "" });
  const { start, end } = agendaMonth(month);
  const from = start < today ? today : start;
  const to = shiftAgendaDay(end, -1);
  const availabilityKey = `${serviceId}/${personId}/${from}/${to}/${refresh}`;
  const slotKey = `${serviceId}/${personId}/${date}/${refresh}`;
  const appointmentId = appointment?.id;

  useEffect(() => {
    if (!serviceId) return;
    const controller = new AbortController();
    void apiRequest<ServiceCollaboratorsResponse>(`/services/${encodeURIComponent(serviceId)}/collaborators`, { signal: controller.signal })
      .then((data) => setLinks({ key: serviceId, value: data.collaborators.filter((entry) => entry.isActive).map((entry) => entry.collaboratorId) }))
      .catch(() => { if (!controller.signal.aborted) setLinks({ key: serviceId, failed: true }); });
    return () => controller.abort();
  }, [serviceId]);

  useEffect(() => {
    if (!serviceId || !personId || from > to) return;
    const controller = new AbortController();
    void apiRequest<{ availableDays: string[] }>("/appointments/availability", {
      query: { serviceId, collaboratorId: personId, from, to, appointmentId }, signal: controller.signal,
    }).then((data) => { if (!controller.signal.aborted) setAvailability({ key: availabilityKey, value: data.availableDays }); })
      .catch(() => { if (!controller.signal.aborted) setAvailability({ key: availabilityKey, failed: true }); });
    return () => controller.abort();
  }, [availabilityKey, appointmentId, from, personId, serviceId, to]);

  useEffect(() => {
    if (!serviceId || !personId || !date) return;
    const controller = new AbortController();
    void apiRequest<PublicAvailabilityResponse>("/appointments/availability", {
      query: { serviceId, collaboratorId: personId, date, appointmentId }, signal: controller.signal,
    }).then((data) => { if (!controller.signal.aborted) setSlots({ key: slotKey, value: data }); })
      .catch(() => { if (!controller.signal.aborted) setSlots({ key: slotKey, failed: true }); });
    return () => controller.abort();
  }, [appointmentId, date, personId, serviceId, slotKey]);

  const availableDays = availability.key === availabilityKey && availability.value ? new Set(availability.value) : emptyDays;
  const people = collaborators.filter((person) => person.isActive && (links.key === serviceId && links.value?.includes(person.id)));
  const activeSlots = slots.key === slotKey ? slots.value?.slots : undefined;
  const canSave = !!activeSlots?.some((slot) => slot.startsAt === time);
  const isChecking = !!serviceId && !!personId && from <= to && availability.key !== availabilityKey;
  const availabilityFailed = availability.key === availabilityKey && availability.failed;
  const slotsFailed = slots.key === slotKey && slots.failed;

  const selectDate = (day: string) => { setDate(day); setTime(""); };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || saving) return;
    if (!appointment && !isValidInternationalPhone(country, phone)) { setError(t.errors.invalidPhone); return; }
    setSaving(true);
    setError("");
    const payload: CreateAppointmentPayload | RescheduleAppointmentPayload = appointment
      ? { startsAt: time, collaboratorId: personId }
      : { serviceId, collaboratorId: personId, startsAt: time, clientName: name.trim(), clientPhone: formatPhoneToE164(country, phone),
        notes: notes.trim() || undefined, initialStatus: confirmed ? "CONFIRMED" : "PENDING" };
    try {
      const saved = await apiRequest<Appointment>(appointment ? `/appointments/${appointment.id}/reschedule` : "/appointments", {
        method: appointment ? "PATCH" : "POST", body: payload,
      });
      onSaved(saved);
    } catch (failure) {
      setError(failure instanceof ApiError && failure.message === "Appointment must start on a 30-minute boundary."
        ? copy.slotBoundary : failure instanceof ApiError && failure.status === 409 ? t.common.noAvailableSlotsForDay : t.errors.networkDescription);
      setTime("");
      setRefresh((value) => value + 1);
    } finally { setSaving(false); }
  }

  return <AgendaDialog title={appointment ? t.owner.reschedule : t.owner.newAppointment} closeDisabled={saving} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {appointment ? <div><p className="text-xs font-semibold text-ink-secondary">{t.booking.stepService}</p><p className="mt-2 text-sm font-semibold">{appointment.serviceNameSnapshot}</p></div>
          : <AgendaSelect label={t.booking.stepService} placeholder={copy.pickService} value={serviceId}
            options={services.filter((service) => service.active).map((service) => ({ value: service.id, label: `${service.name} · ${formatPriceFromCents(service.priceInCents, locale, company.currency)}` }))}
            onChange={(value) => { setServiceId(value); if (!initialPersonId) setPersonId(""); if (!initialDate) selectDate(""); }} disabled={saving} />}
        <AgendaSelect label={copy.professional} placeholder={copy.pickProfessional} value={personId}
          options={people.map((person) => ({ value: person.id, label: person.name, person }))}
          onChange={(value) => { setPersonId(value); if (!initialDate) selectDate(""); }} disabled={saving || !serviceId || links.key !== serviceId} />
      </div>
      {links.key === serviceId && links.failed && <p role="alert" className="text-xs text-[var(--status-danger-ink)]">{t.errors.networkDescription}</p>}

      <div className="grid gap-4 rounded-2xl border border-border-subtle bg-subtle/40 p-3 sm:grid-cols-[14rem_1fr] sm:p-4">
        <div className="mx-auto w-full max-w-58 sm:max-w-none">
          <AgendaMonthGrid month={month} selected={date} today={today} company={company} booking available={availableDays}
            onMonth={(value) => { setMonth(value); selectDate(""); }} onSelect={selectDate} />
        </div>
        <div className="min-w-0 space-y-3 sm:border-l sm:border-border-subtle sm:pl-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><Clock size={15} className="text-accent" />{t.common.availableSlotsLabel}</p>
          {!serviceId || !personId ? <p className="text-xs text-ink-secondary">{t.common.selectServiceAndProForSlots}</p>
            : isChecking || (date && slots.key !== slotKey) ? <p role="status" className="text-xs text-ink-secondary">{t.common.loading}</p>
              : availabilityFailed || slotsFailed ? <button type="button" onClick={() => setRefresh((value) => value + 1)} className="cursor-pointer text-xs text-accent underline">{t.common.retry}</button>
                : !date ? <p className="text-xs text-ink-secondary">{availableDays.size ? copy.pickDate : copy.noAvailability}</p>
                  : activeSlots?.length ? <div className="grid max-h-55 grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-3">
                    {activeSlots.map((slot) => <button key={slot.startsAt} type="button" aria-pressed={time === slot.startsAt}
                      onClick={() => setTime(slot.startsAt)} disabled={saving} className={`cursor-pointer rounded-lg border p-2 text-xs font-semibold tabular-nums hover:border-accent disabled:cursor-not-allowed ${time === slot.startsAt ? "border-accent bg-accent text-accent-ink" : "border-border-subtle bg-surface text-ink"}`}>
                      {formatTimeInTimezone(slot.startsAt, company.timezone, locale)}
                    </button>)}
                  </div> : <p className="text-xs text-ink-secondary">{copy.noSlots}</p>}
        </div>
      </div>

      {!appointment && <>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold text-ink-secondary">{copy.clientName}
            <input className={field} required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div>
            <label htmlFor="agenda-phone" className="mb-1.5 block text-xs font-semibold text-ink-secondary">{t.booking.whatsappLabel}</label>
            <div className="grid grid-cols-[6.1rem_1fr] gap-2">
              <AgendaSelect label={t.phone.countryLabel} compact value={country} options={[{ value: "+55", label: "BR +55" }, { value: "+58", label: "VE +58" }]}
                onChange={(value) => { if (value === "+55" || value === "+58") { setCountry(value); setPhone(""); } }} disabled={saving} />
              <input className={field} type="tel" inputMode="numeric" autoComplete="tel-national" required id="agenda-phone" value={formatNationalPhoneDisplay(country, phone)}
                placeholder={country === "+55" ? t.phone.placeholderBR : t.phone.placeholderVE} onChange={(event) => setPhone(stripNonDigits(event.target.value).slice(0, 11))} />
            </div>
          </div>
        </div>
        <label className="block space-y-1.5 text-xs font-semibold text-ink-secondary">{copy.notes}
          <textarea className={`${field} min-h-19 resize-y`} maxLength={1000} value={notes} placeholder={copy.notesPlaceholder} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink"><input type="checkbox" className="size-4 cursor-pointer accent-accent" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />{t.owner.createAsConfirmed}</label>
      </>}
      {error && <p role="alert" className="rounded-xl bg-[var(--status-danger-bg)] p-3 text-xs text-[var(--status-danger-ink)]">{error}</p>}
      <button disabled={saving || !canSave} className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-55" type="submit">
        {saving && <LoaderCircle size={16} className="animate-spin" />}{t.common.save}
      </button>
    </form>
  </AgendaDialog>;
}
