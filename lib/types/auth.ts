import type { Currency } from "./finance";

export type UserRole = "OWNER" | "COLLABORATOR";

export interface AuthUserSummary {
  id: string;
  companyId: string;
  role: UserRole;
  name: string;
  email: string;
  companyName: string;
}

export interface CompanyOperatingDaySchedule {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  shifts?: { start: string; end: string }[];
}

export interface Company {
  id: string;
  companyName: string;
  timezone: string;
  currency: Currency;
  isActive: boolean;
  avatarUrl?: string | null;
  operatingDays?: string | null;
  operatingSchedule?: CompanyOperatingDaySchedule[] | null;
}

/**
 * Contrato exato de GET /me na API Fastify.
 */
export interface MeResponse {
  role: UserRole;
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string | null;
  specialty?: string;
  commissionPercentage?: number;
  isActive: boolean;
  company: Company;
}

/**
 * Contrato exato de POST /auth/login e POST /auth/register na API Fastify.
 */
export interface AuthTokenResponse {
  accessToken: string;
  token?: string;
  tokenType: "Bearer";
  expiresIn: string;
  user: AuthUserSummary;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  companyName: string;
  name: string;
  phone: string;
  email: string;
  password: string;
  timezone?: string;
}

export interface UpdateCompanyTimezoneResponse {
  companyId: string;
  timezone: string;
}
