
import { apiRequest, ApiError } from "@/lib/api-client";

export const paymentProviders = ["NONE", "ASAAS", "MERCADO_PAGO", "SANDBOX"] as const;
export type PaymentProvider = (typeof paymentProviders)[number];
export const providerLabels: Record<PaymentProvider, string> = {
  NONE: "Sem gateway",
  ASAAS: "Asaas",
  MERCADO_PAGO: "Mercado Pago",
  SANDBOX: "Sandbox",
};

export interface GatewaySettings {
  paymentProvider: PaymentProvider;
  staticPixKey: string | null;
  hasProviderApiKey: boolean;
  hasWebhookToken: boolean;
  webhookPath?: string;
}

export interface ClubPlan {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  billingCycle: "MONTHLY";
  includedServiceIds: string[];
  allowedDaysOfWeek: number[] | null;
  gracePeriodDays: number;
  maxMonthlyUses: number | null;
  active: boolean;
}

export const subscriberStatuses = ["ACTIVE", "PAST_DUE", "SUSPENDED", "PENDING_PAYMENT", "CANCELED"] as const;
export type SubscriberStatus = (typeof subscriberStatuses)[number];

export interface ClubSubscription {
  id: string;
  clientId: string;
  planId: string;
  clientName?: string;
  planName?: string;
  paymentMethod: "PIX" | "CREDIT_CARD";
  paymentProvider: Exclude<PaymentProvider, "NONE">;
  status: SubscriberStatus;
  currentPeriodEnd: string | null;
  checkoutUrl: string | null;
}

export interface BillingClient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

export function getBillingClients(signal?: AbortSignal, search?: string) {
  return apiRequest<{ clients: BillingClient[] }>("/v1/clients", { query: { search }, signal }).then(({ clients }) => clients);
}

export interface PixRequest {
  referenceType: "ORDER" | "SUBSCRIPTION";
  referenceId: string;
  clientId: string;
  document?: string;
}

export interface PixChargeStatus {
  id: string;
  status: "PENDING" | "CONFIRMED" | "EXPIRED" | "CANCELED";
  expiresAt: string | null;
}

export interface PixCharge extends PixChargeStatus {
  amountCents: number;
  paymentProvider: PaymentProvider;
  pixQrCodeBase64: string | null;
  pixCopyPaste: string | null;
}

export function paymentError(error: unknown, fallback: string) {
  return error instanceof ApiError && error.status > 0 && error.status < 500
    ? error.message
    : fallback;
}

export function billingDocument(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 || digits.length === 14 ? digits : undefined;
}
