export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELED"
  | "NO_SHOW";

export type UpdatableAppointmentStatus =
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELED"
  | "NO_SHOW";

export interface Appointment {
  id: string;
  companyId: string;
  collaboratorId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  awaitingClosure?: boolean;
  cancellationReason: string | null;
  notes?: string | null;
  isGuest?: boolean;
  usesClubBenefit?: boolean;
  serviceNameSnapshot: string;
  servicePriceInCentsSnapshot: number;
  serviceDurationMinutesSnapshot: number;
  commissionPercentageSnapshot: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentFilters {
  from?: string;
  to?: string;
  collaboratorId?: string;
  status?: AppointmentStatus | "";
}

export interface CreateAppointmentPayload {
  serviceId: string;
  collaboratorId: string;
  startsAt: string;
  clientName: string;
  clientPhone: string;
  initialStatus?: "PENDING" | "CONFIRMED";
  notes?: string;
}

export interface UpdateAppointmentStatusPayload {
  status: UpdatableAppointmentStatus;
  cancellationReason?: string | null;
}

export interface RescheduleAppointmentPayload {
  startsAt: string;
  collaboratorId?: string;
}

export interface AppointmentAuditLog {
  id: string;
  companyId: string;
  appointmentId: string;
  action: string;
  previousStatus: AppointmentStatus;
  newStatus: AppointmentStatus;
  reason: string;
  authorizedById: string;
  authorizedByName: string;
  authorizedByRole: string;
  createdAt: string;
}

export interface RevertCompletedAppointmentPayload {
  reason: string;
  ownerPassword: string;
}

export interface AffectedAppointment {
  id: string;
  collaboratorId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  startsAt: string;
  endsAt: string;
  status: "PENDING" | "CONFIRMED";
}

export interface ScheduleBlock {
  id: string;
  companyId: string;
  collaboratorId: string | null;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleBlockPayload {
  collaboratorId?: string | null;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
}

export interface CreateScheduleBlockResponse {
  block: ScheduleBlock;
  affectedAppointments: AffectedAppointment[];
}
