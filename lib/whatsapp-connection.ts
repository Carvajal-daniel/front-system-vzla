import { apiRequest } from "@/lib/api-client";

export type EvolutionConnectionStatus =
  | "DISCONNECTED"
  | "QRCODE_PENDING"
  | "CONNECTED";

export type DatafyConnectionStatus = "DISCONNECTED" | "CONNECTED";

export interface WhatsAppConnectionState {
  companyId: string;
  evolution: {
    instanceName: string;
    status: EvolutionConnectionStatus;
    phoneNumber: string | null;
    mode: "LIVE" | "MOCK_READY";
  };
  datafy: {
    enabled: boolean;
    instanceId: string | null;
    hasApiToken: boolean;
    status: DatafyConnectionStatus;
  };
  settings: {
    aiAutopilotEnabled: boolean;
    aiSystemPrompt: string | null;
  };
  updatedAt: string;
}

export interface ConnectEvolutionResponse {
  instanceName: string;
  status: EvolutionConnectionStatus;
  qrCodeBase64: string | null;
  pairingCode: string | null;
  phoneNumber: string | null;
  mode: "LIVE" | "MOCK_READY";
}

export interface TenantWhatsAppChannelStatusDTO {
  id: string;
  provider: "EVOLUTION" | "META_OFFICIAL" | "MOCK";
  purpose: "ALL" | "RECEPTION_ONLY" | "CAMPAIGNS_ONLY";
  phoneNumber: string | null;
  status: EvolutionConnectionStatus;
  credentials: {
    instanceName?: string;
    phoneNumberId?: string;
    wabaId?: string;
    hasAccessToken?: boolean;
    accessTokenMasked?: string;
    hasApiKey?: boolean;
    apiKeyMasked?: string;
  };
  updatedAt: string;
}

export interface WhatsAppChannelsStatusResponse {
  channels: TenantWhatsAppChannelStatusDTO[];
  mode: "LIVE" | "MOCK_READY";
}

export const WHATSAPP_CONNECTION_UPDATED_EVENT =
  "cloudgo-whatsapp-connection-updated";

export interface WhatsAppConnectionUpdatedDetail {
  status?: EvolutionConnectionStatus;
}

// Dispara evento global para manter a Sidebar e a tela de configurações sincronizadas imediatamente.
export function notifyWhatsAppConnectionUpdated(
  status?: EvolutionConnectionStatus,
): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<WhatsAppConnectionUpdatedDetail>(
        WHATSAPP_CONNECTION_UPDATED_EVENT,
        {
          detail: status ? { status } : {},
        },
      ),
    );
  }
}

export const whatsappConnectionApi = {
  get: (signal?: AbortSignal) =>
    apiRequest<WhatsAppConnectionState>("/v1/whatsapp/connection", { signal }),

  getChannelsStatus: (signal?: AbortSignal) =>
    apiRequest<WhatsAppChannelsStatusResponse>("/v1/whatsapp/channels/status", {
      signal,
    }),

  connectEvolution: () =>
    apiRequest<ConnectEvolutionResponse>(
      "/v1/whatsapp/channels/evolution/connect",
      {
        method: "POST",
      },
    ),

  disconnectEvolution: () =>
    apiRequest<{ status: "DISCONNECTED" }>(
      "/v1/whatsapp/channels/evolution/disconnect",
      {
        method: "POST",
      },
    ),

  saveDatafy: (body: {
    enabled?: boolean;
    datafyInstanceId?: string | null;
    datafyApiToken?: string | null;
  }) =>
    apiRequest<WhatsAppConnectionState>("/v1/whatsapp/datafy", {
      method: "PATCH",
      body,
    }),

  saveSettings: (body: {
    aiAutopilotEnabled?: boolean;
    aiSystemPrompt?: string | null;
  }) =>
    apiRequest<WhatsAppConnectionState>("/v1/whatsapp/settings", {
      method: "PATCH",
      body,
    }),
};
