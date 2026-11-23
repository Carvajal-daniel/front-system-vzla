import { apiRequest } from "@/lib/api-client";

export const inactivityOptions = [30, 45, 60, 90] as const;
export type InactiveDays = (typeof inactivityOptions)[number];

export interface InactiveClient {
  id: string;
  name: string;
  phone: string;
  lastVisit: {
    serviceName: string;
    price: number;
    collaboratorName: string;
    completedAt: string;
    daysSinceLastVisit: number;
  };
  lastReview: {
    stars: number;
    comment: string | null;
    createdAt?: string;
  } | null;
  lastCancellation: {
    canceledAt: string;
    cancelReason: string | null;
  } | null;
  historySummary?: {
    totalVisits: number;
    averageVisitIntervalDays: number | null;
    recentCancellations: number;
    recentNoShows: number;
    changedCollaborator: boolean;
    priceDeltaPercent: number | null;
  };
  diagnosticTag: "LOW_RATING" | "CANCELED_WITHOUT_REBOOK" | "CHURN_INACTIVE";
}

export interface RecoveryReasonsAnalysis {
  clientId: string;
  reasons: string[];
  suggestedApproach: string;
  source: "AI" | "HEURISTIC";
}

export const clientRecovery = {
  list: (inactiveDays: InactiveDays, signal?: AbortSignal) =>
    apiRequest<{ clients: InactiveClient[] }>("/v1/clients/inactive", {
      query: { inactiveDays },
      signal,
    }),
  analyzeReasons: (clientId: string) =>
    apiRequest<RecoveryReasonsAnalysis>("/v1/clients/recovery/analyze-reasons", {
      method: "POST",
      body: { clientId },
    }),
  generate: (body: { clientId: string; campaignGoal: string; customOffer?: string }) =>
    apiRequest<{ message: string }>("/v1/clients/recovery/generate-message", {
      method: "POST",
      body,
    }),
  send: (body: { clientId: string; approvedMessage: string; approvalId: string }) =>
    apiRequest<{ messageId: string }>("/v1/clients/recovery/send", {
      method: "POST",
      body,
    }),
  connection: (signal?: AbortSignal) =>
    apiRequest<{ connected: boolean }>("/v1/clients/recovery/whatsapp-status", { signal }),
};
