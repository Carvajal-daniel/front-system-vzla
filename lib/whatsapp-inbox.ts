import { apiRequest } from "@/lib/api-client";

export type WhatsAppConversationStatus =
  | "OPEN"
  | "WAITING_CLIENT"
  | "CONVERTED"
  | "ARCHIVED";

export type WhatsAppAssignedMode = "AI_AUTOPILOT" | "HUMAN";

export interface WhatsAppConversationItem {
  id: string;
  companyId: string;
  clientId: string | null;
  phone: string;
  contactName: string | null;
  status: WhatsAppConversationStatus;
  assignedMode: WhatsAppAssignedMode;
  unreadCount: number;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview?: string | null;
}

export interface AiExecutedToolAction {
  tool:
    | "listar_servicos_e_profissionais"
    | "consultar_horarios_livres"
    | "criar_agendamento"
    | "reagendar_agendamento"
    | "cancelar_agendamento";
  input: Record<string, unknown>;
  ok: boolean;
  summary: string;
  data?: unknown;
}

export interface WhatsAppMessageItem {
  id: string;
  companyId: string;
  conversationId: string;
  externalMessageId: string | null;
  direction: "INBOUND" | "OUTBOUND";
  senderType: "CLIENT" | "AI_AGENT" | "OWNER";
  content: string;
  metadata: {
    aiProvider?: string;
    actions?: AiExecutedToolAction[];
    deliveryProvider?: string;
    deliveryError?: string;
    kind?: string;
    [key: string]: unknown;
  };
  sentAt: string;
}

export interface SimulateInboundResponse {
  duplicated: boolean;
  conversation: WhatsAppConversationItem;
  inboundMessage: WhatsAppMessageItem;
  outboundMessage: WhatsAppMessageItem | null;
  aiScheduled: boolean;
  aiActions: AiExecutedToolAction[];
}

export const whatsappInboxApi = {
  listConversations: (
    params?: {
      search?: string;
      assignedMode?: WhatsAppAssignedMode | "ALL";
    },
    signal?: AbortSignal,
  ) => {
    const query = new URLSearchParams();
    if (params?.search?.trim()) query.set("search", params.search.trim());
    if (params?.assignedMode && params.assignedMode !== "ALL") {
      query.set("assignedMode", params.assignedMode);
    }
    const qs = query.toString();
    return apiRequest<{ conversations: WhatsAppConversationItem[] }>(
      `/v1/whatsapp/conversations${qs ? `?${qs}` : ""}`,
      { signal },
    );
  },

  getMessages: (conversationId: string, signal?: AbortSignal) =>
    apiRequest<{
      conversation: WhatsAppConversationItem;
      messages: WhatsAppMessageItem[];
    }>(`/v1/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages`, {
      signal,
    }),

  sendOwnerMessage: (conversationId: string, content: string) =>
    apiRequest<{
      conversation: WhatsAppConversationItem;
      message: WhatsAppMessageItem;
    }>(`/v1/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      body: { content },
    }),

  updateMode: (conversationId: string, assignedMode: WhatsAppAssignedMode) =>
    apiRequest<{ conversation: WhatsAppConversationItem }>(
      `/v1/whatsapp/conversations/${encodeURIComponent(conversationId)}/mode`,
      {
        method: "PATCH",
        body: { assignedMode },
      },
    ),

  simulateInbound: (body: {
    phone: string;
    contactName?: string;
    content: string;
  }) =>
    apiRequest<SimulateInboundResponse>("/v1/whatsapp/simulator/inbound", {
      method: "POST",
      body,
    }),
};
