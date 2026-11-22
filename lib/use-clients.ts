"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { agendaBookingSignal } from "@/lib/agenda-sync";
import { apiRequest } from "@/lib/api-client";
import type { Appointment } from "@/lib/types/appointment";
import type { AppointmentPayment } from "@/lib/types/finance";

/**
 * Normaliza o telefone mantendo apenas dígitos para comparação canônica.
 */
function normalizeClientPhoneDigits(phone?: string): string {
  return (phone ?? "").replace(/\D/g, "");
}

export function clientPhoneKey(phone?: string): string {
  const digits = normalizeClientPhoneDigits(phone);
  if (/^55\d{10,11}$/.test(digits)) return digits.slice(2);
  if (/^0[24]\d{9}$/.test(digits)) return `58${digits.slice(1)}`;
  return digits.length >= 8 ? digits : "";
}

export function clientWhatsAppUrl(phone: string, countryCode = "+55"): string | null {
  const digits = normalizeClientPhoneDigits(phone);
  if (digits.length < 8 || digits.length > 15) return null;
  const international = phone.trim().startsWith("+") || digits.length > 11;
  const national = countryCode === "+58" ? digits.replace(/^0/, "") : digits;
  return `https://wa.me/${international ? digits : countryCode.replace("+", "") + national}`;
}

/**
 * Normaliza o nome do cliente (sem acentos, minúsculo e espaços colapsados) para evitar duplicidade.
 */
