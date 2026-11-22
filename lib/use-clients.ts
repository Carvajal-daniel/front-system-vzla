"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import type { Appointment } from "@/lib/types/appointment";

/**
 * Normaliza o telefone mantendo apenas dígitos para comparação canônica.
 */
function normalizeClientPhoneDigits(phone?: string): string {
  return (phone ?? "").replace(/\D/g, "");
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
  notes?: string; // Anamnese e anotações técnicas (cabelo, química, alergias)
  isBlocked: boolean; // Bloqueado para agendamento online
  customCreditsCents?: number;
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
  notes?: string;
  isBlocked: boolean;
  totalVisits: number;
  noShows: number;
  lastVisitAt: string | null;
  totalSpentCents: number;
  pendingDebtCents: number;
  appointments: Appointment[];
  futureAppointments: Appointment[];
  createdAt: string;
  updatedAt: string;
}

interface PaymentSummaryItem {
  appointmentId: string;
  collectedInCents: number;
  openInCents: number;
}

function getStorageKey(companyId: string): string {
  return `atelier_clients_${companyId}`;
}

function loadStoredSupplements(companyId: string): Record<string, ClientSupplement> {
  if (typeof window === "undefined" || !companyId) return {};
  try {
    const raw = localStorage.getItem(getStorageKey(companyId));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ClientSupplement>;
  } catch {
    return {};
  }
}

