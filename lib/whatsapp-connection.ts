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

export const WHATSAPP_CONNECTION_UPDATED_EVENT =
  "cloudgo-whatsapp-connection-updated";

export function notifyWhatsAppConnectionUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(WHATSAPP_CONNECTION_UPDATED_EVENT));
  }
}

export const whatsappConnectionApi = {
  get: (signal?: AbortSignal) =>
    apiRequest<WhatsAppConnectionState>("/v1/whatsapp/connection", { signal }),

  connectEvolution: () =>
    apiRequest<ConnectEvolutionResponse>("/v1/whatsapp/evolution/connect", {
      method: "POST",
    }),

  disconnectEvolution: () =>
    apiRequest<{ status: "DISCONNECTED" }>("/v1/whatsapp/evolution/disconnect", {
      method: "POST",
    }),

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
