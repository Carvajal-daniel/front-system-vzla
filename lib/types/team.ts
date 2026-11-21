import { apiRequest, getApiBaseUrl } from "@/lib/api-client";

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type CollaboratorStatus = "ACTIVE" | "INACTIVE";

export interface CompanyRankingWeights {
  servicesRevenueWeight: number;
  productsSalesWeight: number;
  appointmentsVolumeWeight: number;
  clientReviewsWeight: number;
  punctualityRetentionWeight: number;
}

export interface RankingPillarsBreakdown {
  servicesRevenueScore: number;
  productsSalesScore: number;
  appointmentsVolumeScore: number;
  clientReviewsScore: number;
  punctualityRetentionScore: number;
}

export interface CloseMonthAwardResponse {
  id: string;
  companyId: string;
  collaboratorId: string;
  collaboratorName: string;
  title: string;
  referenceMonth: string;
  score: number;
  createdAt: string;
}

export interface TeamKpis {
  totalCollaborators: number;
  activeCollaborators: number;
  totalCompletedAppointmentsMonth: number;
  totalRevenueMonthInCents: number;
  averageTeamRating: number;
}

export interface Collaborator {
  id: string;
  companyId?: string;
  name: string;
  email: string;
  phone: string;
  whatsapp?: string | null;
  specialty: string;
  bio?: string | null;
  commissionPercentage: number;
  defaultCommissionRate?: number;
  monthlyRevenueGoal?: number | null;
  status?: CollaboratorStatus;
  isActive: boolean;
  avatarUrl?: string | null;
  role?: "COLLABORATOR";
  hiredAt?: string;
  deactivatedAt?: string | null;
  deactivationReason?: string | null;
  // Métricas mensais e ranking retornados pelo endpoint enriquecido GET /collaborators
  completedAppointmentsMonth?: number;
  servicesRevenueMonthInCents?: number;
  productsSalesMonthInCents?: number;
  productsSoldCountMonth?: number;
  revenueMonthInCents?: number;
  commissionMonthInCents?: number;
  averageRating?: number;
  totalReviews?: number;
  rankingPosition?: number;
  rankingScore?: number;
  rankingPillars?: RankingPillarsBreakdown;
  awardsCount?: number;
}

export interface CollaboratorsListResponse {
  teamKpis?: TeamKpis;
  collaborators: Collaborator[];
}

export interface CreateCollaboratorPayload {
  name: string;
  email: string;
  password: string;
  phone: string;
  whatsapp?: string | null;
  specialty: string;
  bio?: string | null;
  commissionPercentage: number;
  defaultCommissionRate?: number;
  monthlyRevenueGoal?: number | null;
}

export interface UpdateCollaboratorStatusPayload {
  isActive: boolean;
}

export interface WorkScheduleSlot {
  dayOfWeek: DayOfWeek;
  isWorkingDay: boolean;
  startTime: string | null;
  endTime: string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
}

export interface UpdateWorkSchedulesPayload {
  schedules: WorkScheduleSlot[];
}

