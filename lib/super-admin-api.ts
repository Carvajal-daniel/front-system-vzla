import { apiRequest } from "@/lib/api-client";

export type SaasPlan = "ESSENTIAL" | "PRO" | "SCALE";
export type SaasStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export interface PlatformOverview {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalAppointments: number;
  activeVipSubscribers: number;
  totalTransactedCents: number;
  totalAiTurns: number;
  byPlan: Record<SaasPlan, number>;
  byStatus: Record<SaasStatus, number>;
}

export interface AdminTenantItem {
  id: string;
  companyName: string;
  slug: string;
  ownerName: string;
  email: string;
  phone: string;
  isActive: boolean;
  saasPlan: SaasPlan;
  saasStatus: SaasStatus;
  currency: string;
  timezone: string;
  paymentProvider: string;
  appointmentsCount: number;
  activeSubscribersCount: number;
  transactedCents: number;
  createdAt: string;
}

export interface AdminTenantDetails extends AdminTenantItem {
  monthlyAiQuota: number;
  collaboratorsCount: number;
  servicesCount: number;
  clientsCount: number;
  completedAppointmentsCount: number;
  totalAiTurns: number;
  paymentAccountLabel: string | null;
}

export function getPlatformOverview(signal?: AbortSignal) {
  return apiRequest<PlatformOverview>("/admin/overview", { signal });
}

export function listAdminTenants(
  filters?: {
    search?: string;
    saasPlan?: SaasPlan | "";
    saasStatus?: SaasStatus | "";
    isActive?: "" | "true" | "false";
  },
  signal?: AbortSignal,
) {
  const query: Record<string, string> = {};
  if (filters?.search?.trim()) query.search = filters.search.trim();
  if (filters?.saasPlan) query.saasPlan = filters.saasPlan;
  if (filters?.saasStatus) query.saasStatus = filters.saasStatus;
  if (filters?.isActive) query.isActive = filters.isActive;
  return apiRequest<AdminTenantItem[]>("/admin/tenants", { query, signal });
}

export function getAdminTenantDetails(companyId: string, signal?: AbortSignal) {
  return apiRequest<AdminTenantDetails>(`/admin/tenants/${encodeURIComponent(companyId)}`, {
    signal,
  });
}

export function updateAdminTenantStatus(
  companyId: string,
  payload: { isActive?: boolean; saasStatus?: SaasStatus; saasPlan?: SaasPlan },
) {
  return apiRequest<{
    id: string;
    companyName: string;
    isActive: boolean;
    saasPlan: SaasPlan;
    saasStatus: SaasStatus;
  }>(`/admin/tenants/${encodeURIComponent(companyId)}/status`, {
    method: "PATCH",
    body: payload,
  });
}
