"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { Building2, CalendarClock, Users, Star, Globe2, KeyRound, Palette, Copy, QrCode, Bell, CreditCard, Package, Link2 } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api-client";
import { companyWeekday } from "@/lib/agenda";
import { clientFieldOptions, countryDefaults, selectedClientFields, addressFields, agendaIntervals, bookingIntervals, formatCompanyAddress, leadTimes, type BrazilianAddress, type VenezuelanAddress, type CompanyAddress, type CompanyCountry, type CompanyDocuments, type CompanySettings, type OwnerAppearance, type ReminderSettings } from "@/lib/company-settings";
import { DEFAULT_CUSTOM_REMINDER_MESSAGES, REMINDER_VARIABLES, renderReminderMessage } from "@/lib/reminder-templates";
import { formatPhoneToE164, isValidInternationalPhone, stripNonDigits } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { applyDashboardTheme, THEME_PALETTES, useTheme } from "@/lib/theme-context";
import { IANA_TIMEZONES } from "@/lib/timezones";
import { saveCompanySettings, useCompanySettings } from "@/lib/use-company-settings";
import type { PhoneCountryCode } from "@/lib/types/public-booking";
import type { Currency } from "@/lib/types/finance";
import { useSession } from "@/components/ui/auth-guard";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { PasswordRecovery, validNewPassword } from "@/components/ui/password-recovery";
import { CompanyRating } from "@/components/ui/company-rating";
import { OnlinePaymentSettingsPanel } from "./online-payment-settings";
import { SatisfactionSettings } from "./satisfaction-settings";

const sectionGroups = [
  {
    pt: "Operação",
    es: "Operación",
    items: [
      ["company", "Empresa", "Empresa", Building2],
      ["agenda", "Horários e Intervalos", "Horarios e intervalos", CalendarClock],
      ["reminders", "Lembretes", "Recordatorios", Bell],
    ],
  },
  {
    pt: "Clientes e Reservas",
    es: "Clientes y Reservas",
    items: [
      ["clients", "Dados de Clientes & Anamnese", "Datos de clientes y anamnesis", Users],
      ["booking", "Link de Agendamento", "Enlace de reservas", Link2],
      ["survey", "Pesquisa de Satisfação", "Encuesta de satisfacción", Star],
    ],
  },
  {
    pt: "Finanças e Vendas",
    es: "Finanzas y Ventas",
    items: [
      ["payment", "Pagto. Online", "Pago en línea", CreditCard],
      ["packages", "Venda de Pacotes", "Venta de paquetes", Package],
    ],
  },
  {
    pt: "Conta e Aparência",
    es: "Cuenta y Apariencia",
    items: [
      ["region", "Fuso Horário & Moeda", "Zona horaria y moneda", Globe2],
      ["security", "Segurança & Senha", "Seguridad y contraseña", KeyRound],
      ["appearance", "Tema & Aparência", "Tema y apariencia", Palette],
    ],
  },
] as const;

type SettingsSectionId = (typeof sectionGroups)[number]["items"][number][0];

const ownerCountryCodes = ["+55", "+58", "+1", "+34", "+351"] as const;
const field = "min-h-11 w-full min-w-0 rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink";

