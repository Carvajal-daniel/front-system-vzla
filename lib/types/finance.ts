import type { AppointmentStatus } from "@/lib/types/appointment";

export type Currency = "BRL" | "USD" | "VES";
export const paymentMethods = ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "TRANSFER", "OTHER"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
export type CommissionStatus = "NONE" | "AWAITING_COLLECTION" | "READY" | "PAID";

export const expenseCategories = ["STOCK_PURCHASE", "RENT", "UTILITIES", "MARKETING", "MAINTENANCE", "OTHER"] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];
export type ExpenseStatus = "PENDING" | "PAID" | "OVERDUE";
export type ExpenseType = "FIXED" | "VARIABLE";

export interface FinanceExpense {
  id: string;
  description: string;
  category: ExpenseCategory;
  expenseType: ExpenseType;
  amountCents: number;
  quantity: number;
  unitAmountCents: number | null;
  dueDate: string;
  paidAt: string | null;
  paidOn: string | null;
  paymentMethod: PaymentMethod | null;
  status: ExpenseStatus;
  isRecurring: boolean;
  notes: string | null;
  externalSourceType: string | null;
  externalSourceId: string | null;
}

export interface ExpenseSummary {
  totalCents: number;
  previousTotalCents: number;
  paidCents: number;
  pendingCents: number;
  overdueCents: number;
  cashPaidCents: number;
  byCategory: { category: ExpenseCategory; amountCents: number; cashPaidCents: number }[];
  items: FinanceExpense[];
}

export const commissionDeductionCategories = ["STOCK_PRODUCT", "ADVANCE", "OTHER"] as const;
export type CommissionDeductionCategory = (typeof commissionDeductionCategories)[number];

export interface CommissionDeduction {
  id: string;
  collaboratorId: string;
  description: string;
  category: CommissionDeductionCategory;
  quantity: number;
  unitAmountCents: number | null;
  amountCents: number;
  openAmountCents: number;
  deductedAt: string;
  notes: string | null;
  settlementId: string | null;
  externalSourceType: string | null;
}

export interface CommissionProfessional {
  collaboratorId: string;
  name: string;
  forecastInCents: number;
  awaitingCollectionInCents: number;
  payableInCents: number;
  paidInCents: number;
  deductionsInCents: number;
  netPayableInCents: number;
  deductions: CommissionDeduction[];
  appliedDeductions: { deduction: CommissionDeduction; amountCents: number; settlementId: string }[];
}

export interface CommissionReport {
  period: { from: string; to: string };
  professionals: CommissionProfessional[];
  settlements: {
    id: string;
    collaboratorId: string;
    collaboratorName: string;
    periodStart: string;
    periodEnd: string;
    amountCents: number;
    paymentMethod: PaymentMethod | null;
    paidAt: string;
    notes: string | null;
  }[];
}

export interface AppointmentPayment {
  collectedInCents: number;
  openInCents: number;
  historical: boolean;
  canCollect: boolean;
  commissionStatus: CommissionStatus;
}

export interface ReceiptMovement {
  id: string;
  amountInCents: number;
  method: PaymentMethod;
  effectiveOn: string;
  recordedAt: string;
  reversesReceiptId: string | null;
  reason: string | null;
}

export interface ReceiptList {
  items: (ReceiptMovement & { appointmentId: string; serviceName: string; clientName: string; currency: Currency })[];
  hasMore: boolean;
}

export interface CashMovementList {
  items: (Pick<ReceiptMovement, "id" | "amountInCents" | "method" | "effectiveOn"> & {
    appointmentId: string | null;
    clientName: string | null;
    serviceName: string;
    currency: Currency;
    reversal: boolean;
  })[];
  hasMore: boolean;
}

export interface AppointmentCollections extends AppointmentPayment {
  appointmentId: string;
  status: AppointmentStatus;
  clientName: string;
  serviceName: string;
  currency: Currency;
  netInCents: number;
  retainedInCents: number;
  generatedCommissionInCents: number | null;
  commissionPaidAt: string | null;
  receipts: (ReceiptMovement & { refundableInCents: number })[];
}

interface CashDay {
  date: string;
  method: PaymentMethod;
  collectedInCents: number;
}

export interface CollectionSummary {
  openedOn: string;
  collectedInCents: number;
  previousCollectedInCents: number;
  productSalesInCents: number;
  cashCommissionsInCents: number;
  outstandingInCents: number;
  paidByMethod: Partial<Record<PaymentMethod, number>>;
  awaitingCommissionInCents: number;
  generatedCommissionInCents: number;
  readyCommissionInCents: number;
  paidCommissionInCents: number;
  currentCashDays: CashDay[];
  previousCashDays: CashDay[];
}

export interface FinanceTotals {
  realizedRevenueInCents: number;
  forecastRevenueInCents: number;
  totalProjectedRevenueInCents: number;
  realizedCommissionsInCents: number;
  forecastCommissionsInCents: number;
  netProfitRealizedInCents: number;
  realNetProfitInCents: number | null;
  netProfitProjectedInCents: number;
  completedCount: number;
  confirmedCount: number;
  pendingCount: number;
  canceledCount: number;
  noShowCount: number;
}

export interface FinanceDay {
  date: string;
  realizedInCents: number;
  forecastInCents: number;
  commissionsInCents: number;
  appointmentsCount: number;
}

export interface FinanceCollaborator {
  collaboratorId: string;
  name: string;
  specialty: string;
  avatarUrl: string | null;
  completedCount: number;
  upcomingCount: number;
  realizedRevenueInCents: number;
  averageCommissionPercentage: number | null;
  commissionToPayInCents: number;
  deductionsInCents: number;
  netPayableInCents: number;
  forecastCommissionInCents: number;
  awaitingCommissionInCents: number;
  readyCommissionInCents: number;
  paidCommissionInCents: number;
}

export interface FinanceAppointment {
  id: string;
  collaboratorId: string;
  collaboratorName: string | null;
  startsAt: string;
  status: AppointmentStatus;
  clientName: string;
  serviceName: string;
  grossInCents: number;
  commissionPercentage: number;
  commissionInCents: number;
  netInCents: number;
  payment: AppointmentPayment & { netInCents: number };
}

export interface FinanceSummaryResponse {
  period: { from: string; to: string; timezone: string; collaboratorId: string | null };
  currency: Currency;
  collections: CollectionSummary;
  expenses: ExpenseSummary | null;
  outflowCashDays: { date: string; expensesCents: number; commissionsCents: number }[];
  insights: {
    overdueCount: number;
    dueSoonCount: number;
    payableCommissionInCents: number;
    unsettledCommissionInCents: number;
    netPayableCommissionInCents: number;
    expensesAsRevenuePercent: number | null;
  };
  summary: FinanceTotals;
  comparison: { from: string; to: string; summary: FinanceTotals };
  series: FinanceDay[];
  professionals: { id: string; name: string }[];
  byCollaborator: FinanceCollaborator[];
  byService: {
    serviceId: string;
    serviceName: string;
    count: number;
    revenueInCents: number;
    realizedInCents: number;
    realizedCount: number;
  }[];
  appointments: FinanceAppointment[];
}
