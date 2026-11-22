"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { Building2, CalendarClock, Users, Star, Globe2, KeyRound, Palette, Copy, QrCode, Bell, CreditCard, Package, Link2 } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api-client";
import { companyWeekday } from "@/lib/agenda";
import { displayCompanyRating, clientFieldOptions, selectedClientFields, addressFields, agendaIntervals, bookingIntervals, formatCompanyAddress, leadTimes, type CompanyAddress, type CompanySettings, type OwnerAppearance, type ReminderSettings } from "@/lib/company-settings";
import { DEFAULT_CUSTOM_REMINDER_MESSAGES, REMINDER_VARIABLES, renderReminderMessage } from "@/lib/reminder-templates";
import { formatPhoneToE164, isValidInternationalPhone, stripNonDigits } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { applyDashboardTheme, THEME_PALETTES, useTheme } from "@/lib/theme-context";
import { IANA_TIMEZONES } from "@/lib/timezones";
import { saveCompanySettings, useCompanySettings } from "@/lib/use-company-settings";
import { useGooglePlace } from "@/lib/use-google-place";
import type { PhoneCountryCode } from "@/lib/types/public-booking";
import type { Currency } from "@/lib/types/finance";
import { useSession } from "@/components/ui/auth-guard";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { PasswordRecovery, validNewPassword } from "@/components/ui/password-recovery";
import { CompanyRating } from "@/components/ui/company-rating";
import { GooglePlaceSettings } from "./google-place-settings";
import { OnlinePaymentSettingsPanel } from "./online-payment-settings";
import { SatisfactionSettings } from "./satisfaction-settings";

const sections = [
  ["company", "Empresa", "Empresa", Building2],
  ["agenda", "Intervalo da Agenda", "Intervalo de la agenda", CalendarClock],
  ["reminders", "Lembretes", "Recordatorios", Bell],
  ["clients", "Dados de Clientes & Anamnese", "Datos de clientes y anamnesis", Users],
  ["payment", "Pagto. Online", "Pago en línea", CreditCard],
  ["packages", "Venda de Pacotes", "Venta de paquetes", Package],
  ["booking", "Link de Agendamento", "Enlace de reservas", Link2],
  ["survey", "Pesquisa de Satisfação", "Encuesta de satisfacción", Star],
  ["region", "Fuso Horário & Moeda", "Zona horaria y moneda", Globe2],
  ["security", "Segurança & Senha", "Seguridad y contraseña", KeyRound],
  ["appearance", "Tema & Aparência", "Tema y apariencia", Palette],
] as const;

const ownerCountryCodes = ["+55", "+58", "+1", "+34", "+351"] as const;
const field = "min-h-11 w-full min-w-0 rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink";

export function SettingsPanel() {
  const [active, setActive] = useState<typeof sections[number][0]>("company");
  const { locale, t } = useLocale();
  const es = locale === "es";
  const { session } = useSession();
  const { settings } = useCompanySettings(session.company.id);
  const { place: googlePlace } = useGooglePlace(session.company.id, settings.googlePlaceId, { summary: true });

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <header className="lg:col-span-2">
        <h1 className="text-title-sm font-bold text-ink">{t.owner.settingsTitle}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-secondary">
          {session.company.companyName}<CompanyRating rating={displayCompanyRating(settings, googlePlace)} />
        </div>
      </header>
      <nav aria-label={t.owner.settingsTitle} className="self-start rounded-2xl border border-border-subtle bg-surface p-2 lg:sticky lg:top-20">
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
          {sections.map(([id, pt, spanish, Icon]) => (
            <li key={id}>
              <button type="button" aria-current={active === id ? "page" : undefined} aria-controls="settings-content"
                onClick={() => setActive(id)}
                className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink-secondary hover:bg-subtle aria-[current=page]:bg-accent-soft aria-[current=page]:text-ink">
                <Icon className="size-4 shrink-0" aria-hidden="true" />{es ? spanish : pt}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div id="settings-content" className="min-w-0 space-y-4">
        {active === "company" && <CompanyPanel />}
        {active === "agenda" && <AgendaPanel />}
        {active === "reminders" && <RemindersPanel />}
        {active === "clients" && <ClientsPanel />}
        {active === "payment" && <OnlinePaymentSettingsPanel />}
        {active === "packages" && <PackagesPanel />}
        {active === "booking" && <AgendaPanel publicLink />}
        {active === "survey" && <SatisfactionSettings />}
        {active === "region" && <RegionPanel />}
        {active === "security" && <SecurityPanel />}
        {active === "appearance" && <AppearancePanel />}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="min-w-0 space-y-4 rounded-2xl border border-border-subtle bg-surface p-4 sm:p-6">
    <h2 className="text-title-sm font-bold text-ink">{title}</h2>
    {children}
  </section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid min-w-0 gap-1.5 text-sm font-medium text-ink">{label}{children}</label>;
}

function useSave() {
  const { t } = useLocale();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<unknown>) {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await action();
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError && (err.code === "FINANCE_CURRENCY_LOCKED" || err.message === "FINANCE_CURRENCY_LOCKED")
        ? t.finance.FINANCE_CURRENCY_LOCKED : err instanceof Error ? err.message : t.errors.unexpectedDescription);
    } finally {
      setSaving(false);
    }
  }
  return { saving, saved, error, run };
}