export function SettingsPanel() {
  const [active, setActive] = useState<SettingsSectionId>("company");
  const { locale, t } = useLocale();
  const es = locale === "es";
  const { session } = useSession();
  const { settings } = useCompanySettings(session.company.id, undefined, true, true);

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <header className="lg:col-span-2">
        <h1 className="text-title-sm font-bold text-ink">{t.owner.settingsTitle}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-secondary">
          {session.company.companyName}<CompanyRating rating={settings.rating} />
        </div>
      </header>
      <nav aria-label={t.owner.settingsTitle} className="self-start rounded-2xl border border-border-subtle bg-surface p-2.5 lg:sticky lg:top-20 space-y-3">
        {sectionGroups.map((group) => (
          <div key={group.pt} className="space-y-1">
            <p className="px-3 pt-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {es ? group.es : group.pt}
            </p>
            <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
              {group.items.map(([id, pt, spanish, Icon]) => (
                <li key={id}>
                  <button type="button" aria-current={active === id ? "page" : undefined} aria-controls="settings-content"
                    onClick={() => setActive(id)}
                    className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink-secondary hover:bg-subtle aria-[current=page]:bg-accent-soft aria-[current=page]:text-ink">
                    <Icon className="size-4 shrink-0" aria-hidden="true" />{es ? spanish : pt}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div id="settings-content" className="min-w-0 space-y-4 [&_a]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_input:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer [&_textarea:not(:disabled)]:cursor-pointer">
        {active === "company" && <CompanyPanel settings={settings} />}
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
    <Button type="submit" className="min-h-11 cursor-pointer px-4" disabled={state.saving || disabled}>{state.saving ? t.common.saving : t.common.save}</Button>
    {state.saved && <span role="status" className="text-sm text-ink-secondary">{locale === "es" ? "Cambios guardados." : "Alterações salvas."}</span>}
    {state.error && <span role="alert" className="text-sm text-[var(--status-danger-ink)]">{state.error}</span>}
  </div>;
}

const venezuelanStates = [
  "Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Bolívar", "Carabobo", "Cojedes", "Delta Amacuro",
  "Dependencias Federales", "Distrito Capital", "Falcón", "Guárico", "La Guaira", "Lara", "Mérida", "Miranda",
  "Monagas", "Nueva Esparta", "Portuguesa", "Sucre", "Táchira", "Trujillo", "Yaracuy", "Zulia",
];
const venezuelaAddressFields = [
  ["city", "Ciudad / Municipio"], ["sector", "Urbanización / Sector"], ["addressLine", "Dirección"], ["referencePoint", "Punto de referencia"],
] as const;
const emptyBrazilianAddress: BrazilianAddress = { postalCode: "", street: "", number: "", district: "", city: "", state: "" };
const emptyVenezuelanAddress: VenezuelanAddress = { state: "", city: "", sector: "", addressLine: "", referencePoint: "" };

const subscribeBrowserCountry = () => () => undefined;
function detectBrowserCountry(): CompanyCountry | undefined {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  if (timezone === "America/Caracas" || languages.some((language) => /^es-VE$/i.test(language))) return "VE";
  if (languages.some((language) => /^pt(?:-|$)/i.test(language))
    || IANA_TIMEZONES.some((zone) => zone.value === timezone && zone.region === "BR")) return "BR";
  if (languages.some((language) => /^es(?:-|$)/i.test(language))) return "VE";
}

function maskBrazilianDocument(value: string, pattern: string) {
  const digits = stripNonDigits(value);
  let result = "";
  let index = 0;
  for (const character of pattern) {
    if (index === digits.length) break;
    result += character === "0" ? digits[index++] : character;
  }
  return result;
}

function CompanyPanel({ settings }: { settings: CompanySettings }) {
  const { session, refreshSession } = useSession();
  const { t, locale, setLocale } = useLocale();
  const es = locale === "es";
  const save = useSave();
  const detectedCountry = useSyncExternalStore(subscribeBrowserCountry, detectBrowserCountry, () => undefined);
  const savedCountry = settings.countryCodeConfigured ? settings.countryCode
    : detectedCountry ?? (session.company.timezone === "America/Caracas" ? "VE" : "BR");
  const [countryDraft, setCountryDraft] = useState<CompanyCountry>();
  const countryCode = countryDraft ?? savedCountry;
  const countryChanged = countryDraft !== undefined && countryDraft !== savedCountry;
  const [companyName, setCompanyName] = useState(session.company.companyName);
  const [ownerName, setOwnerName] = useState(session.name);
  const [avatarUrl, setAvatarUrl] = useState(session.company.avatarUrl ?? session.avatarUrl ?? null);
  const storedPhoneCountry = ownerCountryCodes.find((code) => session.phone.startsWith(code))
    ?? (/^58\d{10}$/.test(session.phone) ? "+58" : /^55\d{10,11}$/.test(session.phone) ? "+55" : undefined);
  const [phoneCountryDraft, setPhoneCountry] = useState<PhoneCountryCode>();
  const phoneCountry = phoneCountryDraft ?? storedPhoneCountry ?? countryDefaults[countryCode].ddi;
  const [phoneDraft, setPhone] = useState<string>();
  const phone = phoneDraft ?? stripNonDigits(session.phone).slice(storedPhoneCountry ? storedPhoneCountry.length - 1 : 0);
  const [documentDraft, setDocumentDraft] = useState<Partial<Record<CompanyCountry, CompanyDocuments>>>({});
  const storedDocumentsCountry = settings.documents?.countryCode ?? savedCountry;
  const documents = documentDraft[countryCode] ?? (countryCode === storedDocumentsCountry ? settings.documents ?? {} : {});
  const profileChanged = companyName !== session.company.companyName || ownerName !== session.name ||
    avatarUrl !== (session.company.avatarUrl ?? session.avatarUrl ?? null) ||
    phoneDraft !== undefined || phoneCountryDraft !== undefined;
  const [descriptionDraft, setDescriptionDraft] = useState<string>();

  function submitProfile(event: FormEvent) {
    event.preventDefault();
    void save.run(async () => {
      if (profileChanged && !isValidInternationalPhone(phoneCountry, phone)) throw new Error(t.errors.invalidPhone);
      const { timezone, currency, locale: nextLocale } = countryDefaults[countryCode];
      if (!settings.countryCodeConfigured || countryChanged || documentDraft[countryCode] || descriptionDraft !== undefined) {
        await saveCompanySettings(session.company.id, {
          countryCode,
          ...(countryChanged ? { region: { timezone, currency }, appearance: { locale: nextLocale } } : {}),
          ...(documentDraft[countryCode] ? { documents: { ...documents, countryCode } } : {}),
          ...(descriptionDraft !== undefined ? { description: descriptionDraft.trim() } : {}),
        });
        if (countryChanged) setLocale(nextLocale);
        setCountryDraft(undefined);
        setDocumentDraft({});
        setDescriptionDraft(undefined);
      }
      try {
        if (profileChanged) await apiRequest("/me/profile", { method: "PATCH", body: {
          companyName: companyName.trim(), name: ownerName.trim(), avatarUrl, phone: formatPhoneToE164(phoneCountry, phone),
        } });
      } finally {
        await refreshSession();
      }
    });
  }

  return <>
    <Card title={es ? "Información de la empresa" : "Informações da empresa"}>
      <form onSubmit={submitProfile} className="space-y-5">
        <div className="sm:max-w-xs">
          <Field label="País">
            <select className={field} value={countryCode} onChange={(event) => {
              const next = event.target.value as CompanyCountry;
              setCountryDraft(next);
              setPhoneCountry(next === savedCountry ? undefined : countryDefaults[next].ddi);
            }}><option value="BR">Brasil</option><option value="VE">Venezuela</option></select>
          </Field>
        </div>
        <AvatarPicker id="settings-logo" value={avatarUrl} onChange={setAvatarUrl} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.auth.companyNameLabel}><input className={field} required minLength={3} maxLength={100} value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></Field>
          <Field label={es ? "Nombre completo del responsable" : "Nome completo do responsável"}><input className={field} required minLength={2} maxLength={80} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} /></Field>
          <PhoneInput id="settings-owner-phone" label={es ? "WhatsApp del responsable" : "Celular / WhatsApp do responsável"} countries={ownerCountryCodes} countryCode={phoneCountry} value={phone} onCountryCodeChange={setPhoneCountry} onChange={setPhone} />
        </div>
        <fieldset className="space-y-3">
          <legend className="text-base font-bold text-ink">Documentos</legend>
          <p className="text-sm text-ink-secondary">{es ? "Opcionales. Se quedan aquí: el cliente no los ve." : "Opcionais. Ficam só aqui: o cliente não vê."}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["personalDoc", "businessDoc"] as const).map((key) => {
              const personal = key === "personalDoc";
              const brazil = countryCode === "BR";
              const label = brazil ? (personal ? "CPF (opcional)" : "CNPJ (opcional)")
                : (personal ? "Cédula de Identidad / C.I. (opcional)" : "RIF (opcional)");
              const placeholder = brazil ? (personal ? "000.000.000-00" : "00.000.000/0000-00")
                : (personal ? "V-12.345.678" : "J-12345678-9");
              const mask = (value: string) => brazil ? maskBrazilianDocument(value, placeholder) : value;
              return <Field key={key} label={label}>
                <input className={field} inputMode={brazil ? "numeric" : undefined} maxLength={brazil ? placeholder.length : 32}
                  value={mask(documents[key] ?? "")} placeholder={placeholder}
                  onChange={(event) => setDocumentDraft({ ...documentDraft, [countryCode]: { ...documents, [key]: mask(event.target.value) } })} />
              </Field>;
            })}
          </div>
        </fieldset>
        <Field label={es ? "Descripción de la barbería" : "Descrição da barbearia"}>
          <textarea aria-describedby="booking-description-help" className={field + " resize-y py-3"} rows={4} maxLength={1000}
            value={descriptionDraft ?? settings.description ?? ""} onChange={(event) => setDescriptionDraft(event.target.value)} />
        </Field>
        <p id="booking-description-help" className="-mt-3 text-sm text-ink-secondary">
          {es ? "Aparece en el enlace de reservas." : "Aparece no link de agendamento."}
        </p>
        <Save state={save} disabled={settings.countryCodeConfigured === undefined} />
      </form>
    </Card>
    <CompanyAddressCard key={countryCode} countryCode={countryCode} settings={settings} disabled={countryChanged || save.saving} />
  </>;
}

function CompanyAddressCard({ countryCode, settings, disabled }: {
  countryCode: CompanyCountry; settings: CompanySettings; disabled: boolean;
}) {
  const { session } = useSession();
  const { locale, t } = useLocale();
  const es = locale === "es";
  const addressSave = useSave();
  const [address, setAddress] = useState<CompanyAddress | null>(null);
  const [editingAddress, setEditingAddress] = useState(false);
  const [postalNotice, setPostalNotice] = useState("");
  const [postalLoading, setPostalLoading] = useState(false);
  const postalRequest = useRef<AbortController | null>(null);
  const numberField = useRef<HTMLInputElement>(null);

  useEffect(() => () => postalRequest.current?.abort(), []);

  async function lookUpPostalCode(value: string) {
    postalRequest.current?.abort();
    setPostalNotice("");
    const cep = value.replace(/\D/g, "").slice(0, 8);
    setAddress((current) => current && "postalCode" in current ? { ...current, postalCode: cep } : current);
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
      setAddress((current) => current && "postalCode" in current && current.postalCode === cep ? {
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
  const addressLabels = es ? ["Código postal", "Calle", "Número", "Barrio", "Ciudad", "Estado"] : ["CEP", "Rua", "Número", "Bairro", "Cidade", "Estado"];

  return <Card title={es ? "Dirección" : "Endereço"}>
    <p className="text-sm text-ink-secondary">{formatCompanyAddress(settings.address) || (es ? "Sin dirección registrada" : "Sem endereço cadastrado")}</p>
    {editingAddress && address ? <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      void addressSave.run(async () => {
        await saveCompanySettings(session.company.id, { address });
        setEditingAddress(false);
      });
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        {"postalCode" in address ? addressFields.map((key, index) => <Field key={key} label={addressLabels[index]}>
          <input className={field} value={address[key]} maxLength={key === "postalCode" ? 9 : 120} required={key === "street" || key === "city"}
            ref={key === "number" ? numberField : undefined} inputMode={key === "postalCode" ? "numeric" : undefined}
            onChange={(event) => key === "postalCode" ? void lookUpPostalCode(event.target.value) :
              setAddress({ ...address, [key]: event.target.value })} />
        </Field>) : <>
          <Field label="Estado"><select className={field} required value={address.state}
            onChange={(event) => setAddress({ ...address, state: event.target.value })}>
            <option value="">{es ? "Selecciona el estado" : "Selecione o estado"}</option>
            {address.state && !venezuelanStates.includes(address.state) && <option>{address.state}</option>}
            {venezuelanStates.map((state) => <option key={state}>{state}</option>)}
          </select></Field>
          {venezuelaAddressFields.map(([key, label]) => <Field key={key} label={label}>
            <input className={field} value={address[key]} maxLength={120} required={key === "city" || key === "addressLine"}
              onChange={(event) => setAddress({ ...address, [key]: event.target.value })} />
          </Field>)}
        </>}
      </div>
      {disabled && <p className="text-sm text-ink-secondary">{es ? "Guarda el país antes de guardar la dirección." : "Salve o país antes de salvar o endereço."}</p>}
      {postalNotice && <p role="status" className="text-sm text-ink-secondary">{postalNotice}</p>}
      <div className="flex flex-wrap gap-3"><Save state={addressSave} disabled={postalLoading || disabled} /><Button type="button" variant="outline" onClick={() => { postalRequest.current?.abort(); setPostalLoading(false); setPostalNotice(""); setEditingAddress(false); }}>{t.common.cancel}</Button></div>
    </form> : <Button variant="outline" onClick={() => {
      const saved = settings.address;
      setAddress(countryCode === "VE"
        ? saved && "addressLine" in saved ? saved : emptyVenezuelanAddress
        : saved && "postalCode" in saved ? saved : emptyBrazilianAddress);
      setEditingAddress(true);
    }}>{es ? "Editar dirección" : "Editar endereço"}</Button>}
  </Card>;
}

function SchedulePanel() {
  const { session, refreshSession } = useSession();
  const { locale, t } = useLocale();
  const es = locale === "es";
  const save = useSave();
  const [schedule, setSchedule] = useState(() => [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
    const { isOpen, hours } = companyWeekday(session.company, dayOfWeek);
    const shifts = hours?.shifts?.map(({ start, end }) => ({ start: start.slice(0, 5), end: end.slice(0, 5) }));
    return { dayOfWeek, isOpen, shifts: shifts?.length ? shifts : [{
      start: hours?.openTime?.slice(0, 5) || "08:00", end: hours?.closeTime?.slice(0, 5) || "19:00",
    }] };
  }));
  const firstOpenDay = schedule.find((day) => day.isOpen);

  function submitSchedule(event: FormEvent) {
    event.preventDefault();
    void save.run(async () => {
      if (schedule.some((day) => day.isOpen && day.shifts.some(({ start, end }, index) =>
        start >= end || (index > 0 && day.shifts[index - 1].end > start)))) {
        throw new Error(es ? "Revisa el orden de los turnos y evita horarios superpuestos." : "Confira a ordem dos turnos e evite horários sobrepostos.");
      }
      await apiRequest("/me/profile", { method: "PATCH", body: {
        operatingDays: schedule.filter((day) => day.isOpen).map((day) => day.dayOfWeek).sort().join(","),
        operatingSchedule: schedule.map(({ dayOfWeek, isOpen, shifts }) => ({
          dayOfWeek, isOpen,
          openTime: isOpen ? shifts[0].start : null,
          closeTime: isOpen ? shifts[shifts.length - 1].end : null,
          ...(isOpen && shifts.length > 1 ? { shifts } : {}),
        })),
      } });
      await refreshSession();
    });
  }

  return <Card title={es ? "Días y horarios de atención" : "Dias e horários de funcionamento"}>
    <form className="space-y-4" onSubmit={submitSchedule}>
      <div className="space-y-2">
        <Button type="button" variant="outline" className="min-h-10 cursor-pointer" disabled={!firstOpenDay}
          onClick={() => firstOpenDay && setSchedule((rows) => rows.map((day) => day.isOpen ? { ...day, shifts: firstOpenDay.shifts } : day))}>
          {es ? "Aplicar a todos los días abiertos" : "Aplicar para todos os dias ativos"}
        </Button>
        {schedule.map((day) => {
          const label = t.days[day.dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6];
          function update(patch: Partial<typeof day>) {
            setSchedule((current) => current.map((row) => row.dayOfWeek === day.dayOfWeek ? { ...row, ...patch } : row));
          }
          const [first] = day.shifts;
          const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
          const opening = toMinutes(first.start);
          const closing = toMinutes(first.end);
          const canSplit = !!first.start && !!first.end && closing - opening >= 3;
          function addBreak() {
            const length = closing - opening;
            const spansLunch = first.start < "12:00" && first.end > "13:00";
            const pause = spansLunch ? 60 : Math.min(60, Math.floor(length / 3));
            const breakStart = spansLunch ? 12 * 60 : opening + Math.floor((length - pause) / 2);
            const time = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
            update({ shifts: [{ start: first.start, end: time(breakStart) }, { start: time(breakStart + pause), end: first.end }] });
          }
          return <div key={day.dayOfWeek} className="grid items-start gap-2 rounded-xl border border-border-subtle p-2.5 min-[480px]:grid-cols-[8rem_minmax(0,1fr)]">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" role="switch" className="size-4 cursor-pointer accent-accent" checked={day.isOpen} onChange={(event) => update({ isOpen: event.target.checked })} />{label}
            </label>
            <div className="space-y-2">
              {day.shifts.map((shift, index) => <div key={index} className="flex flex-wrap items-center gap-2">
                {(["start", "end"] as const).map((edge) => <input key={edge} className={field.replace("w-full", "w-28") + " disabled:opacity-50"}
                  aria-label={`${label}, turno ${index + 1}, ${edge === "start" ? (es ? "inicio" : "início") : (es ? "fin" : "fim")}`}
                  type="time" step={60} required={day.isOpen} disabled={!day.isOpen} value={shift[edge]}
                  onChange={(event) => update({ shifts: day.shifts.map((part, partIndex) => partIndex === index ? { ...part, [edge]: event.target.value } : part) })} />)}
                {day.isOpen && index > 0 && <Button type="button" variant="ghost" className="min-h-10 cursor-pointer"
                  onClick={() => update({ shifts: day.shifts.flatMap((part, partIndex) => partIndex === index ? []
                    : [partIndex === index - 1 ? { ...part, end: shift.end } : part]) })}>
                  {es ? "Quitar pausa" : "Remover intervalo"}
                </Button>}
              </div>)}
              {day.isOpen && day.shifts.length === 1 && <Button type="button" variant="ghost" className="min-h-10 cursor-pointer" disabled={!canSplit} onClick={addBreak}>
                {es ? "+ Pausa" : "+ Intervalo"}
              </Button>}
            </div>
          </div>;
        })}
      </div>
      <Save state={save} />
    </form>
  </Card>;
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
  const { settings } = useCompanySettings(session.company.id, undefined, true, true);
  const { locale, t } = useLocale();
  const es = locale === "es";
  const save = useSave();
  const [draft, setDraft] = useState<Partial<Pick<CompanySettings,
    "agendaInterval" | "bookingInterval" | "leadTime" | "maxAdvanceBookingDays" | "allowClientCancel" |
    "cancelLeadTime" | "allowClientConfirm" | "allowClientReschedule" | "maxActiveBookingsPerClient" |
    "newBookingCancelsPrevious">>>({});
  const [linkStatus, setLinkStatus] = useState("");
  const [qr, setQr] = useState("");
  const path = `/book/${session.company.id}`;
  const url = typeof window === "undefined" ? path : new URL(path, window.location.origin).href;
  const minutes = (value: number) => `${value} min`;

  const values = { ...settings, ...draft };
  const selectClass = field + " cursor-pointer disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-50";
  const duration = (value: number) => value >= 60 && value % 60 === 0 ? `${value / 60} h` : minutes(value);
  const noRestriction = es ? "Sin restricción" : "Sem restrição";
  const cancelLeadTime = values.cancelLeadTime ?? values.leadTime;
  const cancelOptions = [...new Set([...leadTimes, cancelLeadTime])].sort((a, b) => a - b);

  function toggle(key: "allowClientCancel" | "allowClientConfirm" | "allowClientReschedule" | "newBookingCancelsPrevious", label: string) {
    return <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-medium text-ink">
      {label}
      <input type="checkbox" role="switch" className="size-4 shrink-0 cursor-pointer accent-accent"
        checked={values[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })} />
    </label>;
  }

  function limit(key: "maxAdvanceBookingDays" | "maxActiveBookingsPerClient", label: string, options: number[]) {
    const current = values[key];
    const choices = current === null || options.includes(current) ? options : [...options, current].sort((a, b) => a - b);
    return <Field label={label}>
      <select className={selectClass} value={current ?? ""} onChange={(event) => setDraft({ ...draft, [key]: event.target.value ? Number(event.target.value) : null })}>
        <option value="">{es ? "Sin límite" : "Sem limite"}</option>
        {choices.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </Field>;
  }

  return <><form className="space-y-4" onSubmit={(event) => {
    event.preventDefault();
    void save.run(async () => { await saveCompanySettings(session.company.id, draft); setDraft({}); });
  }}>
    {!publicLink && <Card title={es ? "Horarios e intervalos" : "Horários e Intervalos"}>
      <Options label={es ? "Intervalo de la cuadrícula interna" : "Intervalo da grade interna"} values={agendaIntervals} value={values.agendaInterval} render={minutes} onChange={(agendaInterval) => setDraft({ ...draft, agendaInterval })} />
      <Save state={save} disabled={!Object.keys(draft).length} />
    </Card>}
    {publicLink && <>
      <Card title={es ? "Horarios del enlace" : "Horários do link"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={es ? "Intervalo entre horarios" : "Intervalo entre horários"}>
            <select value={values.bookingInterval} className={selectClass} onChange={(event) => setDraft({ ...draft, bookingInterval: Number(event.target.value) as CompanySettings["bookingInterval"] })}>
              {bookingIntervals.map((value) => <option key={value} value={value}>{value ? minutes(value) : es ? "Seguir la agenda" : "Seguir a Agenda"}</option>)}
            </select>
          </Field>
          {limit("maxAdvanceBookingDays", es ? "Días de antelación máximos" : "Dias de antecedência máxima", [7, 14, 30, 60, 90, 180, 365])}
          <Field label={es ? "Anticipación mínima para reservar" : "Antecedência mínima para agendar"}>
            <select value={values.leadTime} className={selectClass} onChange={(event) => setDraft({ ...draft, leadTime: Number(event.target.value) as CompanySettings["leadTime"] })}>
              {leadTimes.map((value) => <option key={value} value={value}>{value ? duration(value) : noRestriction}</option>)}
            </select>
          </Field>
        </div>
      </Card>
      <Card title={es ? "Acciones del cliente" : "Ações do cliente"}>
        {toggle("allowClientCancel", es ? "Permitir cancelar la reserva" : "Permitir cancelar agendamento")}
        <div className="sm:max-w-sm">
          <Field label={es ? "Plazo para cancelar" : "Prazo para cancelar"}>
            <select value={cancelLeadTime} className={selectClass} disabled={!values.allowClientCancel}
              onChange={(event) => setDraft({ ...draft, cancelLeadTime: Number(event.target.value) })}>
              {cancelOptions.map((value) => <option key={value} value={value}>{value ? duration(value) : noRestriction}</option>)}
            </select>
          </Field>
        </div>
        {toggle("allowClientConfirm", es ? "Permitir confirmar la reserva" : "Permitir confirmar agendamento")}
        {toggle("allowClientReschedule", es ? "Permitir reprogramar la reserva" : "Permitir reagendar")}
      </Card>
      <Card title={es ? "Reglas de reserva" : "Regras de agendamento"}>
        <div className="sm:max-w-sm">{limit("maxActiveBookingsPerClient", es ? "Máximo de reservas activas por cliente" : "Máximo de agendamentos ativos por cliente", [1, 2, 3, 4, 5, 10])}</div>
        {toggle("newBookingCancelsPrevious", es ? "Una nueva reserva cancela la anterior" : "Novo agendamento cancela o anterior")}
      </Card>
      <Save state={save} disabled={!Object.keys(draft).length} />
    </>}
    {publicLink && <section aria-label={es ? "Enlace público y código QR" : "Link público e QR Code"} className="space-y-3">
      <Link href={path} target="_blank" rel="noopener noreferrer" className="block break-all text-sm text-accent underline">{url}</Link>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="cursor-pointer" variant="outline" onClick={async () => {
          try { await navigator.clipboard.writeText(url); setLinkStatus(t.common.copied); }
          catch { setLinkStatus(es ? "Selecciona y copia el enlace." : "Selecione e copie o link."); }
        }}><Copy className="size-4" />{es ? "Copiar enlace" : "Copiar link"}</Button>
        <Button type="button" className="cursor-pointer" variant="outline" onClick={async () => {
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
        <a className="text-sm font-semibold text-accent underline" download="atelier-agenda-agendamento.png" href={qr}>{es ? "Descargar PNG" : "Baixar PNG"}</a>
      </div>}
    </section>}
  </form>
  {!publicLink && <SchedulePanel />}
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
  const pinSave = useSave();
  const [hasPin, setHasPin] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void apiRequest<{ hasPin: boolean }>("/companies/me/security/pin")
      .then((res) => {
        if (active) setHasPin(Boolean(res?.hasPin));
      })
      .catch(() => {
        if (active) setHasPin(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return <div className="space-y-6">
    <Card title={t.collaborator.securityTitle}>
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
    </Card>

    {/* PIN numérico (4 a 6 dígitos) do Dono para reabertura controlada de comandas finalizadas */}
    <Card title={es ? "PIN de Autorización del Dueño" : "PIN de Autorização do Dono"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id="settings-pin-hint" className="text-sm text-ink-secondary">
          {es
            ? "Define un PIN numérico de 4 a 6 dígitos para autorizar la reapertura y edición de comandas cerradas/pagadas."
            : "Defina um PIN numérico de 4 a 6 dígitos para autorizar a reabertura e edição de comandas fechadas/pagas."}
        </p>
        {hasPin !== null && (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              hasPin
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}
          >
            {hasPin
              ? (es ? "PIN configurado" : "PIN configurado")
              : (es ? "PIN no configurado" : "PIN não configurado")}
          </span>
        )}
      </div>

      <form
        className="space-y-4"
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const fields = new FormData(form);
          const currentPassword = String(fields.get("pinCurrentPassword") ?? "");
          const pin = String(fields.get("ownerPin") ?? "").trim();
          const pinConfirmation = String(fields.get("ownerPinConfirmation") ?? "").trim();

          void pinSave.run(async () => {
            if (!/^\d{4,6}$/.test(pin)) {
              throw new Error(
                es
                  ? "El PIN debe contener entre 4 y 6 dígitos numéricos."
                  : "O PIN deve conter entre 4 e 6 dígitos numéricos.",
              );
            }
            if (pin !== pinConfirmation) {
              throw new Error(es ? "Los PIN no coinciden." : "Os PINs não coincidem.");
            }
            try {
              await apiRequest("/companies/me/security/pin", {
                method: "PATCH",
                body: { currentPassword, pin },
              });
              setHasPin(true);
              form.reset();
            } catch (err) {
              if (err instanceof ApiError && err.message === "INVALID_CURRENT_PASSWORD") {
                throw new Error(es ? "Contraseña actual incorrecta." : "Senha atual incorreta.");
              }
              throw err;
            }
          });
        }}
      >
        <Field label={t.common.currentPassword}>
          <input
            className={field}
            type="password"
            name="pinCurrentPassword"
            autoComplete="current-password"
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={hasPin ? (es ? "Nuevo PIN (4 a 6 dígitos)" : "Novo PIN (4 a 6 dígitos)") : (es ? "PIN del Dueño (4 a 6 dígitos)" : "PIN do Dono (4 a 6 dígitos)")}>
            <input
              className={field}
              type="password"
              name="ownerPin"
              inputMode="numeric"
              pattern="\d{4,6}"
              minLength={4}
              maxLength={6}
              autoComplete="off"
              aria-describedby="settings-pin-hint"
              required
            />
          </Field>
          <Field label={es ? "Confirmar PIN" : "Confirmar PIN"}>
            <input
              className={field}
              type="password"
              name="ownerPinConfirmation"
              inputMode="numeric"
              pattern="\d{4,6}"
              minLength={4}
              maxLength={6}
              autoComplete="off"
              required
            />
          </Field>
        </div>
        <Save state={pinSave} />
      </form>
    </Card>
  </div>;
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
