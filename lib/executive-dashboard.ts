import { apiRequest } from "@/lib/api-client";
import type { Currency } from "@/lib/types/finance";

export interface ExecutiveDashboardResponse {
  period: {
    from: string;
    to: string;
    timezone: string;
  };
  currency: Currency;
  revenueSplit: {
    avulsaRevenueInCents: number;
    clubMrrInCents: number;
    clubCollectedInCents: number;
    totalRevenueInCents: number;
    activeSubscribersCount: number;
    clubSharePercent: number;
  };
  depositConversion: {
    totalCharges: number;
    confirmedCharges: number;
    pendingCharges: number;
    expiredOrCanceledCharges: number;
    conversionRatePercent: number;
    totalDepositedInCents: number;
  };
  attendanceComparison: {
    subscribers: {
      completed: number;
      noShow: number;
      ratePercent: number | null;
    };
    avulsos: {
      completed: number;
      noShow: number;
      ratePercent: number | null;
    };
  };
  upcomingRenewals7Days: {
    totalCount: number;
    totalExpectedCents: number;
    items: Array<{
      subscriptionId: string;
      clientName: string;
      clientPhone: string;
      planName: string;
      priceCents: number;
      currentPeriodEnd: string;
      status: string;
      daysRemaining: number;
    }>;
  };
  rankings: {
    services: Array<{
      serviceId: string;
      serviceName: string;
      completedCount: number;
      totalCount: number;
      revenueInCents: number;
    }>;
    professionals: Array<{
      collaboratorId: string;
      name: string;
      avatarUrl: string | null;
      completedCount: number;
      revenueInCents: number;
    }>;
  };
}

export function getExecutiveDashboard(
  params?: { from?: string; to?: string },
  signal?: AbortSignal,
) {
  return apiRequest<ExecutiveDashboardResponse>("/finance/executive-dashboard", {
    query: params,
    signal,
  });
}
