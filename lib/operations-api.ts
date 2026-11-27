import { apiRequest } from "@/lib/api-client";

export type CascadeDelayMinutes = 15 | 30 | 45;

export interface CascadeDelayOutput {
  collaboratorId: string;
  date: string;
  delayMinutes: CascadeDelayMinutes;
  affectedCount: number;
  notifiedCount: number;
  appointments: Array<{
    id: string;
    clientName: string;
    previousStartsAt: string;
    newStartsAt: string;
    newEndsAt: string;
    notified: boolean;
  }>;
}

export interface EmergencyAbsenceOutput {
  blockId: string;
  ownerAlertId: string;
  collaboratorId: string;
  date: string;
  affectedCount: number;
  notifiedCount: number;
  affectedAppointments: Array<{
    appointmentId: string;
    clientName: string;
    originalStartsAt: string;
    suggestedAlternative: {
      collaboratorId: string;
      collaboratorName: string;
      startsAt: string;
    } | null;
    notified: boolean;
  }>;
}

export type WaitlistShift = "MORNING" | "AFTERNOON" | "EVENING" | "ANY";
export type WaitlistStatus = "WAITING" | "NOTIFIED" | "CONVERTED" | "EXPIRED";

export interface SmartWaitlistEntry {
  id: string;
  companyId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  collaboratorId: string | null;
  collaboratorName: string | null;
  desiredDate: string;
  preferredShift: WaitlistShift;
  status: WaitlistStatus;
  notifiedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ListWaitlistResponse {
  date: string;
  entries: SmartWaitlistEntry[];
}

export type OwnerAlertType =
  | "LOW_SURVEY_SCORE"
  | "COLLABORATOR_EMERGENCY"
  | "CHURN_OPPORTUNITY"
  | "AI_HANDOFF";

export interface OwnerAlertRecord {
  id: string;
  companyId: string;
  type: OwnerAlertType;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export type ChurnRiskLevel = "WARNING" | "HIGH_RISK";

export interface IndividualChurnCandidate {
  clientId: string;
  clientName: string;
  clientPhone: string;
  visitCount: number;
  averageCycleDays: number;
  daysSinceLastVisit: number;
  overdueDays: number;
  risk: ChurnRiskLevel;
  lastVisitAt: string;
  lastServiceName: string | null;
  lastCollaboratorName: string | null;
}

export interface ChurnRadarResponse {
  marginDays: number;
  generatedAt: string;
  totalAtRisk: number;
  highRiskCount: number;
  warningCount: number;
  clients: IndividualChurnCandidate[];
}

export interface ChurnReactivateResponse {
  clientId: string;
  delivered: boolean;
  message: string;
  candidate: IndividualChurnCandidate;
}

export interface BackendClientOption {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
}

export const OWNER_ALERTS_UPDATED_EVENT = "atelier:owner-alerts-updated";

// Dispara atualização imediata do sino de alertas após ações operacionais (ex.: Modo Imprevisto).
export function notifyOwnerAlertsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OWNER_ALERTS_UPDATED_EVENT));
}

export const operationsApi = {
  cascadeDelay(body: {
    collaboratorId: string;
    date: string;
    delayMinutes: CascadeDelayMinutes;
  }) {
    return apiRequest<CascadeDelayOutput>("/appointments/cascade-delay", {
      method: "POST",
      body,
    });
  },

  emergencyAbsence(
    collaboratorId: string,
    body: { date: string; reason?: string },
  ) {
    return apiRequest<EmergencyAbsenceOutput>(
      `/collaborators/${encodeURIComponent(collaboratorId)}/emergency-absence`,
      {
        method: "POST",
        body,
      },
    );
  },

  listWaitlist(
    params?: { date?: string; status?: WaitlistStatus },
    signal?: AbortSignal,
  ) {
    return apiRequest<ListWaitlistResponse>("/waitlist", {
      query: {
        date: params?.date,
        status: params?.status,
      },
      signal,
    });
  },

  addWaitlistEntry(body: {
    clientId: string;
    collaboratorId?: string | null;
    desiredDate: string;
    preferredShift: WaitlistShift;
  }) {
    return apiRequest<SmartWaitlistEntry>("/waitlist", {
      method: "POST",
      body,
    });
  },

  listOwnerAlerts(
    params?: { unreadOnly?: boolean; limit?: number },
    signal?: AbortSignal,
  ) {
    return apiRequest<{ alerts: OwnerAlertRecord[] }>("/owner-alerts", {
      query: {
        unreadOnly:
          params?.unreadOnly !== undefined ? String(params.unreadOnly) : undefined,
        limit: params?.limit,
      },
      signal,
    });
  },

  markOwnerAlertRead(alertId: string) {
    return apiRequest<{ id: string; isRead: boolean }>(
      `/owner-alerts/${encodeURIComponent(alertId)}/read`,
      {
        method: "PATCH",
      },
    );
  },

  getChurnRadar(params?: { marginDays?: number }, signal?: AbortSignal) {
    return apiRequest<ChurnRadarResponse>("/retention/churn-radar", {
      query: { marginDays: params?.marginDays },
      signal,
    });
  },

  reactivateChurnClient(
    clientId: string,
    body?: { customMessage?: string; marginDays?: number },
  ) {
    return apiRequest<ChurnReactivateResponse>(
      `/retention/churn-radar/${encodeURIComponent(clientId)}/reactivate`,
      {
        method: "POST",
        body: body ?? {},
      },
    );
  },

  listClients(search?: string, signal?: AbortSignal) {
    return apiRequest<{ clients: BackendClientOption[] }>("/v1/clients", {
      query: { search: search?.trim() || undefined },
      signal,
    });
  },
};