function Save({ state, disabled }: { state: ReturnType<typeof useSave>; disabled?: boolean }) {
  const { t, locale } = useLocale();
  return <div className="flex flex-wrap items-center gap-3">
    <Button type="submit" className="min-h-11 px-4" disabled={state.saving || disabled}>{state.saving ? t.common.saving : t.common.save}</Button>
    {state.saved && <span role="status" className="text-sm text-ink-secondary">{locale === "es" ? "Cambios guardados." : "Alterações salvas."}</span>}
    {state.error && <span role="alert" className="text-sm text-[var(--status-danger-ink)]">{state.error}</span>}
  </div>;
}

function CompanyPanel() {
  const { session, refreshSession } = useSession();
  const { settings } = useCompanySettings(session.company.id);
  const { t, locale } = useLocale();
  const es = locale === "es";
  const save = useSave();
  const addressSave = useSave();
  const [companyName, setCompanyName] = useState(session.company.companyName);
  const [ownerName, setOwnerName] = useState(session.name);
  const [avatarUrl, setAvatarUrl] = useState(session.company.avatarUrl ?? session.avatarUrl ?? null);
  const [country, setCountry] = useState<PhoneCountryCode>(() => {
    const international = ownerCountryCodes.find((code) => session.phone.startsWith(code));
    if (international) return international;
    if (/^58\d{10}$/.test(session.phone) || session.company.timezone === "America/Caracas") return "+58";
    return "+55";
  });
  const [phone, setPhone] = useState(() => {
    const digits = stripNonDigits(session.phone);
    const prefix = stripNonDigits(country);
    return digits.startsWith(prefix) && (session.phone.startsWith("+") || digits.length > 11)
      ? digits.slice(prefix.length) : digits;
  });
  const [address, setAddress] = useState<CompanyAddress | null>(null);
  const [editingAddress, setEditingAddress] = useState(false);
  const [postalNotice, setPostalNotice] = useState("");
  const [postalLoading, setPostalLoading] = useState(false);
  const [googleDraft, setGoogleDraft] = useState<Partial<Record<"googleMapsUrl" | "googleRating" | "googleReviewsCount", string>>>({});
  const googleSave = useSave();
  const postalRequest = useRef<AbortController | null>(null);
  const numberField = useRef<HTMLInputElement>(null);

  useEffect(() => () => postalRequest.current?.abort(), []);

  async function lookUpPostalCode(value: string) {
    postalRequest.current?.abort();
    setPostalNotice("");
    const cep = value.replace(/\D/g, "").slice(0, 8);
    setAddress((current) => current && { ...current, postalCode: cep });
    setPostalLoading(cep.length === 8);
    if (cep.length !== 8) return;
    const request = new AbortController();
    postalRequest.current = request;
    setPostalNotice(es ? "Buscando dirección…" : "Buscando endereço…");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]) });
      if (!response.ok) throw new Error();
      const data = await response.json() as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (request.signal.aborted) return;
      if (data.erro === true || data.erro === "true") {
        setPostalNotice(es ? "Código postal no encontrado." : "CEP não encontrado.");
        return;
      }
      setAddress((current) => current?.postalCode === cep ? {
        ...current, street: data.logradouro || current.street, district: data.bairro || current.district,
        city: data.localidade || current.city, state: data.uf || current.state,
      } : current);
      setPostalNotice("");
      numberField.current?.focus();
    } catch {
      if (!request.signal.aborted) setPostalNotice(es ? "No fue posible consultar el código postal." : "Não foi possível consultar o CEP.");
    } finally {
      if (!request.signal.aborted) setPostalLoading(false);
    }
  }
  const [schedule, setSchedule] = useState(() => [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
    const { isOpen, hours } = companyWeekday(session.company, dayOfWeek);
    return { dayOfWeek, isOpen, openTime: hours?.openTime?.slice(0, 5) || "08:00", closeTime: hours?.closeTime?.slice(0, 5) || "19:00" };
  }));
  const addressLabels = es ? ["Código postal", "Calle", "Número", "Barrio", "Ciudad", "Estado"] : ["CEP", "Rua", "Número", "Bairro", "Cidade", "Estado"];

  function submitProfile(event: FormEvent) {
    event.preventDefault();
    void save.run(async () => {
      if (!isValidInternationalPhone(country, phone)) throw new Error(t.errors.invalidPhone);
      if (schedule.some((day) => day.isOpen && day.openTime >= day.closeTime)) {
        throw new Error(es ? "El cierre debe ser posterior a la apertura." : "O fechamento deve ser posterior à abertura.");
      }
      await apiRequest("/me/profile", { method: "PATCH", body: {
        companyName: companyName.trim(), name: ownerName.trim(), avatarUrl, phone: formatPhoneToE164(country, phone),
        operatingDays: schedule.filter((day) => day.isOpen).map((day) => day.dayOfWeek).sort().join(","),
        operatingSchedule: schedule.map((day) => day.isOpen ? day : { ...day, openTime: null, closeTime: null }),
      } });
      await refreshSession();
    });
  }

  return <>
    <Card title={es ? "Información de la empresa" : "Informações da empresa"}>
      <form onSubmit={submitProfile} className="space-y-5">
        <AvatarPicker id="settings-logo" value={avatarUrl} onChange={setAvatarUrl} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.auth.companyNameLabel}><input className={field} required minLength={3} maxLength={100} value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></Field>
          <Field label={es ? "Nombre completo del responsable" : "Nome completo do responsável"}><input className={field} required minLength={2} maxLength={80} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} /></Field>
          <PhoneInput id="settings-owner-phone" label={es ? "WhatsApp del responsable" : "Celular / WhatsApp do responsável"} countries={ownerCountryCodes} countryCode={country} value={phone} onCountryCodeChange={setCountry} onChange={setPhone} />
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-base font-bold text-ink">{es ? "Días y horarios de atención" : "Dias e horários de funcionamento"}</legend>
          {schedule.map((day) => {
            const label = t.days[day.dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6];
            function update(patch: Partial<typeof day>) {
              setSchedule((current) => current.map((row) => row.dayOfWeek === day.dayOfWeek ? { ...row, ...patch } : row));
            }
            return <div key={day.dayOfWeek} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle p-2.5">
              <label className="flex min-h-9 items-center gap-2 text-sm font-medium">
                <input type="checkbox" role="switch" className="size-4 accent-accent" checked={day.isOpen} onChange={(event) => update({ isOpen: event.target.checked })} />{label}
              </label>
              <div className="flex items-center gap-2">
                <input className={field + " w-auto"} aria-label={label + (es ? " apertura" : " abertura")} type="time" required={day.isOpen} disabled={!day.isOpen} value={day.openTime} onChange={(event) => update({ openTime: event.target.value })} />
                <span aria-hidden="true">–</span>
                <input className={field + " w-auto"} aria-label={label + (es ? " cierre" : " fechamento")} type="time" required={day.isOpen} disabled={!day.isOpen} value={day.closeTime} onChange={(event) => update({ closeTime: event.target.value })} />
              </div>
            </div>;
          })}
        </fieldset>
        <Save state={save} />
      </form>
    </Card>
    <Card title={es ? "Dirección" : "Endereço"}>
      <p className="text-sm text-ink-secondary">{formatCompanyAddress(settings.address) || (es ? "Sin dirección registrada" : "Sem endereço cadastrado")}</p>
      {editingAddress && address ? <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        void addressSave.run(async () => {
          await saveCompanySettings(session.company.id, { address });
          setEditingAddress(false);
        });
      }}>
        <div className="grid gap-3 sm:grid-cols-2">
          {addressFields.map((key, index) => <Field key={key} label={addressLabels[index]}>
            <input className={field} value={address[key]} maxLength={key === "postalCode" ? 9 : 120} required={key === "street" || key === "city"}
              ref={key === "number" ? numberField : undefined} inputMode={key === "postalCode" ? "numeric" : undefined}
              onChange={(event) => key === "postalCode" ? void lookUpPostalCode(event.target.value) :
                setAddress({ ...address, [key]: event.target.value })} />
          </Field>)}
        </div>
        {postalNotice && <p role="status" className="text-sm text-ink-secondary">{postalNotice}</p>}
        <div className="flex flex-wrap gap-3"><Save state={addressSave} disabled={postalLoading} /><Button type="button" variant="outline" onClick={() => { postalRequest.current?.abort(); setPostalLoading(false); setPostalNotice(""); setEditingAddress(false); }}>{t.common.cancel}</Button></div>
      </form> : <Button variant="outline" onClick={() => {
        setAddress(settings.address ?? { postalCode: "", street: "", number: "", district: "", city: "", state: "" });
        setEditingAddress(true);
      }}>{es ? "Editar dirección" : "Editar endereço"}</Button>}
    </Card>
    <Card title="Google Maps">
      <GooglePlaceSettings companyId={session.company.id} settings={settings} />
      <form className="space-y-4 border-t border-border-subtle pt-4" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void googleSave.run(async () => {
          const rating = String(form.get("googleRating"));
          const count = String(form.get("googleReviewsCount"));
          await saveCompanySettings(session.company.id, {
            googleMapsUrl: String(form.get("googleMapsUrl")).trim() || null,
            googleRating: rating ? Number(rating) : null,
            googleReviewsCount: count ? Number(count) : null,
          });
          setGoogleDraft({});
        });
      }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
          {es ? "Alternativa manual (si no usas la búsqueda de Google Places)" : "Alternativa manual (caso não use a busca do Google Places)"}
        </p>
        <Field label={es ? "Enlace de Google Maps" : "Link do Google Maps"}>
          <input name="googleMapsUrl" type="url" maxLength={2048} className={field}
            value={googleDraft.googleMapsUrl ?? settings.googleMapsUrl ?? ""}
            onChange={(event) => setGoogleDraft({ ...googleDraft, googleMapsUrl: event.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={es ? "Nota en Google (estrellas)" : "Nota no Google (estrelas)"}>
            <input name="googleRating" type="number" min={1} max={5} step={0.1} className={field}
              value={googleDraft.googleRating ?? settings.googleRating ?? ""}
              onChange={(event) => setGoogleDraft({ ...googleDraft, googleRating: event.target.value })} />
          </Field>
          <Field label={es ? "Cantidad de evaluaciones" : "Quantidade de avaliações"}>
            <input name="googleReviewsCount" type="number" min={0} max={100000000} step={1} className={field}
              value={googleDraft.googleReviewsCount ?? settings.googleReviewsCount ?? ""}
              onChange={(event) => setGoogleDraft({ ...googleDraft, googleReviewsCount: event.target.value })} />
          </Field>
        </div>
        <Save state={googleSave} disabled={!Object.keys(googleDraft).length} />
      </form>
    </Card>
  </>;
}

function Options<T extends string | number>({ label, values, value, onChange, render }: {
  label: string; values: readonly T[]; value: T; onChange: (value: T) => void; render: (value: T) => ReactNode;
}) {
  return <fieldset className="space-y-2">
    <legend className="mb-2 text-sm font-semibold text-ink">{label}</legend>
    <div className="flex flex-wrap gap-2">
      {values.map((option) => <label key={option} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border-subtle px-3 py-2 text-sm text-ink has-checked:border-accent has-checked:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
        <input type="radio" className="sr-only" name={label} checked={option === value} onChange={() => onChange(option)} />{render(option)}
      </label>)}
    </div>
  </fieldset>;
}

function AgendaPanel({ publicLink = false }: { publicLink?: boolean }) {
  const { session } = useSession();
  const { settings } = useCompanySettings(session.company.id);
  const { locale, t } = useLocale();
  const es = locale === "es";
  const save = useSave();
  const [draft, setDraft] = useState<Partial<Pick<CompanySettings, "agendaInterval" | "bookingInterval" | "leadTime">>>({});
  const [linkStatus, setLinkStatus] = useState("");
  const [qr, setQr] = useState("");
  const path = `/book/${session.company.id}`;
  const url = typeof window === "undefined" ? path : new URL(path, window.location.origin).href;
  const minutes = (value: number) => `${value} min`;

  return <>
    <Card title={publicLink ? (es ? "Reglas de reserva" : "Regras de agendamento") : (es ? "Intervalo de la agenda" : "Intervalo da Agenda")}>
      <form className="space-y-5" onSubmit={(event) => {
        event.preventDefault();
        void save.run(async () => { await saveCompanySettings(session.company.id, draft); setDraft({}); });
      }}>
        {!publicLink && <Options label={es ? "Intervalo de la cuadrícula interna" : "Intervalo da grade interna"} values={agendaIntervals} value={draft.agendaInterval ?? settings.agendaInterval} render={minutes} onChange={(agendaInterval) => setDraft({ ...draft, agendaInterval })} />}
        {publicLink && <><Options label={es ? "Horarios del enlace de reservas" : "Horários do link de agendamento"} values={bookingIntervals} value={draft.bookingInterval ?? settings.bookingInterval}
          render={(value) => value ? minutes(value) : es ? "Seguir agenda" : "Seguir Agenda"} onChange={(bookingInterval) => setDraft({ ...draft, bookingInterval })} />
        <Options label={es ? "Anticipación mínima para reservar o cancelar" : "Antecedência mínima para agendar ou cancelar"} values={leadTimes} value={draft.leadTime ?? settings.leadTime}
          render={(value) => value >= 60 ? `${value / 60} h` : value ? minutes(value) : es ? "Sin restricción" : "Sem restrição"} onChange={(leadTime) => setDraft({ ...draft, leadTime })} /></>}
        <Save state={save} disabled={!Object.keys(draft).length} />
      </form>
    </Card>
    {publicLink && <Card title={es ? "Enlace público y código QR" : "Link público e QR Code"}>
      <Link href={path} target="_blank" rel="noopener noreferrer" className="block break-all text-sm text-accent underline">{url}</Link>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={async () => {
          try { await navigator.clipboard.writeText(url); setLinkStatus(t.common.copied); }
          catch { setLinkStatus(es ? "Selecciona y copia el enlace." : "Selecione e copie o link."); }
        }}><Copy className="size-4" />{es ? "Copiar enlace" : "Copiar link"}</Button>
        <Button variant="outline" onClick={async () => {
          if (qr) { setQr(""); return; }
          try {
            const { toDataURL } = await import("qrcode");
            setQr(await toDataURL(url, { width: 320, margin: 4, errorCorrectionLevel: "M" }));
          } catch { setLinkStatus(es ? "No se pudo generar el código QR." : "Não foi possível gerar o QR Code."); }
        }}><QrCode className="size-4" />{qr ? (es ? "Ocultar código QR" : "Ocultar QR Code") : (es ? "Ver código QR" : "Visualizar QR Code")}</Button>
      </div>
      {linkStatus && <p role="status" className="text-sm text-ink-secondary">{linkStatus}</p>}
      {qr && <div className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={es ? "Código QR del enlace de reservas" : "QR Code do link de agendamento"} width={200} height={200} className="rounded-xl" />
        <a className="text-sm font-semibold text-accent underline" download="cloudgo-agendamento.png" href={qr}>{es ? "Descargar PNG" : "Baixar PNG"}</a>
      </div>}
    </Card>}
  </>;
}

function ClientsPanel() {
  const { session } = useSession();
  const { settings } = useCompanySettings(session.company.id, undefined, true, true);
  const { locale } = useLocale();
  const es = locale === "es";
  const save = useSave();
  const [draft, setDraft] = useState<(string | null)[]>();
  const [radar, setRadar] = useState<boolean>();
  const previous = settings.clientFieldSlots ?? selectedClientFields(settings).map(({ id }) => id);
  const slots = draft ?? [...previous, ...Array.from<null>({ length: Math.max(0, 4 - previous.length) }).fill(null)];
  const options = clientFieldOptions(settings, es);
  const groups = [
    ["registration", es ? "Datos de registro" : "Dados Cadastrais"],
    ["technical", es ? "Ficha técnica y salud" : "Ficha Técnica & Saúde (Salão / Barbearia)"],
    ["custom", es ? "Campos personalizados" : "Campos personalizados"],
  ];

  return <Card title={es ? "Datos de clientes" : "Dados de Clientes"}>
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      void save.run(async () => {
        await saveCompanySettings(session.company.id, { clientFieldSlots: slots, birthdayRadar: radar ?? settings.birthdayRadar });
        setDraft(undefined);
        setRadar(undefined);
      });
    }}>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-3 font-semibold text-ink">{es ? "Campos adicionales" : "Campos adicionais"}</legend>
        {slots.map((selected, index) => <Field key={index} label={`Campo ${index + 1}`}>
          <select className={field} value={selected ?? ""} onChange={(event) => {
            const value = event.target.value || null;
            setDraft(slots.map((slot, position) => position === index ? value : slot));
          }}>
            <option value="">{es ? "- Ninguno (Opcional) -" : "- Nenhum (Opcional) -"}</option>
            {groups.map(([group, label]) => {
              const items = options.filter((option) => option.group === group);
              return items.length ? <optgroup key={group} label={label}>
                {items.map(({ id, label }) => <option key={id} value={id} disabled={slots.includes(id) && selected !== id}>{label}</option>)}
              </optgroup> : null;
            })}
          </select>
        </Field>)}
      </fieldset>
      {slots.length < 32 && slots.length < Math.max(4, options.length) && <Button type="button" variant="ghost" className="min-h-10" onClick={() => setDraft([...slots, null])}>
        {es ? "+ Añadir otro campo" : "+ Adicionar outro campo"}
      </Button>}
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input type="checkbox" role="switch" checked={radar ?? settings.birthdayRadar} className="size-4 accent-accent" onChange={(event) => setRadar(event.target.checked)} />
        {es ? "Activar recordatorio de cumpleaños en el CRM" : "Ativar radar de aniversariantes no CRM"}
      </label>
      <Save state={save} disabled={!draft && radar === undefined} />
    </form>
  </Card>;
}