export interface CollaboratorReview {
  id: string;
  clientName: string;
  serviceName: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface CollaboratorAward {
  id: string;
  title: string;
  referenceMonth: string;
  score: number;
  createdAt: string;
}

export interface CollaboratorLinkedService {
  serviceId: string;
  name: string;
  priceInCents: number;
  durationMinutes: number;
  customCommissionRate: number | null;
  effectiveCommissionRate: number;
}

export interface CollaboratorProfileDossier {
  collaborator: Collaborator;
  tenureFormatted: string;
  tenureMonths: number;
  ranking: {
    totalScore: number;
    position: number;
    totalInCompany: number;
    weights?: CompanyRankingWeights;
    pillars: RankingPillarsBreakdown;
  };
  stats: {
    completedAppointmentsMonth: number;
    totalCompletedAppointments: number;
    servicesRevenueMonthInCents?: number;
    productsSalesMonthInCents?: number;
    productsSoldCountMonth?: number;
    revenueMonthInCents: number;
    totalRevenueInCents: number;
    commissionMonthInCents: number;
    totalCommissionInCents: number;
    averageRating: number;
    totalReviews: number;
  };
  awards: CollaboratorAward[];
  recentReviews: CollaboratorReview[];
  services: CollaboratorLinkedService[];
  schedules: WorkScheduleSlot[];
}

/**
 * Resolve a URL absoluta da foto do colaborador considerando caminhos relativos salvos pelo backend.
 */
export function resolveCollaboratorAvatarUrl(avatarUrl?: string | null): string | null {
  if (!avatarUrl || !avatarUrl.trim()) return null;
  const trimmed = avatarUrl.trim();
  if (/^(https?:\/\/|data:image\/|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${getApiBaseUrl()}${normalized}`;
}

/**
 * Envia a imagem de avatar do colaborador usando multipart/form-data.
 */
export async function uploadCollaboratorAvatar(
  collaboratorId: string,
  file: File,
): Promise<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest<{ avatarUrl: string }>(
    `/collaborators/${encodeURIComponent(collaboratorId)}/avatar`,
    {
      method: "POST",
      auth: true,
      body: formData,
    },
  );
}

/**
 * Busca o dossiê completo de perfil de um colaborador para o Bento Grid.
 */
export async function getCollaboratorProfile(
  collaboratorId: string,
): Promise<CollaboratorProfileDossier> {
  return apiRequest<CollaboratorProfileDossier>(
    `/collaborators/${encodeURIComponent(collaboratorId)}/profile`,
    {
      method: "GET",
      auth: true,
    },
  );
}

export interface UpdateCollaboratorPayload {
  name?: string;
  phone?: string;
  whatsapp?: string | null;
  specialty?: string;
  bio?: string | null;
  commissionPercentage?: number;
  defaultCommissionRate?: number;
  monthlyRevenueGoal?: number | null;
  hiredAt?: string;
}

export interface SyncCollaboratorServicesPayload {
  services: Array<{
    serviceId: string;
    customCommissionRate?: number | null;
  }>;
}

export interface SyncCollaboratorSchedulePayload {
  schedules: Array<{
    dayOfWeek: DayOfWeek;
    isWorkingDay: boolean;
    startTime: string | null;
    endTime: string | null;
    breakStartTime: string | null;
    breakEndTime: string | null;
  }>;
}

export interface UpdateCollaboratorCredentialsPayload {
  email?: string;
  password?: string;
}

export interface FutureAppointmentsCountResponse {
  futureAppointmentsCount: number;
}

export interface DeactivateCollaboratorPayload {
  reason?: string | null;
  queueAiReschedule: boolean;
}

export interface DeactivateCollaboratorResponse {
  message: string;
  queuedCount: number;
}

/**
 * Atualiza os dados cadastrais, especialidade, comissão padrão e meta mensal do colaborador.
 */
export async function updateCollaboratorProfile(
  collaboratorId: string,
  payload: UpdateCollaboratorPayload,
): Promise<Collaborator> {
  return apiRequest<Collaborator>(
    `/collaborators/${encodeURIComponent(collaboratorId)}`,
    {
      method: "PATCH",
      auth: true,
      body: payload,
    },
  );
}

/**
 * Sincroniza a lista de serviços vinculados e comissões customizadas do colaborador.
 */
export async function syncCollaboratorServices(
  collaboratorId: string,
  payload: SyncCollaboratorServicesPayload,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(
    `/collaborators/${encodeURIComponent(collaboratorId)}/services`,
    {
      method: "PUT",
      auth: true,
      body: payload,
    },
  );
}

/**
 * Sincroniza a jornada semanal individual validada contra o horário da empresa.
 */
export async function syncCollaboratorSchedule(
  collaboratorId: string,
  payload: SyncCollaboratorSchedulePayload,
): Promise<{ schedules: WorkScheduleSlot[] }> {
  return apiRequest<{ schedules: WorkScheduleSlot[] }>(
    `/collaborators/${encodeURIComponent(collaboratorId)}/schedule`,
    {
      method: "PUT",
      auth: true,
      body: payload,
    },
  );
}

/**
 * Atualiza e-mail de login e/ou senha de acesso ao portal do colaborador.
 */
export async function updateCollaboratorCredentials(
  collaboratorId: string,
  payload: UpdateCollaboratorCredentialsPayload,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(
    `/collaborators/${encodeURIComponent(collaboratorId)}/credentials`,
    {
      method: "PATCH",
      auth: true,
      body: payload,
    },
  );
}

/**
 * Consulta quantos agendamentos futuros ativos existem antes de confirmar o desligamento.
 */
export async function getCollaboratorFutureAppointmentsCount(
  collaboratorId: string,
): Promise<FutureAppointmentsCountResponse> {
  return apiRequest<FutureAppointmentsCountResponse>(
    `/collaborators/${encodeURIComponent(collaboratorId)}/future-appointments-count`,
    {
      method: "GET",
      auth: true,
    },
  );
}

/**
 * Desativa logicamente o colaborador preservando histórico e enfileirando reagendamento IA se solicitado.
 */
export async function deactivateCollaborator(
  collaboratorId: string,
  payload: DeactivateCollaboratorPayload,
): Promise<DeactivateCollaboratorResponse> {
  return apiRequest<DeactivateCollaboratorResponse>(
    `/collaborators/${encodeURIComponent(collaboratorId)}/deactivate`,
    {
      method: "POST",
      auth: true,
      body: payload,
    },
  );
}

/**
 * Atualiza o status ativo/inativo do colaborador (usado para reativação).
 */
export async function updateCollaboratorStatus(
  collaboratorId: string,
  isActive: boolean,
): Promise<{ id: string; isActive: boolean; status: CollaboratorStatus }> {
  return apiRequest<{ id: string; isActive: boolean; status: CollaboratorStatus }>(
    `/collaborators/${encodeURIComponent(collaboratorId)}/status`,
    {
      method: "PATCH",
      auth: true,
      body: { isActive },
    },
  );
}

/**
 * Consulta os pesos configurados pela empresa para o cálculo do ranking e Funcionário do Mês.
 */
export async function getCompanyRankingWeights(): Promise<CompanyRankingWeights> {
  return apiRequest<CompanyRankingWeights>("/companies/ranking-weights", {
    method: "GET",
    auth: true,
  });
}

/**
 * Salva os pesos configurados pelo dono (a soma dos 5 pilares deve ser exatamente 100).
 */
export async function updateCompanyRankingWeights(
  payload: CompanyRankingWeights,
): Promise<CompanyRankingWeights> {
  return apiRequest<CompanyRankingWeights>("/companies/ranking-weights", {
    method: "PUT",
    auth: true,
    body: payload,
  });
}

/**
 * Fecha um mês de referência (YYYY-MM), apura o #1 do ranking e registra o troféu oficial.
 */
export async function closeMonthAward(
  referenceMonth: string,
): Promise<CloseMonthAwardResponse> {
  return apiRequest<CloseMonthAwardResponse>("/collaborators/awards/close-month", {
    method: "POST",
    auth: true,
    body: { referenceMonth },
  });
}
