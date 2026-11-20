export interface FinanceSummaryResponse {
  period: {
    from: string;
    to: string;
    timezone: string;
  };
  summary: {
    realizedRevenueInCents: number;
    forecastRevenueInCents: number;
    totalProjectedRevenueInCents: number;
    realizedCommissionsInCents: number;
    forecastCommissionsInCents: number;
    netProfitRealizedInCents: number;
    netProfitProjectedInCents: number;
    completedCount: number;
    confirmedCount: number;
    pendingCount: number;
    canceledCount: number;
    noShowCount: number;
  };
  series: Array<{
    date: string;
    realizedInCents: number;
    forecastInCents: number;
    appointmentsCount: number;
  }>;
  byCollaborator: Array<{
    collaboratorId: string;
    name: string;
    specialty: string;
    avatarUrl: string | null;
    completedCount: number;
    upcomingCount: number;
    realizedRevenueInCents: number;
    commissionToPayInCents: number;
    forecastCommissionInCents: number;
  }>;
  byService: Array<{
    serviceName: string;
    count: number;
    revenueInCents: number;
  }>;
}
