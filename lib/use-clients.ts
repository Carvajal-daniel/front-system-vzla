"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { agendaBookingSignal } from "@/lib/agenda-sync";
import { apiRequest } from "@/lib/api-client";
import type { Appointment } from "@/lib/types/appointment";
import type { AppointmentPayment } from "@/lib/types/finance";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * Normaliza o telefone ou o nome do cliente para gerar um identificador canônico de compatibilidade.
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

export interface ApiClientRecord {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  tags: string[];
  notes: string | null;
  lastVisitAt: string | null;
  totalSpentCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientSupplement {
  id: string;
  companyId: string;
  name?: string;
  phone?: string;
  email?: string;
  document?: string;
  birthDate?: string;
  gender?: "FEMALE" | "MALE" | "OTHER" | "";
  source?: string;
  notes?: string;
  tags?: string[];
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Ficha consolidada 360º do cliente combinando base normalizada (/v1/clients)
 * com histórico agregado de atendimentos e financeiro.
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
  tags: string[];
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

type BookingClientDetails = Pick<
  ClientRecord,
  "email" | "document" | "birthDate" | "gender" | "source"
> &
  Record<string, string>;

type PaymentSummaryItem = Pick<AppointmentPayment, "openInCents" | "canCollect"> & {
  appointmentId: string;
};

export type ClientInput = Pick<
  ClientRecord,
  "name" | "phone" | "email" | "document" | "birthDate" | "gender" | "source" | "notes"
> & {
  tags?: string[];
  isBlocked?: boolean;
};

const clientUpdateEvent = "atelier-clients-updated";

function companyPhoneStorageKey(companyId: string): string {
  return `atelier_clients_${companyId}_company_phone`;
}

export function getClientBookingStatus(_companyId: string, _phone: string) {
  return { isBlocked: false, hasDebt: false };
}

export function rememberCompanyBookingPhone(companyId: string, phone: string) {
  try {
    if (phone.trim()) localStorage.setItem(companyPhoneStorageKey(companyId), phone);
  } catch {
    // O contato é opcional.
  }
}

export function getCompanyBookingPhone(companyId: string): string {
  try {
    return localStorage.getItem(companyPhoneStorageKey(companyId)) ?? "";
  } catch {
    return "";
  }
}

export function subscribeToClientStorage(callback: () => void) {
  window.addEventListener(clientUpdateEvent, callback);
  return () => {
    window.removeEventListener(clientUpdateEvent, callback);
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
  return [...new Set(groups.values())]
    .filter((group) => group.size > 1)
    .map((group) =>
      [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
    );
}

/**
 * Mantido por compatibilidade com fluxos públicos de agendamento.
 * A persistência oficial agora ocorre exclusivamente no backend via /v1/clients.
 */
export function registerClientIfMissing(
  _companyId: string,
  data: { name: string; phone: string },
): { created: boolean; id: string } {
  return {
    created: false,
    id: getCanonicalClientId(data.phone.trim(), data.name.trim()),
  };
}

function mergeBlockedTag(currentTags: string[], isBlocked?: boolean): string[] | undefined {
  if (isBlocked === undefined) return undefined;
  const cleaned = currentTags.filter((tag) => tag !== "blocked");
  return isBlocked ? [...cleaned, "blocked"] : cleaned;
}

export function useClients(companyId: string) {
  const [apiClients, setApiClients] = useState<ApiClientRecord[]>([]);
  const [rawAppointments, setRawAppointments] = useState<Appointment[]>([]);
  const [bookingDetails, setBookingDetails] = useState(
    new Map<string, BookingClientDetails>(),
  );
  const [paymentsMap, setPaymentsMap] = useState<Map<string, PaymentSummaryItem>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const loadingRequest = useRef<AbortController | null>(null);

  // Carrega a base oficial de clientes (/v1/clients) + agendamentos e financeiro
  const refresh = useCallback(
    async (showLoading = true) => {
      if (!companyId) return;
      loadingRequest.current?.abort();
      const request = new AbortController();
      loadingRequest.current = request;
      if (showLoading) setLoading(true);
      try {
        const [clientsRes, apps, details] = await Promise.all([
          apiRequest<{ clients: ApiClientRecord[] }>("/v1/clients", {
            signal: request.signal,
          }),
          apiRequest<Appointment[]>("/appointments", {
            signal: request.signal,
          }),
          apiRequest<{ phone: string; details: BookingClientDetails }[]>(
            "/companies/me/client-booking-data",
            { signal: request.signal },
          ).catch(() => null),
        ]);

        const ids = [...new Set(apps.map((appointment) => appointment.id))];
        const batches = Array.from(
          { length: Math.ceil(ids.length / 100) },
          (_, i) => ids.slice(i * 100, (i + 1) * 100).join(","),
        );
        const pList = await Promise.all(
          batches.map((batch) =>
            apiRequest<PaymentSummaryItem[]>("/finance/appointments/payment-summary", {
              signal: request.signal,
              query: { ids: batch },
            }).catch(() => []),
          ),
        );

        if (request.signal.aborted) return;

        const pMap = new Map(pList.flat().map((item) => [item.appointmentId, item]));
        setApiClients(clientsRes.clients ?? []);
        setRawAppointments(apps);

        if (details) {
          const byPhone = new Map<string, BookingClientDetails>();
          for (const { phone, details: fields } of details) {
            const key = clientPhoneKey(phone);
            if (key) byPhone.set(key, { ...fields, ...byPhone.get(key) });
          }
          setBookingDetails(byPhone);
        }

        setPaymentsMap((previous) =>
          new Map(
            ids.flatMap((id) => {
              const payment = pMap.get(id) ?? previous.get(id);
              return payment ? [[id, payment]] : [];
            }),
          ),
        );
      } catch {
        // Em caso de falha de rede mantém último estado carregado
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    },
    [companyId],
  );

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
    window.addEventListener(clientUpdateEvent, update);
    return () => {
      loadingRequest.current?.abort();
      window.removeEventListener("focus", update);
      window.removeEventListener("storage", sync);
      window.removeEventListener(clientUpdateEvent, update);
    };
  }, [companyId, refresh]);

  // Consolidação 360º: base normalizada /v1/clients + histórico de agendamentos e financeiro
  const clients = useMemo<ClientRecord[]>(() => {
    const clientsById = new Map<string, ClientRecord>();
    const clientIdByPhoneKey = new Map<string, string>();
    const now = Date.now();

    // 1. Carrega clientes oficiais persistidos no PostgreSQL (/v1/clients)
    for (const item of apiClients) {
      const phoneKey = clientPhoneKey(item.phone);
      const detail = phoneKey ? bookingDetails.get(phoneKey) : undefined;
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const record: ClientRecord = {
        id: item.id,
        name: item.name,
        phone: item.phone,
        email: item.email ?? detail?.email,
        document: detail?.document,
        birthDate: item.birthDate ?? detail?.birthDate,
        gender: detail?.gender,
        source: detail?.source,
        notes: item.notes ?? undefined,
        tags,
        isBlocked: tags.includes("blocked"),
        profileFields: detail,
        totalVisits: 0,
        noShows: 0,
        lastVisitAt: item.lastVisitAt,
        totalSpentCents: item.totalSpentCents,
        pendingDebtCents: 0,
        collectiblePayments: [],
        appointments: [],
        futureAppointments: [],
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
      clientsById.set(item.id, record);
      if (phoneKey) clientIdByPhoneKey.set(phoneKey, item.id);
    }

    // 2. Vincula agendamentos aos clientes pelo telefone normalizado
    const appointmentTotalsByClient = new Map<
      string,
      { visits: number; spent: number; lastVisitAt: string | null }
    >();

    for (const app of new Map(rawAppointments.map((app) => [app.id, app])).values()) {
      const phoneKey = clientPhoneKey(app.clientPhone);
      const matchedId =
        (phoneKey && clientIdByPhoneKey.get(phoneKey)) ||
        getCanonicalClientId(app.clientPhone, app.clientName);

      let existing = clientsById.get(matchedId);
      if (!existing) {
        const detail = phoneKey ? bookingDetails.get(phoneKey) : undefined;
        existing = {
          id: matchedId,
          name: app.clientName,
          phone: app.clientPhone,
          email: detail?.email,
          document: detail?.document,
          birthDate: detail?.birthDate,
          gender: detail?.gender,
          source: detail?.source,
          tags: [],
          isBlocked: false,
          profileFields: detail,
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
        clientsById.set(matchedId, existing);
        if (phoneKey) clientIdByPhoneKey.set(phoneKey, matchedId);
      }

      const payment = paymentsMap.get(app.id);
      let openDebt = 0;
      if (app.status !== "CANCELED") {
        if (payment) {
          openDebt = payment.openInCents;
        } else if (app.status !== "COMPLETED") {
          openDebt = app.servicePriceInCentsSnapshot;
        }
      }

      existing.appointments.push(app);

      const startsAt = Date.parse(app.startsAt);
      const totals = appointmentTotalsByClient.get(existing.id) ?? {
        visits: 0,
        spent: 0,
        lastVisitAt: null,
      };

      if (app.status === "COMPLETED") {
        totals.visits += 1;
        totals.spent += app.servicePriceInCentsSnapshot;
        if (
          startsAt <= now &&
          (!totals.lastVisitAt || startsAt > Date.parse(totals.lastVisitAt))
        ) {
          totals.lastVisitAt = app.startsAt;
        }
      } else if (app.status === "NO_SHOW") {
        existing.noShows += 1;
      }

      appointmentTotalsByClient.set(existing.id, totals);

      if (startsAt > now && app.status !== "CANCELED") {
        existing.futureAppointments.push(app);
      }

      existing.pendingDebtCents += openDebt;
      if (payment?.canCollect && payment.openInCents > 0) {
        existing.collectiblePayments.push(payment);
      }
    }

    for (const client of clientsById.values()) {
      const totals = appointmentTotalsByClient.get(client.id);
      if (totals) {
        client.totalVisits = totals.visits;
        if (totals.spent > client.totalSpentCents) {
          client.totalSpentCents = totals.spent;
        }
        if (
          totals.lastVisitAt &&
          (!client.lastVisitAt ||
            Date.parse(totals.lastVisitAt) > Date.parse(client.lastVisitAt))
        ) {
          client.lastVisitAt = totals.lastVisitAt;
        }
      }

      client.appointments.sort(
        (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
      );
      client.futureAppointments.sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
    }

    return Array.from(clientsById.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
    );
  }, [apiClients, rawAppointments, paymentsMap, bookingDetails]);

  const fetchClientById = useCallback(async (id: string) => {
    if (!UUID_REGEX.test(id)) return null;
    const { client } = await apiRequest<{ client: ApiClientRecord }>(
      `/v1/clients/${encodeURIComponent(id)}`,
    );
    setApiClients((previous) => {
      const exists = previous.some((item) => item.id === client.id);
      return exists
        ? previous.map((item) => (item.id === client.id ? client : item))
        : [...previous, client];
    });
    return client;
  }, []);

  const createClient = useCallback(async (data: ClientInput) => {
    const tags = data.isBlocked
      ? Array.from(new Set([...(data.tags ?? []), "blocked"]))
      : data.tags;

    const { client } = await apiRequest<{ client: ApiClientRecord }>("/v1/clients", {
      method: "POST",
      body: {
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim() || null,
        birthDate: data.birthDate?.trim() || null,
        notes: data.notes?.trim() || null,
        ...(tags ? { tags } : {}),
      },
    });

    setApiClients((previous) => [...previous, client]);
    window.dispatchEvent(new Event(clientUpdateEvent));
    return client.id;
  }, []);

  const saveClientDetails = useCallback(
    async (id: string, patch: Partial<ClientSupplement>) => {
      const current = clients.find((item) => item.id === id);
      const nextTags =
        patch.tags !== undefined
          ? patch.tags
          : mergeBlockedTag(current?.tags ?? [], patch.isBlocked);

      // Se o registro ainda não existir na tabela `clients` (ex.: veio apenas de agendamento antigo), cria primeiro
      if (!UUID_REGEX.test(id)) {
        const name = (patch.name ?? current?.name ?? "").trim();
        const phone = (patch.phone ?? current?.phone ?? "").trim();
        if (!name || !phone) return;
        await createClient({
          name,
          phone,
          email: patch.email ?? current?.email,
          birthDate: patch.birthDate ?? current?.birthDate,
          notes: patch.notes ?? current?.notes,
          tags: nextTags,
        });
        return;
      }

      const body: Record<string, unknown> = {};
      if (patch.name !== undefined) body.name = patch.name.trim();
      if (patch.phone !== undefined) body.phone = patch.phone.trim();
      if (patch.email !== undefined) body.email = patch.email.trim() || null;
      if (patch.birthDate !== undefined) {
        body.birthDate = patch.birthDate.trim() || null;
      }
      if (patch.notes !== undefined) body.notes = patch.notes.trim() || null;
      if (nextTags !== undefined) body.tags = nextTags;

      if (Object.keys(body).length === 0) return;

      const { client } = await apiRequest<{ client: ApiClientRecord }>(
        `/v1/clients/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body,
        },
      );

      setApiClients((previous) =>
        previous.map((item) => (item.id === client.id ? client : item)),
      );
      window.dispatchEvent(new Event(clientUpdateEvent));
    },
    [clients, createClient],
  );

  const toggleBlockClient = useCallback(
    async (id: string) => {
      const current = clients.find((item) => item.id === id);
      if (!current) return;
      await saveClientDetails(id, { isBlocked: !current.isBlocked });
    },
    [clients, saveClientDetails],
  );

  const updateAnamnesis = useCallback(
    async (id: string, notes: string) => {
      await saveClientDetails(id, { notes });
    },
    [saveClientDetails],
  );

  const getRegistrationClientId = useCallback(
    (data: Pick<ClientInput, "name" | "phone">) => {
      const phoneKey = clientPhoneKey(data.phone);
      const match = clients.find(
        (entry) => phoneKey && clientPhoneKey(entry.phone) === phoneKey,
      );
      return match?.id ?? getCanonicalClientId(data.phone, data.name);
    },
    [clients],
  );

  const importClients = useCallback(
    async (rows: ClientInput[]) => {
      let imported = 0;
      const existingPhones = new Set(
        clients.map((client) => clientPhoneKey(client.phone)).filter(Boolean),
      );

      for (const row of rows) {
        const phoneKey = clientPhoneKey(row.phone);
        if (!row.name.trim() || !phoneKey || existingPhones.has(phoneKey)) {
          continue;
        }
        try {
          await createClient(row);
          existingPhones.add(phoneKey);
          imported += 1;
        } catch {
          // Ignora duplicados/inválidos individuais para concluir o restante do lote
        }
      }

      return imported;
    },
    [clients, createClient],
  );

  const mergeClients = useCallback((_group: ClientRecord[]) => {
    // Mesclagem de registros já normalizados no banco será tratada em etapa dedicada do CRM.
  }, []);

  const deleteClient = useCallback((_client: ClientRecord) => {
    // Exclusão definitiva não faz parte do Bloco 1 para preservar integridade histórica.
  }, []);

  const hasRegisteredClient = useCallback(
    (params: {
      phone?: string;
      name?: string;
      excludeAppointmentId?: string;
      onlySupplements?: boolean;
    }): boolean => {
      const phoneDigits = clientPhoneKey(params.phone);
      const normalizedName = normalizeClientName(params.name);

      for (const client of clients) {
        if (params.onlySupplements && !UUID_REGEX.test(client.id)) {
          continue;
        }
        if (
          params.excludeAppointmentId &&
          !UUID_REGEX.test(client.id) &&
          !client.appointments.some((app) => app.id !== params.excludeAppointmentId)
        ) {
          continue;
        }
        if (phoneDigits && clientPhoneKey(client.phone) === phoneDigits) {
          return true;
        }
        if (normalizedName && normalizeClientName(client.name) === normalizedName) {
          return true;
        }
      }

      return false;
    },
    [clients],
  );

  const getClient = useCallback(
    (id: string): ClientRecord | undefined => clients.find((c) => c.id === id),
    [clients],
  );

  return {
    clients,
    loading,
    getClient,
    fetchClientById,
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