function normalizeClientName(name?: string): string {
  return (name ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Normaliza o telefone ou o nome do cliente para gerar um identificador estável e canônico.
 */
export function getCanonicalClientId(phone?: string, name?: string): string {
  const digits = normalizeClientPhoneDigits(phone);
  if (digits.length >= 8) {
    return `c_${digits}`;
  }
  const slug = (name ?? "cliente")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `c_${slug || "anonimo"}`;
}

/**
 * Informações cadastrais complementares persistidas localmente por empresa.
 */
export interface ClientSupplement {
  id: string;
  companyId: string;
  name?: string;
  phone?: string;
  email?: string;
  document?: string; // CPF ou documento de identificação
  birthDate?: string; // Formato YYYY-MM-DD
  gender?: "FEMALE" | "MALE" | "OTHER" | "";
  source?: string;
  notes?: string; // Anamnese e anotações técnicas (cabelo, química, alergias)
  isBlocked: boolean; // Bloqueado para agendamento online
  customCreditsCents?: number;
  mergedInto?: string;
  deleted?: boolean;
  blocked?: boolean;
  debt?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Ficha consolidada 360º do cliente com histórico agregado de atendimentos e financeiro.
 */
export interface ClientRecord {
  id: string;
  name: string;
  phone: string;
  email?: string;
  document?: string;
  birthDate?: string;
  gender?: "FEMALE" | "MALE" | "OTHER" | "";
  source?: string;
  notes?: string;
  isBlocked: boolean;
  profileFields?: Record<string, string>;
  totalVisits: number;
  noShows: number;
  lastVisitAt: string | null;
  totalSpentCents: number;
  pendingDebtCents: number;
  collectiblePayments: PaymentSummaryItem[];
  appointments: Appointment[];
  futureAppointments: Appointment[];
  createdAt: string;
  updatedAt: string;
}

type BookingClientDetails = Pick<ClientRecord, "email" | "document" | "birthDate" | "gender" | "source"> & Record<string, string>;

type PaymentSummaryItem = Pick<AppointmentPayment, "openInCents" | "canCollect"> & { appointmentId: string };

export type ClientInput = Pick<ClientRecord, "name" | "phone" | "email" | "document" | "birthDate" | "gender" | "source" | "notes">;

function getStorageKey(companyId: string): string {
  return `atelier_clients_${companyId}`;
}

function loadStoredSupplements(companyId: string): Record<string, ClientSupplement> {
  if (typeof window === "undefined" || !companyId) return {};
  try {
    const raw = localStorage.getItem(getStorageKey(companyId));
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).filter(([, entry]) => entry && typeof entry === "object" && !Array.isArray(entry))
      .map(([id, entry]) => [id, { ...entry as ClientSupplement, id }]));
  } catch {
    return {};
  }
}

const clientStorageEvent = "atelier-clients-updated";

function saveStoredSupplements(companyId: string, data: Record<string, ClientSupplement>): void {
  localStorage.setItem(getStorageKey(companyId), JSON.stringify(data));
  window.dispatchEvent(new Event(clientStorageEvent));
}

function resolveClientId(supplements: Record<string, ClientSupplement>, id: string): string {
  const visited = new Set<string>();
  while (supplements[id]?.mergedInto && !visited.has(id)) {
    visited.add(id);
    id = supplements[id].mergedInto!;
  }
  return id;
}

function isBlocked(supplement?: ClientSupplement): boolean {
  return supplement?.isBlocked ?? supplement?.blocked ?? false;
}

function matchesStoredPhone(supplement: ClientSupplement, phoneKey: string): boolean {
  const idPhone = /^c_(\d+)$/.exec(supplement.id)?.[1];
  return clientPhoneKey(supplement.phone) === phoneKey || clientPhoneKey(idPhone) === phoneKey;
}

function bookingDebtKey(companyId: string) {
  return `${getStorageKey(companyId)}_booking_debt`;
}

export function getClientBookingStatus(companyId: string, phone: string) {
  const phoneKey = clientPhoneKey(phone);
  const status = { isBlocked: false, hasDebt: false };
  if (!phoneKey) return status;
  const stored = loadStoredSupplements(companyId);
  const relatedIds = new Set<string>();
  let deletedMatch = false;
  for (const entry of Object.values(stored)) {
    if (!matchesStoredPhone(entry, phoneKey)) continue;
    const client = stored[resolveClientId(stored, entry.id)];
    if (!client || client.deleted) {
      deletedMatch ||= Boolean(client?.deleted);
      continue;
    }
    relatedIds.add(client.id);
    status.isBlocked ||= isBlocked(client);
    status.hasDebt ||= (client.debt ?? 0) > 0;
  }
  try {
    const debtPhones: string[] = JSON.parse(localStorage.getItem(bookingDebtKey(companyId)) ?? "[]");
    status.hasDebt ||= (!deletedMatch || relatedIds.size > 0) && debtPhones.includes(phoneKey);
    status.hasDebt ||= Object.values(stored).some((entry) => relatedIds.has(resolveClientId(stored, entry.id)) &&
      debtPhones.some((key) => matchesStoredPhone(entry, key)));
  } catch {
    // A consulta também funciona com apenas o cadastro local.
  }
  return status;
}

export function rememberCompanyBookingPhone(companyId: string, phone: string) {
  try {
    if (phone.trim()) localStorage.setItem(`${getStorageKey(companyId)}_company_phone`, phone);
  } catch {
    // O contato é opcional.
  }
}

export function getCompanyBookingPhone(companyId: string): string {
  try {
    return localStorage.getItem(`${getStorageKey(companyId)}_company_phone`) ?? "";
  } catch {
    return "";
  }
}

export function subscribeToClientStorage(callback: () => void) {
  window.addEventListener(clientStorageEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(clientStorageEvent, callback);
    window.removeEventListener("storage", callback);
  };
}

export function getClientDuplicateGroups(clients: ClientRecord[]): ClientRecord[][] {
  const identities = new Map<string, ClientRecord>();
  const groups = new Map<ClientRecord, Set<ClientRecord>>();
  for (const client of clients) {
    const phone = clientPhoneKey(client.phone);
    const name = client.name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
    const keys = [phone && `phone:${phone}`, name && `name:${name}`].filter(Boolean);
    const related = new Set([client]);
    for (const key of keys) {
      const previous = identities.get(key);
      if (previous) for (const match of groups.get(previous) ?? []) related.add(match);
      identities.set(key, client);
    }
    for (const member of related) groups.set(member, related);
  }
  return [...new Set(groups.values())].filter((group) => group.size > 1).map((group) =>
    [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)));
}

/**
 * Registra o cliente na base local (localStorage) da empresa caso ainda não exista pelo telefone.
 * Pode ser chamado em fluxos públicos (sem autenticação) sem acionar requisições privadas da API.
 */