const reminderDefaults: ReminderSettings = { enabled: false, hours: 2, template: "buttons", message: DEFAULT_CUSTOM_REMINDER_MESSAGES["pt-BR"], externalUrl: "", servicePhone: "" };
const reminderTemplates = ["buttons", "plain", "whatsapp", "external", "custom"] as const;

function RemindersPanel() {
  const { session } = useSession();
  const { settings } = useCompanySettings(session.company.id, undefined, true, true);
  const { locale } = useLocale();
  const es = locale === "es";
  const reminderLocale = es ? "es" : "pt-BR";
  const save = useSave();
  const [draft, setDraft] = useState<Partial<ReminderSettings>>({});
  const [countryDraft, setCountryDraft] = useState<PhoneCountryCode>();
  const editor = useRef<HTMLTextAreaElement>(null);
  const current = { ...(settings.reminders ?? reminderDefaults), ...draft };
  const apply = (patch: Partial<ReminderSettings>) => setDraft((previous) => ({ ...previous, ...patch }));
  const defaultCustomMessage = DEFAULT_CUSTOM_REMINDER_MESSAGES[reminderLocale];
  const customMessage = draft.message ?? (settings.reminders?.message || defaultCustomMessage);
  const phone = current.servicePhone ?? "";
  const country = countryDraft ?? ownerCountryCodes.find((code) => phone.startsWith(code)) ?? "+55";
  const digits = phone.startsWith(country) ? phone.slice(country.length) : "";
  const names = es ? ["Estándar con botones", "Texto simple", "Atención por WhatsApp", "Enlace externo", "Personalizado"]
    : ["Padrão com Botões", "Texto Simples", "Atendimento via WhatsApp", "Link Externo", "Personalizado"];
  const appUrl = typeof window === "undefined" ? `/book/${session.company.id}` : new URL(`/book/${session.company.id}`, window.location.origin).href;
  const preview = renderReminderMessage(
    current.template,
    {
      clientName: "Ana",
      companyName: session.company.companyName,
      professionalName: "Rafa",
      serviceName: es ? "Corte de cabello" : "Corte de cabelo",
      date: "25/06",
      time: "14:00",
      appUrl,
    },
    { locale: reminderLocale, customMessage },
  );
  const actions: Record<ReminderSettings["template"], string[]> = {
    buttons: [es ? "Confirmar" : "Confirmar", es ? "Cancelar" : "Cancelar"],
    plain: [],
    whatsapp: [es ? "Hablar con un agente…" : "Falar com atendente..."],
    external: [es ? "Más información…" : "Saiba mais..."],
    custom: [],
  };

  function insertVariable(token: string) {
    const input = editor.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    apply({ message: customMessage.slice(0, start) + token + customMessage.slice(end) });
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(15rem,0.72fr)]">
    <Card title={es ? "Recordatorios de citas" : "Lembretes de agendamento"}>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        void save.run(async () => {
          if (current.template === "whatsapp" && !isValidInternationalPhone(country, digits)) {
            throw new Error(es ? "Ingresa un teléfono de atención válido." : "Informe um telefone de atendimento válido.");
          }
          const reminders = {
            ...current, message: current.template === "custom" ? customMessage : current.message,
            servicePhone: current.template === "whatsapp" ? formatPhoneToE164(country, digits) : "",
          };
          await saveCompanySettings(session.company.id, { reminders });
          setDraft({});
        });
      }}>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input type="checkbox" role="switch" className="size-4 accent-accent" checked={current.enabled} onChange={(event) => apply({ enabled: event.target.checked })} />
          {es ? "Activar recordatorios de citas" : "Ativar lembretes de agendamento"}
        </label>
        <Options label={es ? "Anticipación" : "Antecedência"} values={[1, 2, 4, 24] as const} value={current.hours}
          onChange={(hours) => apply({ hours })} render={(hours) => `${hours}h`} />
        <Field label={es ? "Plantilla de mensaje" : "Modelo de mensagem"}>
          <select className={field} value={current.template} onChange={(event) => apply({ template: event.target.value as ReminderSettings["template"] })}>
            {reminderTemplates.map((id, index) => <option key={id} value={id}>{names[index]}</option>)}
          </select>
        </Field>
        {current.template === "whatsapp" && <PhoneInput id="reminder-phone" required showFlags
          label={es ? "Teléfono de atención" : "Telefone de Atendimento"} countryCode={country} countries={ownerCountryCodes} value={digits}
          onCountryCodeChange={(next) => { setCountryDraft(next); apply({ servicePhone: digits ? next + digits : "" }); }}
          onChange={(value) => apply({ servicePhone: value ? country + value : "" })} />}
        {current.template === "external" && <Field label="Link (URL)">
          <input className={field} type="url" required maxLength={2048} placeholder="https://" pattern="https://.*"
            value={current.externalUrl} onChange={(event) => apply({ externalUrl: event.target.value })} />
        </Field>}
        {current.template === "custom" && <>
          <Field label={es ? "Mensaje personalizado" : "Mensagem personalizada"}>
            <textarea ref={editor} className={field + " py-2"} rows={10} required maxLength={1500} value={customMessage}
              onChange={(event) => apply({ message: event.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-2" role="group" aria-label={es ? "Insertar variable" : "Inserir variável"}>
            {REMINDER_VARIABLES.map((variable) => <Button key={variable} type="button" variant="outline" className="min-h-9"
              onClick={() => insertVariable(`{${variable}}`)}>{`{${variable}}`}</Button>)}
          </div>
        </>}
        <Save state={save} disabled={!Object.keys(draft).length} />
      </form>
    </Card>
    <Card title={es ? "Vista previa en WhatsApp" : "Prévia no WhatsApp"}>
      <div className="rounded-xl bg-emerald-100 p-3 text-sm text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50">
        <p className="min-h-10 whitespace-pre-wrap break-words">{preview.split(/(\*[^*\n]+\*)/).map((part, index) =>
          index % 2 ? <strong key={index}>{part.slice(1, -1)}</strong> : part)}</p>
        {actions[current.template].length > 0 && <div className="mt-3 grid gap-1 border-t border-emerald-700/40 pt-2">
          {actions[current.template].map((label) => <span key={label}
            title={current.template === "external" ? current.externalUrl : current.template === "whatsapp" ? phone : undefined}
            className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-xs font-semibold dark:bg-emerald-900">{label}</span>)}
        </div>}
      </div>
      <p className="text-xs text-ink-secondary">{es ? `Ejemplo de mensaje · ${current.hours} h antes` : `Exemplo de mensagem · ${current.hours}h antes`}</p>
    </Card>
  </div>;
}

function PackagesPanel() {
  const { session } = useSession();
  const { settings } = useCompanySettings(session.company.id, undefined, true, true);
  const { locale } = useLocale();
  const es = locale === "es";
  const save = useSave();
  const [draft, setDraft] = useState<Partial<NonNullable<CompanySettings["packageSales"]>>>({});
  const current = { ...(settings.packageSales ?? { enabled: true, notes: "" }), ...draft };
  return <Card title={es ? "Venta de paquetes" : "Venda de Pacotes"}>
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      void save.run(async () => { await saveCompanySettings(session.company.id, { packageSales: current }); setDraft({}); });
    }}>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input className="size-4 accent-accent" type="checkbox" role="switch" checked={current.enabled}
          onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
        {es ? "Permitir nuevas ventas de paquetes" : "Permitir novas vendas de pacotes"}
      </label>
      <Field label={es ? "Observaciones internas" : "Observações internas"}>
        <textarea className={field + " py-2"} rows={3} maxLength={1000} value={current.notes}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
      </Field>
      <Save state={save} disabled={!Object.keys(draft).length} />
    </form>
    <Link className="inline-block text-sm font-semibold text-ink underline" href="/owner/services/packages">
      {es ? "Gestionar paquetes de servicios" : "Gerenciar pacotes de serviços"}
    </Link>
  </Card>;
}

function RegionPanel() {
  const { session, refreshSession } = useSession();
  const { t } = useLocale();
  const timezoneSave = useSave();
  const currencySave = useSave();
  const [timezone, setTimezone] = useState(session.company.timezone);
  const [currency, setCurrency] = useState<Currency>(session.company.currency);
  return <>
    <Card title={t.auth.timezoneLabel}>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        void timezoneSave.run(async () => {
          await apiRequest("/companies/me/timezone", { method: "PATCH", body: { timezone } });
          await refreshSession();
        });
      }}>
        <Field label={t.common.timezone}><select className={field} value={timezone} onChange={(event) => setTimezone(event.target.value)}>
          {!IANA_TIMEZONES.some((zone) => zone.value === timezone) && <option value={timezone}>{timezone}</option>}
          {IANA_TIMEZONES.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}
        </select></Field>
        <Save state={timezoneSave} disabled={timezone === session.company.timezone} />
      </form>
    </Card>
    <Card title={t.finance.baseCurrency}>
      <p className="text-sm text-ink-secondary">{t.finance.baseCurrencyHelp}</p>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        void currencySave.run(async () => {
          await apiRequest("/companies/me/currency", { method: "PATCH", body: { currency } });
          await refreshSession();
        });
      }}>
        <Field label={t.dashboard.currency}><select className={field} value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
          <option value="BRL">BRL · R$</option><option value="USD">USD · $</option><option value="VES">VES · Bs.</option>
        </select></Field>
        <Save state={currencySave} disabled={currency === session.company.currency} />
      </form>
    </Card>
  </>;
}

