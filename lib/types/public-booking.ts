export type PhoneCountryCode = "+55" | "+58";

export interface PublicCompany {
  id: string;
  companyName: string;
  timezone: string;
  avatarUrl?: string | null;
  operatingDays?: string | null;
  operatingSchedule?: Array<{
    dayOfWeek: number;
    isOpen: boolean;
    openTime: string | null;
    closeTime: string | null;
  }> | null;
}

export interface PublicServiceCollaborator {
  id: string;
  name: string;
  specialty: string;
  avatarUrl?: string | null;
}

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceInCents: number;
  imageUrl?: string | null;
  collaborators: PublicServiceCollaborator[];
}

export interface PublicCatalogResponse {
  company: PublicCompany;
  services: PublicService[];
}

export interface AvailabilitySlot {
  startsAt: string;
  endsAt: string;
  collaboratorId: string;
  collaboratorName: string;
}

export interface PublicAvailabilityResponse {
  companyId: string;
  serviceId: string;
  date: string;
  timezone: string;
  slotStepMinutes: number;
  serviceDurationMinutes: number;
  slots: AvailabilitySlot[];
}

export interface PublicBookingFormInput {
  serviceId: string;
  collaboratorId?: string | null;
  startsAt: string;
  clientName: string;
  countryCode: PhoneCountryCode;
  clientPhone: string;
}

/**
 * Contrato exato de POST /public/companies/:companyId/appointments.
 * Quando o cliente escolhe "Qualquer disponível", collaboratorId vem do slot selecionado.
 */
export interface CreatePublicAppointmentPayload {
  serviceId: string;
  collaboratorId: string;
  startsAt: string;
  clientName: string;
  clientPhone: string;
}