function saveStoredSupplements(companyId: string, data: Record<string, ClientSupplement>): void {
  if (typeof window === "undefined" || !companyId) return;
  try {
    localStorage.setItem(getStorageKey(companyId), JSON.stringify(data));
  } catch {
    // Falha silenciosa em caso de cota de armazenamento excedida
  }
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
  const targetDigits = normalizeClientPhoneDigits(trimmedPhone);

  // Evita duplicação verificando pelo telefone normalizado ou pelo ID canônico
  for (const [existingId, supp] of Object.entries(stored)) {
    const existingDigits = normalizeClientPhoneDigits(supp.phone);
    if (
      (targetDigits.length >= 8 && existingDigits.length >= 8 && existingDigits === targetDigits) ||
      existingId === canonicalId
    ) {
      return { created: false, id: existingId };
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
  saveStoredSupplements(companyId, next);
  return { created: true, id: canonicalId };
}

export function useClients(companyId: string) {
  const [supplements, setSupplements] = useState<Record<string, ClientSupplement>>({});
  const [rawAppointments, setRawAppointments] = useState<Appointment[]>([]);
  const [paymentsMap, setPaymentsMap] = useState<Map<string, PaymentSummaryItem>>(new Map());
  const [loading, setLoading] = useState(true);

  // Carrega complementos do localStorage na inicialização
  useEffect(() => {
    if (companyId) {
      setSupplements(loadStoredSupplements(companyId));
    }
  }, [companyId]);

  // Carrega os agendamentos da API e consolida os recebimentos de comandas
  const refresh = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      // Busca agendamentos do sistema
      const apps = await apiRequest<Appointment[]>("/appointments").catch(() => []);
      setRawAppointments(apps);

      // Busca dados de recebimentos para calcular saldo devedor (fiado)
      if (apps.length > 0) {
        const ids = apps.map((a) => a.id);
        const batches = Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) =>
          ids.slice(i * 100, (i + 1) * 100).join(","),
        );
        const pList = await Promise.all(
          batches.map((batch) =>
            apiRequest<PaymentSummaryItem[]>("/finance/appointments/payment-summary", {
              query: { ids: batch },
            }).catch(() => []),
          ),
        );
        const pMap = new Map<string, PaymentSummaryItem>();
        for (const item of pList.flat()) {
          pMap.set(item.appointmentId, item);
        }
        setPaymentsMap(pMap);
      } else {
        setPaymentsMap(new Map());
      }
    } catch {
      // Em caso de falha de rede
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Consolidação dos clientes a partir dos agendamentos + dados cadastrados manualmente
  const clients = useMemo<ClientRecord[]>(() => {
    const clientsMap = new Map<string, ClientRecord>();
    const nowIso = new Date().toISOString();

    // 1. Processa agendamentos da API
    for (const app of rawAppointments) {
      const canonicalId = getCanonicalClientId(app.clientPhone, app.clientName);
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
        existing = {
          id: canonicalId,
          name: supp?.name || app.clientName,
          phone: supp?.phone || app.clientPhone,
          email: supp?.email,
          document: supp?.document,
          birthDate: supp?.birthDate,
          gender: supp?.gender,
          notes: supp?.notes,
          isBlocked: supp?.isBlocked ?? false,
          totalVisits: 0,
          noShows: 0,
          lastVisitAt: null,
          totalSpentCents: 0,
          pendingDebtCents: 0,
          appointments: [],
          futureAppointments: [],
          createdAt: app.createdAt,
          updatedAt: app.updatedAt,
        };
        clientsMap.set(canonicalId, existing);
      }

      // Adiciona o agendamento
      existing.appointments.push(app);

      // Classifica visita concluída vs falta
      if (app.status === "COMPLETED") {
        existing.totalVisits += 1;
        existing.totalSpentCents += app.servicePriceInCentsSnapshot;
        if (!existing.lastVisitAt || new Date(app.startsAt) > new Date(existing.lastVisitAt)) {
          existing.lastVisitAt = app.startsAt;
        }
      } else if (app.status === "NO_SHOW") {
        existing.noShows += 1;
      }

      // Agendamentos futuros
      if (new Date(app.startsAt) > new Date(nowIso) && app.status !== "CANCELED") {
        existing.futureAppointments.push(app);
      }

      // Soma débitos em aberto
      existing.pendingDebtCents += openDebt;

      // Mantém a data de cadastro mais antiga
      if (new Date(app.createdAt) < new Date(existing.createdAt)) {
        existing.createdAt = app.createdAt;
      }
    }

    // 2. Inclui clientes cadastrados manualmente que ainda não possuem agendamento
    for (const [suppId, supp] of Object.entries(supplements)) {
      if (!clientsMap.has(suppId) && supp.name) {
        clientsMap.set(suppId, {
          id: suppId,
          name: supp.name,
          phone: supp.phone || "",
          email: supp.email,
          document: supp.document,
          birthDate: supp.birthDate,
          gender: supp.gender,
          notes: supp.notes,
          isBlocked: supp.isBlocked ?? false,
          totalVisits: 0,
          noShows: 0,
          lastVisitAt: null,
          totalSpentCents: 0,
          pendingDebtCents: 0,
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
  }, [rawAppointments, paymentsMap, supplements]);

  // Atualiza ou cria informações complementares de um cliente
  const saveClientDetails = useCallback(
    (id: string, patch: Partial<ClientSupplement>) => {
      setSupplements((prev) => {
        const existing = prev[id] || {
          id,
          companyId,
          isBlocked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const updated: ClientSupplement = {
          ...existing,
          ...patch,
          updatedAt: new Date().toISOString(),
        };

        const next = { ...prev, [id]: updated };
        saveStoredSupplements(companyId, next);
        return next;
      });
    },
    [companyId],
  );

  // Alterna o bloqueio de agendamento online do cliente
  const toggleBlockClient = useCallback(
    (id: string) => {
      setSupplements((prev) => {
        const current = prev[id];
        const isBlocked = !(current?.isBlocked ?? false);
        const updated: ClientSupplement = {
          ...(current || {
            id,
            companyId,
            createdAt: new Date().toISOString(),
          }),
          isBlocked,
          updatedAt: new Date().toISOString(),
        };
        const next = { ...prev, [id]: updated };
        saveStoredSupplements(companyId, next);
        return next;
      });
    },
    [companyId],
  );

  // Atualiza anotações técnicas e anamnese
  const updateAnamnesis = useCallback(
    (id: string, notes: string) => {
      saveClientDetails(id, { notes });
    },
    [saveClientDetails],
  );

  // Cria um novo cliente manual
  const createClient = useCallback(
    (data: {
      name: string;
      phone: string;
      email?: string;
      birthDate?: string;
      document?: string;
      notes?: string;
    }) => {
      const canonicalId = getCanonicalClientId(data.phone, data.name);
      const newSupp: ClientSupplement = {
        id: canonicalId,
        companyId,
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim(),
        birthDate: data.birthDate,
        document: data.document?.trim(),
        notes: data.notes?.trim(),
        isBlocked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setSupplements((prev) => {
        const stored = loadStoredSupplements(companyId);
        const next = { ...stored, ...prev, [canonicalId]: newSupp };
        saveStoredSupplements(companyId, next);
        return next;
      });

      return canonicalId;
    },
    [companyId],
  );

  // Verifica se já existe cliente cadastrado na base (supplements ou, opcionalmente, outros agendamentos)
  const hasRegisteredClient = useCallback(
    (params: {
      phone?: string;
      name?: string;
      excludeAppointmentId?: string;
      onlySupplements?: boolean;
    }): boolean => {
      const phoneDigits = normalizeClientPhoneDigits(params.phone);
      const normalizedName = normalizeClientName(params.name);
      const canonicalId = getCanonicalClientId(params.phone, params.name);

      const stored = loadStoredSupplements(companyId);
      const mergedSupplements = { ...stored, ...supplements };
      if (mergedSupplements[canonicalId]?.name || mergedSupplements[canonicalId]?.phone) {
        return true;
      }

      for (const supp of Object.values(mergedSupplements)) {
        const suppDigits = normalizeClientPhoneDigits(supp.phone);
        if (phoneDigits.length >= 8 && suppDigits.length >= 8 && suppDigits === phoneDigits) {
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

        const clientDigits = normalizeClientPhoneDigits(client.phone);
        if (phoneDigits.length >= 8 && clientDigits.length >= 8 && clientDigits === phoneDigits) {
          return true;
        }
        if (normalizedName && normalizeClientName(client.name) === normalizedName) {
          return true;
        }
      }

      return false;
    },
    [clients, companyId, supplements],
  );

  const getClient = useCallback(
    (id: string): ClientRecord | undefined => {
      return clients.find((c) => c.id === id);
    },
    [clients],
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
    refresh,
  };
}
