import { apiRequest, getApiBaseUrl } from "@/lib/api-client";
import { getStoredToken, notifyUnauthorized } from "@/lib/auth";
import type { CopilotHistoryMessage } from "@/lib/whatsapp-intelligence";

export type IntelligenceModule =
  | "AGENDA"
  | "FINANCE"
  | "CLIENTS"
  | "SERVICES"
  | "INVENTORY"
  | "TEAM";

export type ProactiveInsightModule = "WHATSAPP" | IntelligenceModule;
export type ProactiveInsightStatus = "PENDING" | "EXECUTED" | "DISMISSED";

export interface ProactiveInsightItem {
  id: string;
  tenantId: string;
  module: ProactiveInsightModule;
  type: string;
  title: string;
  description: string;
  impactLabel: string | null;
  actionPayload: Record<string, unknown> | null;
  status: ProactiveInsightStatus;
  expiresAt: string | null;
  createdAt: string;
}

export interface ListProactiveInsightsResponse {
  insights: ProactiveInsightItem[];
  pendingCount: number;
}

export interface RefreshProactiveInsightsResponse {
  tenantId: string;
  createdCount: number;
  skippedDuplicateCount: number;
  insights: ProactiveInsightItem[];
}

export interface ExecuteProactiveInsightResponse {
  insight: ProactiveInsightItem;
  dispatchedMessagesCount: number;
  skippedQuotaCount: number;
}

export interface ModuleAnalysisInsightItem {
  title: string;
  detail: string;
  severity: "INFO" | "OPPORTUNITY" | "WARNING";
}

export interface ModuleAnalysisResponse {
  module: IntelligenceModule;
  headline: string;
  insights: ModuleAnalysisInsightItem[];
  recommendedAction: string;
  provider: "GEMINI" | "LOCAL_ANALYTICS";
}

export interface BillingUsageSummaryResponse {
  planName: string;
  periodMonth: string;
  aiSessions: {
    used: number;
    limit: number;
    percentage: number;
  };
  outboundMessages: {
    used: number;
    limit: number;
    percentage: number;
  };
  isBlocked: boolean;
}

export const OPEN_COPILOT_EVENT = "atelier:open-copilot";
export const INSIGHTS_UPDATED_EVENT = "atelier:intelligence-insights-updated";

export interface OpenCopilotEventDetail {
  prompt?: string;
  module?: IntelligenceModule;
}

export function openContextualCopilot(detail?: OpenCopilotEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_COPILOT_EVENT, { detail }));
}

export function notifyIntelligenceInsightsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INSIGHTS_UPDATED_EVENT));
}

export function resolveModuleFromPathname(
  pathname: string,
): IntelligenceModule | undefined {
  if (
    pathname === "/owner/agenda" ||
    pathname.startsWith("/owner/appointments") ||
    pathname.startsWith("/owner/blocks")
  ) {
    return "AGENDA";
  }
  if (pathname.startsWith("/owner/finance")) {
    return "FINANCE";
  }
  if (pathname.startsWith("/owner/clients")) {
    return "CLIENTS";
  }
  if (pathname.startsWith("/owner/services")) {
    return "SERVICES";
  }
  if (pathname.startsWith("/owner/inventory")) {
    return "INVENTORY";
  }
  if (
    pathname.startsWith("/owner/team") ||
    pathname.startsWith("/owner/collaborators")
  ) {
    return "TEAM";
  }
  return undefined;
}

export const intelligenceApi = {
  listInsights: (
    params?: {
      module?: ProactiveInsightModule;
      status?: ProactiveInsightStatus;
      limit?: number;
    },
    signal?: AbortSignal,
  ) =>
    apiRequest<ListProactiveInsightsResponse>("/v1/intelligence/insights", {
      query: {
        module: params?.module,
        status: params?.status,
        limit: params?.limit,
      },
      signal,
    }),

  refreshInsights: () =>
    apiRequest<RefreshProactiveInsightsResponse>(
      "/v1/intelligence/insights/refresh",
      { method: "POST" },
    ),

  executeInsight: (insightId: string, overrideMessage?: string) =>
    apiRequest<ExecuteProactiveInsightResponse>(
      `/v1/intelligence/insights/${encodeURIComponent(insightId)}/execute`,
      {
        method: "POST",
        body: overrideMessage?.trim()
          ? { overrideMessage: overrideMessage.trim() }
          : {},
      },
    ),

  dismissInsight: (insightId: string) =>
    apiRequest<{ insight: ProactiveInsightItem }>(
      `/v1/intelligence/insights/${encodeURIComponent(insightId)}/dismiss`,
      { method: "POST" },
    ),

  analyzeModule: (module: IntelligenceModule, signal?: AbortSignal) =>
    apiRequest<ModuleAnalysisResponse>(
      `/v1/intelligence/modules/${encodeURIComponent(module)}/analyze`,
      { method: "POST", signal },
    ),

  getBillingUsage: (signal?: AbortSignal) =>
    apiRequest<BillingUsageSummaryResponse>("/v1/billing/usage", { signal }),

  // Consome POST /v1/intelligence/copilot/stream via Server-Sent Events (SSE) palavra por palavra.
  async streamCopilot(params: {
    message: string;
    currentModule?: IntelligenceModule;
    history?: CopilotHistoryMessage[];
    onChunk: (chunk: string) => void;
    signal?: AbortSignal;
  }): Promise<void> {
    const token = getStoredToken();
    const headers = new Headers({
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    });
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(
      `${getApiBaseUrl()}/v1/intelligence/copilot/stream`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: params.message,
          ...(params.currentModule
            ? { currentModule: params.currentModule }
            : {}),
          ...(params.history && params.history.length > 0
            ? { history: params.history }
            : {}),
        }),
        signal: params.signal,
        cache: "no-store",
      },
    );

    if (response.status === 401) {
      notifyUnauthorized();
      throw new Error("Sessão expirada.");
    }

    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const jsonPart = line.slice(5).trim();
        if (!jsonPart) continue;
        try {
          const parsed = JSON.parse(jsonPart) as {
            chunk?: string;
            done?: boolean;
            error?: string;
          };
          if (typeof parsed.chunk === "string" && parsed.chunk.length > 0) {
            params.onChunk(parsed.chunk);
          }
          if (parsed.error) {
            throw new Error(parsed.error);
          }
        } catch (err) {
          if (err instanceof SyntaxError) {
            continue;
          }
          throw err;
        }
      }
    }
  },
};
