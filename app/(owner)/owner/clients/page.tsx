"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  DollarSign,
  Download,
  ExternalLink,
  FileUp,
  GitMerge,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatPriceFromCents, getTodayIsoDateInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { AgendaDialog } from "@/components/ui/agenda-controls";
import { Button } from "@/components/ui/button";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import { ClientDataFields } from "@/components/ui/client-data-fields";
import { clientFields, selectedClientFields } from "@/lib/company-settings";
import { useCompanySettings } from "@/lib/use-company-settings";
import { ApiError, apiRequest } from "@/lib/api-client";
import { dateValue, moneyCents, readCsv } from "@/lib/owner-spreadsheet";
import { paymentMethods, type PaymentMethod } from "@/lib/types/finance";
import {
  clientPhoneKey, clientWhatsAppUrl, getClientDuplicateGroups, rememberCompanyBookingPhone,
  useClients, type ClientInput, type ClientRecord,
} from "@/lib/use-clients";

const DAY_IN_MS = 86_400_000;
const clientFilters = [
  { value: "ALL", label: "Todos" },
  { value: "ACTIVE", label: "Ativos 30 dias" },
  { value: "DEBT", label: "Com débito" },
  { value: "BLOCKED", label: "Bloqueados" },
] as const;

const clientCsvHeaders = ["Nome", "Telefone", "CPF_CI", "Email", "Nascimento", "Sexo"];
const fieldClass = "h-10 w-full min-w-0 rounded-xl border border-border-subtle bg-canvas/40 px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent";
const actionClass = "grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-border-subtle bg-surface text-ink-secondary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40";
const emptyForm = { name: "", phone: "", email: "", birthDate: "", document: "", notes: "", source: "", gender: "" as NonNullable<ClientInput["gender"]>, isBlocked: false };

