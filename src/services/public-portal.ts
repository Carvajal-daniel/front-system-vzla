import { ApiError, apiRequest } from "@/lib/api-client";

export type PublicPaymentStatus = "PENDING" | "CONFIRMED" | "EXPIRED" | "CANCELED";

export type WaitlistShift = "MORNING" | "AFTERNOON" | "EVENING" | "ANY";

export interface PublicCompanyAddress {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  formatted?: string | null;
}

export interface PublicCompanyAppearance {
  palette?: string | null;
  theme?: string | null;
  primaryColor?: string | null;
  [key: string]: unknown;
}

export interface PublicPortalCompany {
  id: string;
  companyName: string;
  slug: string;
  phone: string | null;
  whatsapp: string | null;
  timezone: string;
  currency: string;
  avatarUrl: string | null;
  description: string | null;
  address: string | PublicCompanyAddress | null;
  appearance: string | PublicCompanyAppearance | null;
  operatingDays: Array<number | string> | null;
  operatingSchedule: Record<string, unknown> | unknown[] | null;
}

export interface PublicDepositPolicy {
  enabled: boolean;
  depositPercentage: number;
  autoRefundHours: number | null;
  noShowPolicy: string | null;
  hasActivePaymentProvider: boolean;
}

export interface PublicServiceCollaborator {
  id: string;
  name: string;
  specialty: string | null;
  avatarUrl: string | null;
}

export interface PublicPortalService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceInCents: number;
  imageUrl: string | null;
  collaborators: PublicServiceCollaborator[];
}

export interface PublicClubPlan {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  billingCycle: string;
  includedServiceIds: string[];
  maxMonthlyUses: number | null;
  allowedDaysOfWeek: Array<number | string> | null;
  gracePeriodDays: number | null;
}

export interface PublicPortalResponse {
  company: PublicPortalCompany;
  depositPolicy: PublicDepositPolicy;
  services: PublicPortalService[];
  clubPlans: PublicClubPlan[];
}

export interface PublicAvailabilitySlot {
  collaboratorId: string;
  collaboratorName: string;
  startsAt: string;
  endsAt: string;
}

export interface PublicAvailabilityResponse {
  companyId: string;
  serviceId: string;
  date: string;
  timezone: string;
  slotStepMinutes: number;
  serviceDurationMinutes: number;
  slots: PublicAvailabilitySlot[];
}

export interface PublicCustomerSubscription {
  planId: string;
  planName: string;
  status: string;
  includedServiceIds: string[];
  allowedDaysOfWeek: Array<number | string> | null;
  maxMonthlyUses: number | null;
  remainingUses: number | null;
  exemptsServicePrice: boolean;
  exemptsDeposit: boolean;
}

export interface PublicIdentifyRequest {
  phone: string;
  name?: string;
}

export interface PublicIdentifyResponse {
  recognized: boolean;
  customerName: string | null;
  isSubscriber: boolean;
  subscription: PublicCustomerSubscription | null;
}

export interface PublicPaymentChargeDTO {
  paymentId: string;
  amountCents: number;
  status: PublicPaymentStatus;
  qrCodeBase64: string | null;
  copyPaste: string | null;
  checkoutUrl: string | null;
  expiresAt: string | null;
}

export interface PublicAppointmentPayload {
  serviceId: string;
  collaboratorId: string;
  startsAt: string;
  clientName: string;
  clientPhone: string;
  document?: string;
}

export interface PublicAppointmentRecord {
  id: string;
  status: string;
  startsAt: string;
  endsAt?: string;
  serviceId?: string;
  collaboratorId?: string;
  serviceName?: string;
  collaboratorName?: string;
  priceInCents?: number;
  totalPriceInCents?: number;
}

export interface PublicAppointmentResponse {
  appointment: PublicAppointmentRecord;
  cancellationToken: string | null;
  coveredByClub: boolean;
  requiresDeposit: boolean;
  payment: PublicPaymentChargeDTO | null;
}

export interface PublicClubSubscribePayload {
  customerName: string;
  customerPhone: string;
  planId: string;
  document?: string;
}

export interface PublicClubSubscribeResponse {
  subscriptionId: string;
  planId: string;
  status: string;
  payment: PublicPaymentChargeDTO;
}

export interface PublicWaitlistPayload {
  customerName: string;
  customerPhone: string;
  desiredDate: string;
  collaboratorId?: string;
  preferredShift: WaitlistShift;
}

export interface PublicWaitlistResponse {
  id: string;
  desiredDate: string;
  preferredShift: WaitlistShift;
  collaboratorId: string | null;
  collaboratorName: string | null;
  status: string;
  createdAt: string;
}

export interface PublicPaymentStatusResponse {
  paymentId: string;
  status: PublicPaymentStatus;
  expiresAt: string | null;
  paidAt: string | null;
}

export interface PublicCompanySlugResponse {
  slug: string;
}

function portalBasePath(slug: string): string {
  return `/public/${encodeURIComponent(slug)}`;
}

/**
 * Consulta o slug público da empresa a partir do UUID legado para redirecionamento.
 */