function SecurityPanel() {
  const { t, locale } = useLocale();
  const es = locale === "es";
  const save = useSave();
  return <Card title={t.collaborator.securityTitle}>
    <p id="settings-password-hint" className="text-sm text-ink-secondary">{t.auth.passwordHint}</p>
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fields = new FormData(form);
      const currentPassword = String(fields.get("currentPassword"));
      const newPassword = String(fields.get("newPassword"));
      void save.run(async () => {
        if (!validNewPassword(newPassword)) throw new Error(t.auth.passwordHint);
        if (newPassword !== fields.get("confirmation")) throw new Error(es ? "Las contraseñas no coinciden." : "As senhas não coincidem.");
        await apiRequest("/me/password", { method: "PATCH", body: { currentPassword, newPassword } });
        form.reset();
      });
    }}>
      <Field label={t.common.currentPassword}><input className={field} type="password" name="currentPassword" autoComplete="current-password" required /></Field>
      <Field label={t.common.newPassword}><input className={field} type="password" name="newPassword" aria-describedby="settings-password-hint" autoComplete="new-password" minLength={6} maxLength={15} required /></Field>
      <Field label={es ? "Confirmar nueva contraseña" : "Confirmar nova senha"}><input className={field} type="password" name="confirmation" autoComplete="new-password" minLength={6} maxLength={15} required /></Field>
      <Save state={save} />
    </form>
    <PasswordRecovery />
  </Card>;
}