function downloadCsv(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function clientCsvGender(value: string): ClientInput["gender"] | undefined {
  const gender = normalizeSearchText(value);
  if (!gender) return "";
  if (["f", "feminino", "femenino", "female"].includes(gender)) return "FEMALE";
  if (["m", "masculino", "male"].includes(gender)) return "MALE";
  if (["o", "outro", "otro", "other"].includes(gender)) return "OTHER";
}

function previewClientCsv(text: string, existingPhones: Set<string>) {
  const [header, ...data] = readCsv(text).filter((row) => row.some((value) => value.trim()));
  const columns = header?.map(normalizeSearchText) ?? [];
  const [nameColumn, phoneColumn, documentColumn, emailColumn, birthColumn, genderColumn] =
    clientCsvHeaders.map((label) => columns.indexOf(normalizeSearchText(label)));
  if (nameColumn < 0 || phoneColumn < 0 || !data.length || new Set(columns).size !== columns.length) {
    throw new Error("Use o modelo CSV com as colunas Nome e Telefone e pelo menos uma linha de dados.");
  }
  const rows: ClientInput[] = [];
  const phones = new Set(existingPhones);
  let invalid = 0;
  let duplicates = 0;
  for (const row of data) {
    const [name, phone, document, email, birthText, genderText] =
      [nameColumn, phoneColumn, documentColumn, emailColumn, birthColumn, genderColumn].map((index) => row[index]?.trim() ?? "");
    const birthDate = birthText ? dateValue(birthText) : "";
    const gender = clientCsvGender(genderText);
    const key = clientPhoneKey(phone);
    if (!name || !key || !/^[+\d().\s-]+$/.test(phone) || key.length > 15 ||
        (email && !/^\S+@[^\s@]+\.\S+$/.test(email)) || birthDate === null || gender === undefined ||
        row.slice(columns.length).some((value) => value.trim())) {
      invalid++;
      continue;
    }
    if (phones.has(key)) {
      duplicates++;
      continue;
    }
    rows.push({ name, phone, document, email, birthDate, gender });
    phones.add(key);
  }
  return { rows, invalid, duplicates };
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}

function formatVisitAgo(visitAt: string, now: number, formatter: Intl.RelativeTimeFormat) {
  const elapsed = now - Date.parse(visitAt);
  const days = Math.floor(elapsed / DAY_IN_MS);
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 1) return formatter.resolvedOptions().locale === "es" ? "Hace un momento" : "Há pouco";
  const text = days >= 365 ? formatter.format(-Math.floor(days / 365), "year")
    : days >= 30 ? formatter.format(-Math.floor(days / 30), "month")
    : days >= 1 ? formatter.format(-days, "day")
    : formatter.format(-hours, "hour");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getClientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function ClientsPage() {
  const { session } = useSession();
  const { locale } = useLocale();
  const timezone = session.company.timezone;
  const currency = session.company.currency ?? "BRL";
  const companyId = session.company.id;
  const { settings } = useCompanySettings(companyId);
  const today = getTodayIsoDateInTimezone(timezone);
  const birthdayMonth = today.slice(5, 7);

  const { clients, loading, createClient, getRegistrationClientId, saveClientDetails, importClients, mergeClients, deleteClient, refresh } = useClients(companyId);
  const visitDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { timeZone: timezone, day: "2-digit", month: "2-digit", year: "numeric" }),
    [locale, timezone],
  );
  const visitAgoFormatter = useMemo(
    () => new Intl.RelativeTimeFormat(locale, { numeric: "always" }),
    [locale],
  );
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [filterType, setFilterType] = useState<(typeof clientFilters)[number]["value"] | "BIRTHDAYS">("ALL");
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [payingClient, setPayingClient] = useState<ClientRecord | null>(null);
  const [deletingClient, setDeletingClient] = useState<ClientRecord | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [profileDraft, setProfileDraft] = useState<Record<string, string>>({});
  const [savingClient, setSavingClient] = useState(false);
  const profileLoad = useRef<AbortController | null>(null);
  const duplicateGroups = useMemo(() => getClientDuplicateGroups(clients), [clients]);
  const duplicateCount = duplicateGroups.reduce((count, group) => count + group.length - 1, 0);
  const existingPhones = useMemo(() => new Set(clients.flatMap((client) => [
    clientPhoneKey(client.phone), ...client.appointments.map((appointment) => clientPhoneKey(appointment.clientPhone)),
  ])), [clients]);

  useEffect(() => {
    rememberCompanyBookingPhone(companyId, session.phone);
  }, [companyId, session.phone]);

  const searchParams = useSearchParams();
  const actionParam = searchParams.get("action");

  useEffect(() => {
    if (actionParam === "new-client") {
      setNewClientModalOpen(true);
      window.history.replaceState(null, "", "/owner/clients");
    }
  }, [actionParam]);

  const now = Date.now();
  const activeSince = now - 30 * DAY_IN_MS;
  const activeClientIds = useMemo(() => new Set(
    clients.filter(({ lastVisitAt }) => lastVisitAt && Date.parse(lastVisitAt) >= activeSince)
      .map(({ id }) => id),
  ), [clients, activeSince]);

  const birthdayClients = useMemo(() => new Set(clients.filter((client) =>
    client.birthDate?.split("-").at(-2) === birthdayMonth).map((client) => client.id)), [birthdayMonth, clients]);

  // Filtra clientes por texto e categoria
  const filteredClients = useMemo(() => {
    const query = normalizeSearchText(search);
    const phoneQuery = /^[\d+()\s.-]+$/.test(query) ? query.replace(/\D/g, "") : "";

    return clients.filter((client) => {
      if (query) {
        const matchesName = normalizeSearchText(client.name).includes(query);
        const matchesPhone = phoneQuery.length > 0 && client.phone.replace(/\D/g, "").includes(phoneQuery);
        if (!matchesName && !matchesPhone) return false;
      }

      if (filterType === "DEBT") return client.pendingDebtCents > 0;
      if (filterType === "BLOCKED") return client.isBlocked;
      if (filterType === "ACTIVE") return activeClientIds.has(client.id);
      if (settings.birthdayRadar && filterType === "BIRTHDAYS") return birthdayClients.has(client.id);

      return true;
    });
  }, [clients, search, filterType, activeClientIds, settings.birthdayRadar, birthdayClients]);

  // KPIs da carteira de clientes
  const kpis = useMemo(() => {
    const totalClients = clients.length;
    let totalDebtCents = 0;

    for (const c of clients) {
      totalDebtCents += c.pendingDebtCents;
    }

    return { totalClients, totalDebtCents };
  }, [clients]);

  // Exportação CSV
  const handleExportCsv = () => {
    if (filteredClients.length === 0) {
      toast.warning("Nenhum cliente para exportar.");
      return;
    }

    const headers = [
      "Nome",
      "Telefone",
      "Email",
      "Documento (CPF / C.I.)",
      "Total de Visitas",
      "Faltas",
      "Total Gasto (R$)",
      "Saldo Devedor (R$)",
      "Status",
    ];

    const rows = filteredClients.map((c) => {
      return [
        `"${c.name.replace(/"/g, '""')}"`,
        `"${c.phone}"`,
        `"${c.email || ""}"`,
        `"${c.document || ""}"`,
        c.totalVisits,
        c.noShows,
        (c.totalSpentCents / 100).toFixed(2),
        (c.pendingDebtCents / 100).toFixed(2),
        c.isBlocked ? "Bloqueado" : "Ativo",
      ].join(",");
    });

    downloadCsv(`clientes_${getTodayIsoDateInTimezone(timezone)}.csv`, [headers.join(","), ...rows].join("\r\n"));
    toast.success("Lista de clientes exportada com sucesso!");
  };

  function openClientForm(client?: ClientRecord) {
    profileLoad.current?.abort();
    setProfileDraft(client?.profileFields ?? {});
    setEditingClient(client ?? null);
    setFormData(client ? {
      name: client.name, phone: client.phone, document: client.document ?? "", email: client.email ?? "",
      birthDate: client.birthDate ?? "", gender: client.gender ?? "", source: client.source ?? "", notes: client.notes ?? "", isBlocked: client.isBlocked,
    } : emptyForm);
    setNewClientModalOpen(true);
    if (client) {
      const request = new AbortController();
      profileLoad.current = request;
      void apiRequest<{ values: Record<string, string> }>(`/companies/me/client-profiles/${encodeURIComponent(client.id)}`, { signal: request.signal })
        .then(({ values }) => {
          if (request.signal.aborted) return;
          setProfileDraft((current) => ({ ...current, ...values }));
          setFormData((current) => ({
            ...current, email: values.email ?? current.email, document: values.document ?? current.document,
            birthDate: values.birthDate ?? current.birthDate,
          }));
        }).catch(() => undefined);
    }
  }

  function closeClientForm() {
    profileLoad.current?.abort();
    setProfileDraft({});
    setNewClientModalOpen(false);
    setEditingClient(null);
    setFormData(emptyForm);
  }

  async function handleClientSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (savingClient) return;
    const data = { ...formData, name: formData.name.trim(), phone: formData.phone.trim(),
      document: formData.document.trim(), email: formData.email.trim(), notes: formData.notes.trim() };
    const selected = selectedClientFields(settings);
    const values = { ...profileDraft, email: data.email, document: data.document, birthDate: data.birthDate };
    const profileValues = Object.fromEntries(selected.map(({ id }) => [id, (values as Record<string, string>)[id]?.trim() ?? ""]));
    if (selected.some(({ id, required }) => required && !profileValues[id])) {
      toast.error(locale === "es" ? "Completa los datos obligatorios." : "Preencha os dados obrigatórios.");
      return;
    }
    for (const field of clientFields) {
      if (!Object.hasOwn(profileValues, field)) delete (data as Partial<typeof data>)[field];
    }
    delete (data as Partial<typeof data>).notes;
    if (!data.name) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    const phone = clientPhoneKey(data.phone);
    if (!phone || !/^[+\d().\s-]+$/.test(data.phone) || phone.length > 15) {
      toast.error("Informe um telefone válido.");
      return;
    }
    if (phone !== clientPhoneKey(editingClient?.phone) && clients.some((client) => client.id !== editingClient?.id && (
      clientPhoneKey(client.phone) === phone || client.appointments.some((appointment) => clientPhoneKey(appointment.clientPhone) === phone)
    ))) {
      toast.error("Já existe um cliente com esse telefone.");
      return;
    }
    setSavingClient(true);
    try {
      const id = editingClient?.id ?? getRegistrationClientId(data);
      if (selected.length) {
        await apiRequest(`/companies/me/client-profiles/${encodeURIComponent(id)}`, { method: "PATCH", body: { values: profileValues } });
      }
      if (editingClient) saveClientDetails(id, data);
      else createClient(data);
      toast.success(editingClient ? "Cliente atualizado." : "Cliente cadastrado com sucesso!");
      closeClientForm();
    } catch {
      toast.error("Não foi possível salvar o cliente.");
    } finally {
      setSavingClient(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Users className="size-6 text-accent" />
            Base de Clientes
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Gestão completa da carteira de clientes, histórico de visitas e controle de inadimplência.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="lg" variant="outline" onClick={() => setImportOpen(true)} className="rounded-xl border-border-subtle bg-surface text-xs font-semibold text-ink hover:border-accent">
            <FileUp aria-hidden="true" size={14} /> Importar planilha
          </Button>

          <Button type="button" size="lg" variant="outline" onClick={() => setMergeOpen(true)} disabled={loading || duplicateCount === 0} className="rounded-xl border-border-subtle bg-surface text-xs font-semibold text-ink hover:border-accent">
            <GitMerge aria-hidden="true" size={14} /> Mesclar duplicados
            {duplicateCount > 0 && <span className="rounded-full bg-accent/15 px-1.5 text-accent tabular-nums">{numberFormatter.format(duplicateCount)}</span>}
          </Button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || filteredClients.length === 0}
            className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl border border-border-subtle bg-surface px-3.5 text-xs font-semibold text-ink hover:border-accent transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <Download size={14} />
            Salvar em CSV
          </button>

          <button
            type="button"
            onClick={() => openClientForm()}
            className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl bg-accent px-3.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors cursor-pointer shadow-xs"
          >
            <Plus size={14} />
            Novo Cliente
          </button>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="grid size-9 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink disabled:opacity-50 transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* 3 KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex min-h-24 flex-col justify-between gap-2 rounded-2xl border border-border-subtle bg-surface px-4 py-3 shadow-xs">
          <span className="text-xs font-semibold text-ink-muted">
            Total de clientes
          </span>
          <div className="text-2xl font-bold tabular-nums text-ink">{kpis.totalClients}</div>
        </div>

        <div className="flex min-h-24 flex-col justify-between gap-2 rounded-2xl border border-border-subtle bg-surface px-4 py-3 shadow-xs">
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Clientes ativos nos últimos 30 dias
          </span>
          <div className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {activeClientIds.size}
          </div>
        </div>

        <div className="flex min-h-24 flex-col justify-between gap-2 rounded-2xl border border-border-subtle bg-surface px-4 py-3 shadow-xs">
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
            Total em débitos (fiado)
          </span>
          <div className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
            <SensitiveValue>
              {formatPriceFromCents(kpis.totalDebtCents, locale, currency)}
            </SensitiveValue>
          </div>
        </div>
      </div>

      <section aria-label="Lista de clientes" className="@container overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-xs">
        <div className="grid grid-cols-1 items-center gap-2.5 border-b border-border-subtle px-3 py-3 @lg:grid-cols-[minmax(0,1fr)_auto] @3xl:grid-cols-[minmax(12rem,1fr)_auto_minmax(5rem,1fr)] @3xl:gap-4 @3xl:px-4">
          <div className="relative min-w-0 @lg:col-span-2 @lg:max-w-xs @3xl:col-span-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              ref={searchInputRef}
              type="search"
              autoComplete="off"
              aria-label={locale === "es" ? "Buscar por nombre o teléfono" : "Buscar por nome ou telefone"}
              placeholder={locale === "es" ? "Buscar por nombre o teléfono..." : "Buscar por nome ou telefone..."}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 w-full rounded-xl border border-border-subtle bg-canvas/40 pr-9 pl-9 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 [&::-webkit-search-cancel-button]:hidden"
            />
            {search && (
              <button
                type="button"
                aria-label={locale === "es" ? "Limpiar búsqueda" : "Limpar busca"}
                onClick={() => {
                  setSearch("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>

          <div role="group" aria-label="Filtrar clientes" className="w-fit min-w-0 max-w-full overflow-x-auto rounded-xl border border-border-subtle bg-subtle p-0.5">
            <div className="flex w-max gap-0.5">
              {[...clientFilters, ...(settings.birthdayRadar ? [{ value: "BIRTHDAYS" as const, label: locale === "es" ? "Cumpleaños del mes" : "Aniversariantes do mês" }] : [])].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={(filterType === "BIRTHDAYS" && !settings.birthdayRadar ? "ALL" : filterType) === value}
                  onClick={() => setFilterType(value)}
                  className="min-h-9 cursor-pointer whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold leading-tight text-ink-secondary transition-colors hover:bg-surface hover:text-ink focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent aria-pressed:bg-accent aria-pressed:text-accent-ink aria-pressed:shadow-xs"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <span role="status" className="justify-self-end whitespace-nowrap text-xs text-ink-muted">
            {!loading && `${numberFormatter.format(filteredClients.length)} ${filteredClients.length === 1 ? "cliente" : "clientes"}`}
          </span>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="mt-3 text-xs text-ink-muted">Consolidando carteira de clientes...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-muted">
            {locale === "es" ? "No se encontraron clientes" : "Nenhum cliente encontrado"}
          </div>
        ) : (
          <div role="region" aria-label="Tabela de clientes" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
            <table className="w-full min-w-[60rem] table-fixed text-left text-xs">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[15%]" />
                <col className="w-[14%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[25%]" />
              </colgroup>
              <thead className="border-b border-border-subtle bg-subtle text-ink-secondary">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Cliente</th>
                  <th scope="col" className="px-2 py-2.5 font-semibold">Última visita</th>
                  <th scope="col" className="px-2 py-2.5 font-semibold">Visitas / Faltas</th>
                  <th scope="col" className="px-2 py-2.5 text-right font-semibold">Total gasto</th>
                  <th scope="col" className="px-2 py-2.5 text-right font-semibold">Saldo devedor</th>
                  <th scope="col" className="py-2.5 pr-3 pl-1 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filteredClients.map((client) => {
                  const waLink = clientWhatsAppUrl(client.phone, timezone === "America/Caracas" ? "+58" : "+55");
                  const birthday = settings.birthdayRadar && birthdayClients.has(client.id);
                  const birthdayMessage = locale === "es" ? `¡Feliz cumpleaños, ${client.name}!` : `Feliz aniversário, ${client.name}!`;
                  const profileUrl = `/owner/clients/${client.id}`;

                  return (
                    <tr key={client.id} className="hover:bg-canvas/30 transition-colors">
                      <th scope="row" className="px-4 py-2.5 font-normal">
                        <div className="flex items-center gap-2.5">
                          <span className="grid size-8 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent shrink-0">
                            {getClientInitials(client.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={profileUrl}
                                title={client.name}
                                className="truncate text-sm font-semibold leading-5 text-ink hover:text-accent hover:underline"
                              >
                                {client.name}
                              </Link>
                              {birthday && <span title={locale === "es" ? "Cumpleaños del mes" : "Aniversariante do mês"} className="shrink-0" aria-label={locale === "es" ? "Cumpleaños del mes" : "Aniversariante do mês"}>🎂</span>}
                              {client.isBlocked && (
                                <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-rose-500/20 bg-rose-500/10 px-1 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                                  <ShieldAlert aria-hidden="true" size={10} />
                                  Bloqueado
                                </span>
                              )}
                            </div>
                            <p className="truncate text-[11px] leading-4 tabular-nums text-ink-muted">{client.phone}</p>
                          </div>
                        </div>
                      </th>

                      <td className="px-2 py-2.5 whitespace-nowrap">
                        {client.lastVisitAt ? (
                          <>
                            <time dateTime={client.lastVisitAt} className="block font-semibold leading-5 tabular-nums text-ink">
                              {visitDateFormatter.format(Date.parse(client.lastVisitAt))}
                            </time>
                            <span className="block text-[11px] leading-4 text-ink-muted">
                              {formatVisitAgo(client.lastVisitAt, now, visitAgoFormatter)}
                            </span>
                          </>
                        ) : <span className="text-[11px] text-ink-muted">Sem histórico</span>}
                      </td>

                      <td className="px-2 py-2.5">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums">
                          <span className="whitespace-nowrap text-ink-secondary">
                            {numberFormatter.format(client.totalVisits)} {client.totalVisits === 1 ? "visita" : "visitas"}
                          </span>
                          {client.noShows > 0 && (
                            <span className="inline-flex rounded-full border border-red-200 bg-red-500/10 px-1.5 text-[11px] font-medium whitespace-nowrap text-red-600 dark:border-red-500/30 dark:text-red-400">
                              {numberFormatter.format(client.noShows)} {client.noShows === 1 ? "falta" : "faltas"}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-2 py-2.5 text-right font-medium tabular-nums text-ink wrap-anywhere">
                        <SensitiveValue>
                          {formatPriceFromCents(client.totalSpentCents, locale, currency)}
                        </SensitiveValue>
                      </td>

                      <td className="px-2 py-2.5 text-right tabular-nums wrap-anywhere">
                        {client.pendingDebtCents > 0 ? (
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            <SensitiveValue>
                              {formatPriceFromCents(client.pendingDebtCents, locale, currency)}
                            </SensitiveValue>
                          </span>
                        ) : (
                          <span className="text-ink-muted">{formatPriceFromCents(0, locale, currency)}</span>
                        )}
                      </td>

                      <td className="py-2.5 pr-3 pl-1">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="grid size-8 shrink-0 place-items-center rounded-lg border border-border-subtle bg-surface text-emerald-600 transition-colors hover:border-emerald-500 focus-visible:outline-2 focus-visible:outline-accent dark:text-emerald-400"
                              aria-label={`Conversar com ${client.name} no WhatsApp`}
                              title="Conversar no WhatsApp"
                            >
                              <MessageCircle aria-hidden="true" size={14} />
                            </a>
                          )}
                          {waLink && birthday && (
                            <a className={actionClass} href={`${waLink}?text=${encodeURIComponent(birthdayMessage)}`}
                              target="_blank" rel="noopener noreferrer" title={locale === "es" ? "Felicitar por WhatsApp" : "Felicitar pelo WhatsApp"}
                              aria-label={birthdayMessage}><span aria-hidden="true">🎂</span></a>
                          )}
                          <button type="button" className={actionClass} title="Registrar pagamento" aria-label={"Registrar pagamento de " + client.name}
                            onClick={() => setPayingClient(client)} disabled={client.pendingDebtCents <= 0}>
                            <DollarSign aria-hidden="true" size={15} />
                          </button>
                          <button type="button" className={actionClass} title="Editar" aria-label={"Editar " + client.name}
                            onClick={() => openClientForm(client)}>
                            <Pencil aria-hidden="true" size={14} />
                          </button>
                          <button type="button" className={actionClass + " hover:border-rose-500 hover:text-rose-500"} title="Excluir" aria-label={"Excluir " + client.name}
                            onClick={() => setDeletingClient(client)}>
                            <Trash2 aria-hidden="true" size={14} />
                          </button>
                          <Link
                            href={profileUrl}
                            aria-label={`Abrir ficha de ${client.name}`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-subtle bg-surface px-2 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
                          >
                            Ficha
                            <ExternalLink aria-hidden="true" size={11} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {newClientModalOpen && (
        <AgendaDialog title={editingClient ? "Editar cliente" : "Cadastrar novo cliente"} onClose={closeClientForm}>
          <form onSubmit={handleClientSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold text-ink-secondary">
                <span>Nome completo</span>
                <input autoComplete="name" required maxLength={120} className={fieldClass}
                  value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} />
              </label>
              <label className="space-y-1 text-xs font-semibold text-ink-secondary">
                <span>Telefone / WhatsApp</span>
                <input autoComplete="tel" type="tel" required className={fieldClass}
                  value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} />
              </label>
              <ClientDataFields settings={settings} values={{ ...profileDraft, email: formData.email, document: formData.document, birthDate: formData.birthDate }}
                today={today} fieldClass={fieldClass} onChange={({ email, document, birthDate, ...values }) => {
                  setFormData((current) => ({ ...current, email, document, birthDate }));
                  setProfileDraft(values);
                }} />
            </div>
            {editingClient && (
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                <input type="checkbox" className="size-4 accent-accent" checked={formData.isBlocked}
                  onChange={(event) => setFormData({ ...formData, isBlocked: event.target.checked })} />
                Bloqueado para agendamentos
              </label>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-4">
              <Button type="button" variant="outline" onClick={closeClientForm}>Cancelar</Button>
              <Button type="submit" disabled={savingClient}>Salvar cliente</Button>
            </div>
          </form>
        </AgendaDialog>
      )}

      {importOpen && (
        <ClientImportDialog existingPhones={existingPhones} loading={loading} onClose={() => setImportOpen(false)} onImport={(rows) => {
          const count = importClients(rows);
          if (count) toast.success(count === 1 ? "1 cliente importado." : `${count} clientes importados.`);
          else toast.info("Nenhum cliente novo para importar.");
          setImportOpen(false);
        }} />
      )}

      {mergeOpen && (
        <AgendaDialog title="Mesclar duplicados" onClose={() => setMergeOpen(false)}>
          {duplicateGroups.length ? (
            <div className="space-y-4">
              <p className="text-sm text-ink-secondary">Confira cada grupo. O cadastro mais antigo reúne o histórico, as visitas e os saldos dos demais.</p>
              {duplicateGroups.map((group) => (
                <div key={group[0].id} className="space-y-3 rounded-xl border border-border-subtle p-3">
                  <ul className="divide-y divide-border-subtle">
                    {group.map((client, index) => (
                      <li key={client.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-xs">
                        <span className="font-semibold text-ink">{client.name}{index === 0 && <span className="ml-2 font-medium text-accent">Cadastro principal</span>}</span>
                        <span className="text-ink-secondary">{client.phone || "Sem telefone"}</span>
                      </li>
                    ))}
                  </ul>
                  <Button type="button" onClick={() => {
                    try {
                      mergeClients(group);
                      toast.success("Cadastros mesclados.");
                    } catch {
                      toast.error("Não foi possível mesclar este grupo. Atualize a lista e tente novamente.");
                    }
                  }}>Mesclar este grupo</Button>
                </div>
              ))}
            </div>
          ) : <p role="status" className="text-sm text-ink-secondary">Nenhum cadastro duplicado.</p>}
        </AgendaDialog>
      )}

      {payingClient && (
        <ClientPaymentDialog client={clients.find((client) => client.id === payingClient.id) ?? payingClient} timezone={timezone}
          currency={currency} onClose={() => setPayingClient(null)} onChanged={() => refresh(false)} />
      )}

      {deletingClient && (
        <AgendaDialog title="Excluir cliente?" onClose={() => setDeletingClient(null)}>
          <p className="text-sm text-ink-secondary">
            <strong className="text-ink">{deletingClient.name}</strong> será removido da base de clientes.
            Os agendamentos e recebimentos vinculados serão preservados.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeletingClient(null)}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={() => {
              try {
                deleteClient(deletingClient);
                setDeletingClient(null);
                toast.success("Cliente excluído.");
              } catch {
                toast.error("Não foi possível excluir o cliente.");
              }
            }}>Excluir cliente</Button>
          </div>
        </AgendaDialog>
      )}
    </div>
  );
}

function ClientImportDialog({ existingPhones, loading, onClose, onImport }: {
  existingPhones: Set<string>;
  loading: boolean;
  onClose: () => void;
  onImport: (rows: ClientInput[]) => void;
}) {
  const fileVersion = useRef(0);
  const [csv, setCsv] = useState("");
  const [fileError, setFileError] = useState("");
  const [reading, setReading] = useState(false);
  const { preview, previewError } = useMemo(() => {
    if (!csv) return { preview: null, previewError: "" };
    try {
      return { preview: previewClientCsv(csv, existingPhones), previewError: "" };
    } catch (error) {
      const message = error instanceof Error && error.message !== "csv" ? error.message : "Não foi possível ler o CSV.";
      return { preview: null, previewError: message };
    }
  }, [csv, existingPhones]);

  async function readFile(file?: File) {
    const version = ++fileVersion.current;
    setCsv("");
    setFileError("");
    setReading(false);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") || file.size > 5 * 1024 * 1024 || !file.size) {
      setFileError("Selecione um arquivo CSV de até 5 MB com os dados dos clientes.");
      return;
    }
    setReading(true);
    try {
      const content = await file.text();
      if (version === fileVersion.current) setCsv(content);
    } catch {
      if (version === fileVersion.current) setFileError("Não foi possível abrir o arquivo.");
    } finally {
      if (version === fileVersion.current) setReading(false);
    }
  }

  return (
    <AgendaDialog title="Importar planilha" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-secondary">Preencha o modelo com nome e telefone. Os demais campos são opcionais.</p>
          <Button variant="outline" type="button" onClick={() => downloadCsv("modelo_clientes.csv", clientCsvHeaders.join(",") + "\r\n")}>
            <Download size={15} aria-hidden="true" /> Baixar modelo CSV
          </Button>
        </div>
        <label className="block space-y-1 text-xs font-semibold text-ink-secondary">
          <span>Arquivo CSV</span>
          <input type="file" accept=".csv,text/csv" className="block w-full min-w-0 rounded-xl border border-border-subtle p-2 text-ink file:mr-2 file:rounded-md file:border-0 file:bg-subtle file:px-2 file:py-1 file:text-ink"
            onChange={(event) => void readFile(event.target.files?.[0])} />
        </label>
        {(fileError || previewError) && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{fileError || previewError}</p>}
        {reading && <p role="status" className="text-sm text-ink-muted">Lendo arquivo…</p>}
        {preview && (
          <>
            <p role="status" className="text-xs text-ink-secondary">
              Válidas: {preview.rows.length} · Telefones duplicados: {preview.duplicates} · Inválidas: {preview.invalid}
            </p>
            {preview.rows.length > 0 && (
              <div className="max-h-60 overflow-auto rounded-xl border border-border-subtle" role="region" aria-label="Prévia dos clientes" tabIndex={0}>
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-subtle text-ink-secondary">
                    <tr>{clientCsvHeaders.map((label) => <th scope="col" key={label} className="whitespace-nowrap px-3 py-2">{label}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {preview.rows.map((row) => (
                      <tr key={row.phone}>
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="whitespace-nowrap px-3 py-2">{row.phone}</td>
                        <td className="whitespace-nowrap px-3 py-2">{row.document}</td>
                        <td className="px-3 py-2">{row.email}</td>
                        <td className="whitespace-nowrap px-3 py-2">{row.birthDate}</td>
                        <td className="px-3 py-2">{row.gender === "FEMALE" ? "Feminino" : row.gender === "MALE" ? "Masculino" : row.gender === "OTHER" ? "Outro" : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={loading || reading || !preview?.rows.length} onClick={() => {
            if (!preview?.rows.length) return;
            try {
              onImport(preview.rows);
            } catch {
              setFileError("Não foi possível salvar a importação. Tente novamente.");
            }
          }}>Importar {preview?.rows.length || ""} clientes</Button>
        </div>
      </div>
    </AgendaDialog>
  );
}

type ReceiptPlan = {
  method: PaymentMethod;
  date: string;
  applied: number;
  pending: { appointmentId: string; amountInCents: number; requestKey: string }[];
};

function ClientPaymentDialog({ client, timezone, currency, onClose, onChanged }: {
  client: ClientRecord;
  timezone: string;
  currency: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { locale, t } = useLocale();
  const available = client.collectiblePayments.reduce((total, item) => total + item.openInCents, 0);
  const [amount, setAmount] = useState(() => available ? (available / 100).toFixed(2).replace(".", ",") : "");
  const [method, setMethod] = useState<PaymentMethod>("PIX");
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const plan = useRef<ReceiptPlan | null>(null);
  const money = (cents: number) => formatPriceFromCents(cents, locale, currency);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!plan.current) {
      let remaining = moneyCents(amount) ?? 0;
      if (remaining < 1 || remaining > available) {
        setError("Informe um valor dentro do saldo disponível para receber.");
        return;
      }
      const pending: ReceiptPlan["pending"] = [];
      for (const appointment of [...client.appointments].reverse()) {
        const payment = client.collectiblePayments.find(({ appointmentId }) => appointmentId === appointment.id);
        if (!payment) continue;
        const amountInCents = Math.min(payment.openInCents, remaining);
        pending.push({ appointmentId: appointment.id, amountInCents, requestKey: crypto.randomUUID() });
        remaining -= amountInCents;
        if (!remaining) break;
      }
      if (remaining) return;
      plan.current = { method, date: getTodayIsoDateInTimezone(timezone), applied: 0, pending };
    }

    const current = plan.current;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      for (const item of [...current.pending]) {
        await apiRequest("/finance/receipts", {
          method: "POST",
          body: {
            appointmentId: item.appointmentId, effectiveOn: current.date, requestKey: item.requestKey,
            payments: [{ method: current.method, amountInCents: item.amountInCents }],
          },
        });
        current.applied += item.amountInCents;
        current.pending.shift();
      }
      await onChanged();
      toast.success(`Pagamento de ${money(current.applied)} registrado.`);
      onClose();
    } catch (failure) {
      const code = failure instanceof ApiError ? failure.message : "";
      const rejected = failure instanceof ApiError && failure.status >= 400 && failure.status < 500 &&
        failure.status !== 408 && failure.status !== 429;
      if (rejected) {
        plan.current = null;
        const remaining = current.pending.reduce((sum, item) => sum + item.amountInCents, 0);
        setAmount((remaining / 100).toFixed(2).replace(".", ","));
      }
      setRetrying(!rejected);
      await onChanged();
      const detail = code.startsWith("FINANCE_") && Object.hasOwn(t.finance, code)
        ? String(t.finance[code as keyof typeof t.finance])
        : rejected ? "Não foi possível registrar o pagamento." : "Não foi possível confirmar o restante. Tente novamente para verificar o mesmo pagamento.";
      setError(current.applied ? `${money(current.applied)} já registrado. ${detail}` : detail);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <AgendaDialog title="Registrar pagamento" onClose={onClose} closeDisabled={busy}>
      <form className="space-y-4" onSubmit={submit}>
        <div className="rounded-xl border border-border-subtle bg-subtle p-3 text-sm">
          <p className="font-semibold text-ink">{client.name}</p>
          <p className="mt-1 text-ink-secondary">Saldo devedor <SensitiveValue>{money(client.pendingDebtCents)}</SensitiveValue></p>
          {available !== client.pendingDebtCents && (
            <p className="mt-1 text-xs text-ink-secondary">Disponível para receber <SensitiveValue>{money(available)}</SensitiveValue></p>
          )}
        </div>
        {!available && !retrying && <p className="text-sm text-ink-secondary">Nenhum agendamento com saldo disponível para receber no momento.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold text-ink-secondary">
            <span>Valor do pagamento</span>
            <input required inputMode="decimal" className={fieldClass} value={amount} disabled={busy || retrying || !available}
              onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="space-y-1 text-xs font-semibold text-ink-secondary">
            <span>Meio de pagamento</span>
            <select className={fieldClass} value={method} disabled={busy || retrying || !available}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
              {paymentMethods.map((value) => <option key={value} value={value}>{t.finance.paymentMethods[value]}</option>)}
            </select>
          </label>
        </div>
        {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-4">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Fechar</Button>
          <Button type="submit" disabled={busy || (!available && !retrying)}>
            {busy ? "Registrando…" : retrying ? "Tentar novamente" : "Registrar pagamento"}
          </Button>
        </div>
      </form>
    </AgendaDialog>
  );
}