export function getPublicCompanySlug(
  companyId: string,
  signal?: AbortSignal,
): Promise<PublicCompanySlugResponse> {
  return apiRequest<PublicCompanySlugResponse>(
    `/public/companies/${encodeURIComponent(companyId)}/slug`,
    {
      method: "GET",
      auth: false,
      signal,
    },
  );
}

/**
 * Busca os dados iniciais do portal público (estabelecimento, política de sinal,
 * serviços habilitados e planos do Clube VIP).
 */
export function getPublicPortal(
  slug: string,
  signal?: AbortSignal,
): Promise<PublicPortalResponse> {
  return apiRequest<PublicPortalResponse>(portalBasePath(slug), {
    method: "GET",
    auth: false,
    signal,
  });
}

/**
 * Consulta os horários livres para um serviço e data específicos.
 * Quando collaboratorId é omitido, retorna disponibilidade de qualquer profissional habilitado.
 */
export function getPublicAvailability(
  slug: string,
  params: {
    serviceId: string;
    date: string;
    collaboratorId?: string;
  },
  signal?: AbortSignal,
): Promise<PublicAvailabilityResponse> {
  return apiRequest<PublicAvailabilityResponse>(
    `${portalBasePath(slug)}/availability`,
    {
      method: "GET",
      auth: false,
      query: {
        serviceId: params.serviceId,
        date: params.date,
        collaboratorId: params.collaboratorId,
      },
      signal,
    },
  );
}

/**
 * Identifica o cliente pelo telefone e verifica se possui assinatura ativa no Clube VIP.
 */
export function identifyPublicCustomer(
  slug: string,
  body: PublicIdentifyRequest,
  signal?: AbortSignal,
): Promise<PublicIdentifyResponse> {
  return apiRequest<PublicIdentifyResponse>(
    `${portalBasePath(slug)}/identify`,
    {
      method: "POST",
      auth: false,
      body,
      signal,
    },
  );
}

/**
 * Cria o agendamento público. Pode retornar confirmação direta ou cobrança Pix de sinal.
 */
export function createPublicAppointment(
  slug: string,
  body: PublicAppointmentPayload,
  signal?: AbortSignal,
): Promise<PublicAppointmentResponse> {
  return apiRequest<PublicAppointmentResponse>(
    `${portalBasePath(slug)}/appointments`,
    {
      method: "POST",
      auth: false,
      body,
      signal,
    },
  );
}

/**
 * Inicia a adesão de um cliente a um plano do Clube VIP retornando a cobrança Pix.
 */
export function subscribePublicClub(
  slug: string,
  body: PublicClubSubscribePayload,
  signal?: AbortSignal,
): Promise<PublicClubSubscribeResponse> {
  return apiRequest<PublicClubSubscribeResponse>(
    `${portalBasePath(slug)}/club/subscribe`,
    {
      method: "POST",
      auth: false,
      body,
      signal,
    },
  );
}

/**
 * Registra o cliente na Fila de Espera Inteligente para uma data sem horários livres.
 */
export function joinPublicWaitlist(
  slug: string,
  body: PublicWaitlistPayload,
  signal?: AbortSignal,
): Promise<PublicWaitlistResponse> {
  return apiRequest<PublicWaitlistResponse>(
    `${portalBasePath(slug)}/waitlist`,
    {
      method: "POST",
      auth: false,
      body,
      signal,
    },
  );
}

/**
 * Consulta o status atual de uma cobrança Pix pública para polling em tempo real.
 */
export function getPublicPaymentStatus(
  slug: string,
  paymentId: string,
  signal?: AbortSignal,
): Promise<PublicPaymentStatusResponse> {
  return apiRequest<PublicPaymentStatusResponse>(
    `${portalBasePath(slug)}/payments/${encodeURIComponent(paymentId)}/status`,
    {
      method: "GET",
      auth: false,
      signal,
    },
  );
}

/**
 * Formata endereço da empresa aceitando tanto string pronta quanto objeto estruturado.
 */
export function formatCompanyAddress(
  address: PublicPortalCompany["address"],
): string | null {
  if (!address) return null;
  if (typeof address === "string") {
    const trimmed = address.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof address.formatted === "string" && address.formatted.trim().length > 0) {
    return address.formatted.trim();
  }

  const streetPart = [address.street, address.number]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(", ");
  const cityState = [address.city, address.state]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" - ");
  const parts = [
    streetPart,
    address.complement,
    address.neighborhood,
    cityState,
  ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  return parts.length > 0 ? parts.join(" • ") : null;
}

/**
 * Extrai mensagem amigável em pt-BR para erros da API pública,
 * tratando especificamente conflitos 409 (gateway indisponível ou horário ocupado).
 */
export function getPublicPortalErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      if (error.code === "PAYMENT_PROVIDER_UNAVAILABLE") {
        return "O pagamento online via Pix está temporariamente indisponível neste estabelecimento. Entre em contato pelo WhatsApp para concluir seu agendamento.";
      }
      if (
        error.message &&
        !error.message.startsWith("HTTP ")
      ) {
        return error.message;
      }
      return "Este horário acabou de ser reservado por outro cliente. Escolha outro horário disponível.";
    }
    if (error.status === 0 || error.code === "NETWORK_ERROR") {
      return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
    }
    if (error.message && !error.message.startsWith("HTTP ")) {
      return error.message;
    }
  }
  return fallback;
}
