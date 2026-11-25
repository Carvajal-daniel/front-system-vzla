import { apiRequest } from "@/lib/api-client";
import type {
  WhatsAppAssignedMode,
  WhatsAppConversationItem,
  WhatsAppConversationStatus,
  WhatsAppMessageItem,
} from "@/lib/whatsapp-inbox";

export type LeadTemperature = "HOT" | "WARM" | "COLD";

export type DetectedObjection =
  | "NONE"
  | "TIMING"
  | "SCHEDULE_FULL"
  | "PRICE"
  | "PAYMENT_METHOD"
  | "OTHER";

export interface ObjectionBreakdownItem {
  objection: Exclude<DetectedObjection, "NONE">;
  count: number;
  percentage: number;
}

export interface IntelligenceConversationItem {
  conversationId: string;
  clientId: string | null;
  contactName: string | null;
  phone: string;
  status: WhatsAppConversationStatus;
  assignedMode: WhatsAppAssignedMode;
  unreadCount: number;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  isStalled: boolean;
  hoursSinceLastMessage: number;
  hasInsight: boolean;
  leadTemperature: LeadTemperature;
  leadScore: number;
  summary: string;
  detectedObjection: DetectedObjection;
  recommendedNextAction: string;
  suggestedFollowupReply: string;
  analyzedAt: string | null;
}

export interface WhatsAppIntelligenceSummaryResponse {
  periodDays: number;
  kpis: {
    totalConversations: number;
    opportunities: number;
    convertedAppointments: number;
    conversionRate: number;
    stalledConversationsCount: number;
    hotLeadsCount: number;
    warmLeadsCount: number;
    coldLeadsCount: number;
  };
  funnel: {
    started: number;
    opportunities: number;
    hotLeads: number;
    converted: number;
  };
  objectionsBreakdown: ObjectionBreakdownItem[];
  conversations: IntelligenceConversationItem[];
}

export interface CopilotHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AskBusinessCopilotResponse {
  reply: string;
  provider: "OPENAI" | "GEMINI" | "LOCAL_ANALYTICS";
  suggestedFollowups: string[];
  metricsSummary: {
    companyName: string;
    referenceDate: string;
    revenueTodayCents: number;
    revenueMonthCents: number;
    openOrdersCount: number;
    appointmentsToday: number;
    pendingCommissionsCents: number;
    inactiveClients30d: number;
    whatsappConversionRatePercent: number;
    whatsappStalled24h: number;
  };
}

export const whatsappIntelligenceApi = {
  getSummary: (days = 30, signal?: AbortSignal) =>
    apiRequest<WhatsAppIntelligenceSummaryResponse>(
      `/v1/whatsapp/intelligence/summary?days=${encodeURIComponent(String(days))}`,
      { signal },
    ),

  sendFollowup: (conversationId: string, content?: string) =>
    apiRequest<{
      conversation: WhatsAppConversationItem;
      message: WhatsAppMessageItem;
    }>(
      `/v1/whatsapp/conversations/${encodeURIComponent(conversationId)}/followup`,
      {
        method: "POST",
        body: content?.trim() ? { content: content.trim() } : {},
      },
    ),
};

export const aiCopilotApi = {
  chat: (message: string, history?: CopilotHistoryMessage[]) =>
    apiRequest<AskBusinessCopilotResponse>("/v1/ai/copilot/chat", {
      method: "POST",
      body: {
        message,
        ...(history && history.length > 0 ? { history } : {}),
      },
    }),
};
