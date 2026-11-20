export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  commissionPercentage: number;
  isActive: boolean;
  avatarUrl?: string | null;
  role?: "COLLABORATOR";
  companyId?: string;
}

export interface CollaboratorsListResponse {
  collaborators: Collaborator[];
}

export interface CreateCollaboratorPayload {
  name: string;
  email: string;
  password: string;
  phone: string;
  specialty: string;
  commissionPercentage: number;
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
}

export interface UpdateWorkSchedulesPayload {
  schedules: WorkScheduleSlot[];
}