const appearanceQueue = new Map<string, Promise<void>>();

function persistAppearance(companyId: string, appearance: OwnerAppearance) {
  const previous = appearanceQueue.get(companyId) ?? Promise.resolve();
  const task = previous.catch(() => undefined).then(async () => {
    await apiRequest("/companies/me/settings/appearance", { method: "PATCH", body: appearance });
  });
  appearanceQueue.set(companyId, task);
  void task.finally(() => {
    if (appearanceQueue.get(companyId) === task) appearanceQueue.delete(companyId);
  }).catch(() => undefined);
  return task;
}

function AppearancePanel() {
  const { t, locale, setLocale } = useLocale();
  const { mode, palette, setMode, setPalette } = useTheme();
  const es = locale === "es";
  const { session } = useSession();
  const appearanceRef = useRef<OwnerAppearance | null>(null);
  const sequence = useRef(0);
  const [status, setStatus] = useState<"saving" | "saved" | "error">();

  function update(patch: Partial<OwnerAppearance>) {
    const appearance = { ...(appearanceRef.current ?? { mode, locale, palette }), ...patch };
    appearanceRef.current = appearance;
    setMode(appearance.mode);
    setPalette(appearance.palette);
    setLocale(appearance.locale);
    applyDashboardTheme(appearance.mode, appearance.palette);
    setStatus("saving");
    const current = ++sequence.current;
    void persistAppearance(session.company.id, appearance).then(() => {
      if (current === sequence.current) setStatus("saved");
    }).catch(() => {
      if (current === sequence.current) setStatus("error");
    });
  }

  return <Card title={es ? "Tema y apariencia" : "Tema & Aparência"}>
    <div className="space-y-5">
      <Options label={es ? "Modo del sistema" : "Modo do sistema"} values={["light", "dark"] as const} value={mode} onChange={(mode) => update({ mode })}
        render={(value) => value === "light" ? "Claro" : es ? "Oscuro" : "Escuro"} />
      <Options label={t.common.languageLabel} values={["pt-BR", "es"] as const} value={locale} onChange={(locale) => update({ locale })}
        render={(value) => value === "pt-BR" ? "Português (PT-BR)" : "Español (ES)"} />
      <Options label={t.theme.paletteLabel} values={THEME_PALETTES.map((item) => item.id)} value={palette} onChange={(palette) => update({ palette })}
        render={(value) => {
          const option = THEME_PALETTES.find((item) => item.id === value);
          return <><span aria-hidden="true" className="size-4 shrink-0 rounded-full border border-border-strong" style={{ backgroundColor: mode === "dark" ? option?.swatchDark : option?.swatchLight }} />{t.theme.palettes[value]}</>;
        }} />
      <div aria-live="polite" className="text-sm text-ink-secondary">
        {status === "saving" && t.common.saving}
        {status === "saved" && (es ? "Cambios guardados." : "Alterações salvas.")}
        {status === "error" && <>
          <p>{es ? "Tema aplicado en este dispositivo. La sincronización falló." : "Tema aplicado neste dispositivo. A sincronização falhou."}</p>
          <Button type="button" variant="outline" className="mt-2 min-h-11" onClick={() => update({})}>{es ? "Reintentar" : "Tentar novamente"}</Button>
        </>}
      </div>
    </div>
  </Card>;
}
