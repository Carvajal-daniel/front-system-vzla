export interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceInCents: number;
  active: boolean;
  imageUrl?: string | null;
}

export interface CreateServicePayload {
  name: string;
  description?: string | null;
  durationMinutes: number;
  priceInCents: number;
  imageUrl?: string | null;
}

export interface UpdateServicePayload {
  name?: string;
  description?: string | null;
  durationMinutes?: number;
  priceInCents?: number;
  imageUrl?: string | null;
}

export interface UpdateServiceStatusPayload {
  active: boolean;
}

export interface ServiceCollaboratorItem {
  collaboratorId: string;
  name: string;
  specialty: string;
  isActive: boolean;
  commissionPercentage: number;
}

export interface ServiceCollaboratorsResponse {
  collaborators: ServiceCollaboratorItem[];
}

export interface LinkServiceCollaboratorPayload {
  collaboratorId: string;
  commissionPercentage: number;
}

export interface UpdateServiceCollaboratorPayload {
  commissionPercentage: number;
}