export function registerClientIfMissing(
  companyId: string,
  data: { name: string; phone: string },
): { created: boolean; id: string } {
  const trimmedName = data.name.trim();
  const trimmedPhone = data.phone.trim();
  const canonicalId = getCanonicalClientId(trimmedPhone, trimmedName);

  if (typeof window === "undefined" || !companyId || !trimmedName) {
    return { created: false, id: canonicalId };
  }

  const stored = loadStoredSupplements(companyId);
  const targetPhone = clientPhoneKey(trimmedPhone);

  // Evita duplicação verificando pelo telefone normalizado ou pelo ID canônico
  for (const [existingId, supp] of Object.entries(stored)) {
    if (
      (targetPhone && matchesStoredPhone(supp, targetPhone)) ||
      existingId === canonicalId
    ) {
      return { created: false, id: resolveClientId(stored, existingId) };
    }
  }

  const nowIso = new Date().toISOString();
  const next: Record<string, ClientSupplement> = {
    ...stored,
    [canonicalId]: {
      id: canonicalId,
      companyId,
      name: trimmedName,
      phone: trimmedPhone,
      isBlocked: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  };
  try {
    saveStoredSupplements(companyId, next);
  } catch {
    return { created: false, id: canonicalId };
  }
  return { created: true, id: canonicalId };
}

export function useClients(companyId: string) {
  const [supplements, setSupplements] = useState<Record<string, ClientSupplement>>({});
  const [rawAppointments, setRawAppointments] = useState<Appointment[]>([]);
  const [bookingDetails, setBookingDetails] = useState(new Map<string, BookingClientDetails>());
  const [paymentsMap, setPaymentsMap] = useState<Map<string, PaymentSummaryItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const loadingRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const sync = () => setSupplements(loadStoredSupplements(companyId));
    const syncStorage = (event: StorageEvent) => {
      if (event.key === getStorageKey(companyId) || event.key === null) sync();
    };
    sync();
    window.addEventListener(clientStorageEvent, sync);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener(clientStorageEvent, sync);
      window.removeEventListener("storage", syncStorage);
    };
  }, [companyId]);

  // Carrega os agendamentos da API e consolida os recebimentos de comandas
  const refresh = useCallback(async (showLoading = true) => {
    if (!companyId) return;
    loadingRequest.current?.abort();
    const request = new AbortController();
    loadingRequest.current = request;
    if (showLoading) setLoading(true);
    try {
      const [apps, details] = await Promise.all([
        apiRequest<Appointment[]>("/appointments", { signal: request.signal }),
        apiRequest<{ phone: string; details: BookingClientDetails }[]>("/companies/me/client-booking-data", { signal: request.signal }).catch(() => null),
      ]);
      const ids = [...new Set(apps.map((appointment) => appointment.id))];
      const batches = Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) =>
        ids.slice(i * 100, (i + 1) * 100).join(","),
      );
      const pList = await Promise.all(batches.map((batch) =>
        apiRequest<PaymentSummaryItem[]>("/finance/appointments/payment-summary", {
          signal: request.signal, query: { ids: batch },
        }).catch(() => []),
      ));
      if (request.signal.aborted) return;
      const pMap = new Map(pList.flat().map((item) => [item.appointmentId, item]));
      setRawAppointments(apps);
      if (details) {
        const byPhone = new Map<string, BookingClientDetails>();
        for (const { phone, details: fields } of details) {
          const key = clientPhoneKey(phone);
          if (key) byPhone.set(key, { ...fields, ...byPhone.get(key) });
        }
        setBookingDetails(byPhone);
      }
      setPaymentsMap((previous) => new Map(ids.flatMap((id) => {
        const payment = pMap.get(id) ?? previous.get(id);
        return payment ? [[id, payment]] : [];
      })));
      if (ids.length && pMap.size === ids.length) {
        const debtPhones = new Set(apps.flatMap((app) => {
          const phone = clientPhoneKey(app.clientPhone);
          const payment = pMap.get(app.id);
          return phone && app.status !== "CANCELED" && payment && payment.openInCents > 0 ? [phone] : [];
        }));
        const snapshot = JSON.stringify([...debtPhones].sort());
        if (localStorage.getItem(bookingDebtKey(companyId)) !== snapshot) {
          localStorage.setItem(bookingDebtKey(companyId), snapshot);
          window.dispatchEvent(new Event(clientStorageEvent));
        }
      }
    } catch {
      // Em caso de falha de rede
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    const signal = agendaBookingSignal(companyId);
    const update = () => void refresh(false);
    const sync = (event: StorageEvent) => {
      if (event.key === signal) update();
    };
    void refresh();
    window.addEventListener("focus", update);
    window.addEventListener("storage", sync);
    return () => {
      loadingRequest.current?.abort();
      window.removeEventListener("focus", update);
      window.removeEventListener("storage", sync);
    };
  }, [companyId, refresh]);

  // Consolidação dos clientes a partir dos agendamentos + dados cadastrados manualmente
  const clients = useMemo<ClientRecord[]>(() => {
    const clientsMap = new Map<string, ClientRecord>();
    const now = Date.now();

    // 1. Processa agendamentos da API
    const registeredPhones = new Map<string, string>();
    for (const [id, supp] of Object.entries(supplements)) {
      const phone = normalizeClientPhoneDigits(supp.phone);
      if (phone.length >= 8 && (!registeredPhones.has(phone) || (!supp.mergedInto && !supp.deleted))) {
        registeredPhones.set(phone, id);
      }
    }
    for (const app of new Map(rawAppointments.map((app) => [app.id, app])).values()) {
      const originalId = getCanonicalClientId(app.clientPhone, app.clientName);
      const mappedId = supplements[originalId] ? originalId : registeredPhones.get(normalizeClientPhoneDigits(app.clientPhone)) ?? originalId;
      const canonicalId = resolveClientId(supplements, mappedId);
      if (supplements[canonicalId]?.deleted) continue;
      const payment = paymentsMap.get(app.id);

      // Calcula débito em aberto da comanda
      let openDebt = 0;
      if (app.status !== "CANCELED") {
        if (payment) {
          openDebt = payment.openInCents;
        } else if (app.status !== "COMPLETED") {
          openDebt = app.servicePriceInCentsSnapshot;
        }
      }

      let existing = clientsMap.get(canonicalId);
      if (!existing) {
        const supp = supplements[canonicalId];
        const detail = bookingDetails.get(clientPhoneKey(app.clientPhone));
        existing = {
          id: canonicalId,
          name: supp?.name || app.clientName,
          phone: supp?.phone || app.clientPhone,
          email: supp?.email ?? detail?.email,
          document: supp?.document ?? detail?.document,
          birthDate: supp?.birthDate ?? detail?.birthDate,
          gender: supp?.gender ?? detail?.gender,
          source: supp?.source ?? detail?.source,
          notes: supp?.notes,
          profileFields: detail,
          isBlocked: isBlocked(supp),
          totalVisits: 0,
          noShows: 0,
          lastVisitAt: null,
          totalSpentCents: 0,
          pendingDebtCents: 0,
          collectiblePayments: [],
          appointments: [],
          futureAppointments: [],
          createdAt: app.createdAt,
          updatedAt: app.updatedAt,
        };
        clientsMap.set(canonicalId, existing);
      }

      // Adiciona o agendamento
      existing.appointments.push(app);

      const startsAt = Date.parse(app.startsAt);
      // Classifica visita concluída vs falta
      if (app.status === "COMPLETED") {
        existing.totalVisits += 1;
        existing.totalSpentCents += app.servicePriceInCentsSnapshot;
        if (startsAt <= now && (!existing.lastVisitAt || startsAt > Date.parse(existing.lastVisitAt))) {
          existing.lastVisitAt = app.startsAt;
        }
      } else if (app.status === "NO_SHOW") {
        existing.noShows += 1;
      }

      // Agendamentos futuros
      if (startsAt > now && app.status !== "CANCELED") {
        existing.futureAppointments.push(app);
      }

      // Soma débitos em aberto
      existing.pendingDebtCents += openDebt;
      if (payment?.canCollect && payment.openInCents > 0) existing.collectiblePayments.push(payment);

      // Mantém a data de cadastro mais antiga
      if (new Date(app.createdAt) < new Date(existing.createdAt)) {
        existing.createdAt = app.createdAt;
      }
    }

    // 2. Inclui clientes cadastrados manualmente que ainda não possuem agendamento
    for (const [suppId, supp] of Object.entries(supplements)) {
      if (!clientsMap.has(suppId) && supp.name && !supp.deleted && !supp.mergedInto) {
        clientsMap.set(suppId, {
          id: suppId,
          name: supp.name,
          phone: supp.phone || "",
          email: supp.email,
          document: supp.document,
          birthDate: supp.birthDate,
          gender: supp.gender,
          source: supp.source,
          notes: supp.notes,
          isBlocked: isBlocked(supp),
          totalVisits: 0,
          noShows: 0,
          lastVisitAt: null,
          totalSpentCents: 0,
          pendingDebtCents: 0,
          collectiblePayments: [],
          appointments: [],
          futureAppointments: [],
          createdAt: supp.createdAt,
          updatedAt: supp.updatedAt,
        });
      }
    }

    // Ordena os agendamentos internos por data decrescente
    for (const client of clientsMap.values()) {
      client.appointments.sort(
        (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
      );
      client.futureAppointments.sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
    }

    // Retorna ordenado alfabeticamente pelo nome
    return Array.from(clientsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
    );
  }, [rawAppointments, paymentsMap, supplements, bookingDetails]);

  const updateSupplements = useCallback((update: (stored: Record<string, ClientSupplement>) => void) => {
    const stored = loadStoredSupplements(companyId);
    update(stored);
    saveStoredSupplements(companyId, stored);
  }, [companyId]);

  const saveClientDetails = useCallback(
    (id: string, patch: Partial<ClientSupplement>) => {
      updateSupplements((stored) => {
        const resolvedId = resolveClientId(stored, id);
        const existing = stored[resolvedId];
        const now = new Date().toISOString();
        const oldPhone = existing?.phone;
        if (patch.phone && oldPhone && clientPhoneKey(patch.phone) !== clientPhoneKey(oldPhone)) {
          const alias = getCanonicalClientId(oldPhone);
          if (alias !== resolvedId && !stored[alias]) {
            stored[alias] = { id: alias, companyId, phone: oldPhone, mergedInto: resolvedId, isBlocked: false, createdAt: now, updatedAt: now };
          }
        }
        stored[resolvedId] = {
          ...existing,
          ...patch,
          id: resolvedId,
          companyId,
          isBlocked: patch.isBlocked ?? isBlocked(existing),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
      });
    },
    [companyId, updateSupplements],
  );

  // Alterna o bloqueio de agendamento online do cliente
  const toggleBlockClient = useCallback(
    (id: string) => {
      const stored = loadStoredSupplements(companyId);
      saveClientDetails(id, { isBlocked: !isBlocked(stored[resolveClientId(stored, id)]) });
    },
    [companyId, saveClientDetails],
  );

  // Atualiza anotações técnicas e anamnese
  const updateAnamnesis = useCallback(
    (id: string, notes: string) => {
      saveClientDetails(id, { notes });
    },
    [saveClientDetails],
  );

  const getRegistrationClientId = useCallback((data: Pick<ClientInput, "name" | "phone">) => {
    const stored = loadStoredSupplements(companyId);
    const phoneKey = clientPhoneKey(data.phone);
    const match = Object.values(stored).find((entry) => phoneKey && matchesStoredPhone(entry, phoneKey));
    return resolveClientId(stored, match?.id ?? getCanonicalClientId(data.phone, data.name));
  }, [companyId]);

  // Cria um novo cliente manual
  const createClient = useCallback(
    (data: ClientInput) => {
      const canonicalId = getCanonicalClientId(data.phone, data.name);
      const phoneKey = clientPhoneKey(data.phone);
      let id = canonicalId;
      updateSupplements((stored) => {
        const match = Object.values(stored).find((entry) => phoneKey && matchesStoredPhone(entry, phoneKey));
        id = resolveClientId(stored, match?.id ?? canonicalId);
        const existing = stored[id];
        if (existing && !existing.deleted && (existing.name || existing.phone)) return;
        const now = new Date().toISOString();
        stored[id] = {
          ...existing,
          ...data,
          id,
          companyId,
          name: data.name.trim(),
          phone: data.phone.trim(),
          isBlocked: isBlocked(existing),
          deleted: false,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
      });
      return id;
    },
    [companyId, updateSupplements],
  );

  const importClients = useCallback((rows: ClientInput[]) => {
    let imported = 0;
    updateSupplements((stored) => {
      const phones = new Set(clients.flatMap((client) => [
        clientPhoneKey(client.phone), ...client.appointments.map((appointment) => clientPhoneKey(appointment.clientPhone)),
      ]));
      for (const entry of Object.values(stored)) {
        if (stored[resolveClientId(stored, entry.id)]?.deleted) continue;
        phones.add(clientPhoneKey(entry.phone));
        phones.add(clientPhoneKey(/^c_(\d+)$/.exec(entry.id)?.[1]));
      }
      const now = new Date().toISOString();
      for (const row of rows) {
        const phone = clientPhoneKey(row.phone);
        if (!row.name.trim() || !phone || phones.has(phone)) continue;
        const id = getCanonicalClientId(row.phone, row.name);
        if (stored[id]?.mergedInto || stored[id]?.deleted) continue;
        stored[id] = { ...row, id, companyId, isBlocked: false, createdAt: now, updatedAt: now };
        phones.add(phone);
        imported++;
      }
    });
    return imported;
  }, [clients, companyId, updateSupplements]);

  const mergeClients = useCallback((group: ClientRecord[]) => {
    const [primary, ...duplicates] = group;
    if (!primary || !duplicates.length) return;
    updateSupplements((stored) => {
      if (group.some(({ id }) => stored[id]?.deleted || stored[id]?.mergedInto)) {
        throw new Error("O grupo mudou. Revise os cadastros e tente novamente.");
      }
      const now = new Date().toISOString();
      const notes = [...new Set(group.flatMap((client) => client.notes ? [client.notes] : []))].join("\n\n");
      stored[primary.id] = {
        ...stored[primary.id], id: primary.id, companyId, name: primary.name,
        phone: group.find((client) => client.phone)?.phone,
        email: group.find((client) => client.email)?.email,
        document: group.find((client) => client.document)?.document,
        birthDate: group.find((client) => client.birthDate)?.birthDate,
        gender: group.find((client) => client.gender)?.gender,
        source: group.find((client) => client.source)?.source,
        notes,
        isBlocked: group.some((client) => stored[client.id] ? isBlocked(stored[client.id]) : client.isBlocked),
        customCreditsCents: group.reduce((sum, client) => sum + (stored[client.id]?.customCreditsCents ?? 0), 0),
        debt: group.reduce((sum, client) => sum + (stored[client.id]?.debt ?? 0), 0),
        createdAt: primary.createdAt,
        updatedAt: now,
      };
      for (const client of duplicates) {
        stored[client.id] = { id: client.id, companyId, phone: client.phone, isBlocked: false, mergedInto: primary.id,
          createdAt: client.createdAt, updatedAt: now };
      }
    });
  }, [companyId, updateSupplements]);

  const deleteClient = useCallback((client: ClientRecord) => {
    updateSupplements((stored) => {
      const id = resolveClientId(stored, client.id);
      stored[id] = { id, companyId, phone: client.phone, isBlocked: false, deleted: true,
        createdAt: client.createdAt, updatedAt: new Date().toISOString() };
    });
  }, [companyId, updateSupplements]);

  // Verifica se já existe cliente cadastrado na base (supplements ou, opcionalmente, outros agendamentos)
  const hasRegisteredClient = useCallback(
    (params: {
      phone?: string;
      name?: string;
      excludeAppointmentId?: string;
      onlySupplements?: boolean;
    }): boolean => {
      const phoneDigits = clientPhoneKey(params.phone);
      const normalizedName = normalizeClientName(params.name);
      const canonicalId = getCanonicalClientId(params.phone, params.name);

      const stored = loadStoredSupplements(companyId);
      const registered = stored[resolveClientId(stored, canonicalId)];
      if (!registered?.deleted && (registered?.name || registered?.phone)) {
        return true;
      }

      for (const supp of Object.values(stored)) {
        if (stored[resolveClientId(stored, supp.id)]?.deleted) continue;
        if (phoneDigits && matchesStoredPhone(supp, phoneDigits)) {
          return true;
        }
        if (normalizedName && supp.name && normalizeClientName(supp.name) === normalizedName) {
          return true;
        }
      }

      // Quando a checagem exige cadastro oficial na base CRM (supplements), ignora clientes vindos apenas da API
      if (params.onlySupplements) {
        return false;
      }

      for (const client of clients) {
        const hasOtherAppointment = params.excludeAppointmentId
          ? client.appointments.some((app) => app.id !== params.excludeAppointmentId)
          : client.appointments.length > 0;
        if (!hasOtherAppointment) continue;

        if (phoneDigits && clientPhoneKey(client.phone) === phoneDigits) {
          return true;
        }
        if (normalizedName && normalizeClientName(client.name) === normalizedName) {
          return true;
        }
      }

      return false;
    },
    [clients, companyId],
  );

  const getClient = useCallback(
    (id: string): ClientRecord | undefined => clients.find((c) => c.id === resolveClientId(supplements, id)),
    [clients, supplements],
  );

  return {
    clients,
    loading,
    getClient,
    hasRegisteredClient,
    saveClientDetails,
    toggleBlockClient,
    updateAnamnesis,
    createClient,
    getRegistrationClientId,
    importClients,
    mergeClients,
    deleteClient,
    refresh,
  };
}
