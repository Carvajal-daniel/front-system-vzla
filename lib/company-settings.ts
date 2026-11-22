import type { Locale } from "@/lib/i18n";
import type { ThemeMode, ThemePalette } from "@/lib/theme-context";

export interface OwnerAppearance {
  mode: ThemeMode;
  palette: ThemePalette;
  locale: Locale;
}

export const agendaIntervals = [5, 10, 15, 30, 60] as const;
export const bookingIntervals = [0, 15, 20, 30, 60] as const;
export const leadTimes = [0, 30, 60, 120, 1440] as const;
export const clientFields = ["birthDate", "document", "email", "gender", "source"] as const;
export const clientSources = ["instagram", "referral", "google", "walk-in"] as const;
export const addressFields = ["postalCode", "street", "number", "district", "city", "state"] as const;

export type ClientField = typeof clientFields[number];
export type ClientFieldMode = "required" | "optional" | "hidden";

export const profileFieldLabels = {
  clientAddress: ["Endereço", "Dirección"], clientNumber: ["Número", "Número"],
  clientComplement: ["Complemento", "Complemento"], clientDistrict: ["Bairro", "Barrio"],
  clientCity: ["Cidade", "Ciudad"], clientState: ["Estado", "Estado"], clientPostalCode: ["CEP", "Código postal"],
  hairType: ["Tipo de cabelo", "Tipo de cabello"], pigmentation: ["Pigmentação predominante", "Pigmentación predominante"],
  hairLength: ["Comprimento", "Longitud"], elasticity: ["Elasticidade", "Elasticidad"], porosity: ["Porosidade", "Porosidad"],
  volume: ["Volume", "Volumen"], strandThickness: ["Espessura do fio", "Grosor de la fibra"], resistance: ["Resistência", "Resistencia"],
  allergies: ["Antecedentes alérgicos", "Antecedentes alérgicos"], allergyNotes: ["Observações sobre antecedentes", "Observaciones sobre antecedentes"],
  medication: ["Toma Medicamento?", "¿Toma medicamentos?"], soughtDoctor: ["Procurou Médico?", "¿Consultó al médico?"],
  diagnosis: ["Qual o diagnóstico?", "¿Cuál es el diagnóstico?"], pathology: ["Patologia", "Patología"],
  pathologyNotes: ["Observações Patologia", "Observaciones sobre la patología"],
  currentTreatments: ["Tratamentos atuais", "Tratamientos actuales"], observations: ["Observações", "Observaciones"],
} as const;

export const registrationFieldLabels = {
  email: ["Email", "Correo electrónico"], birthDate: ["Data de Nascimento", "Fecha de nacimiento"], document: ["CPF / C.I.", "CPF / C.I."],
} as const;
export const registrationProfileKeys = ["clientAddress", "clientNumber", "clientComplement", "clientDistrict", "clientCity", "clientState", "clientPostalCode"] as const;

export type CustomClientField = { id: string; label: string; mode: ClientFieldMode };
export type ReminderSettings = {
  enabled: boolean; hours: 1 | 2 | 4 | 24;
  template: "buttons" | "plain" | "whatsapp" | "external" | "custom";
  message: string; externalUrl: string; servicePhone?: string;
};
export type OnlinePaymentSettings = {
  enabled: boolean; depositPercentage: number; pixKeyType: "CNPJ" | "EMAIL" | "PHONE" | "EVP";
  pixKey: string; autoRefundHours: number; noShowPolicy: string;
};
export type ClientFieldValues = Record<string, string>;
export type CompanyAddress = Record<typeof addressFields[number], string>;

export interface CompanySettings {
  address: CompanyAddress | null;
  agendaInterval: typeof agendaIntervals[number];
  bookingInterval: typeof bookingIntervals[number];
  leadTime: typeof leadTimes[number];
  clientFields: Record<ClientField, ClientFieldMode> & Partial<Record<string, ClientFieldMode>>;
  birthdayRadar: boolean;
  surveyEnabled: boolean;
  rating: { average: number; count: number } | null;
  googleMapsUrl: string | null;
  googlePlaceId: string | null;
  clientFieldSlots: (string | null)[] | null;
  googleRating: number | null;
  googleReviewsCount: number | null;
  reminders: ReminderSettings | null;
  onlinePayment: OnlinePaymentSettings | null;
  packageSales: { enabled: boolean; notes: string } | null;
  customClientFields: CustomClientField[];
}

export const defaultCompanySettings: CompanySettings = {
  address: null,
  agendaInterval: 30,
  bookingInterval: 0,
  leadTime: 0,
  clientFields: {
    birthDate: "optional",
    document: "optional",
    email: "optional",
    gender: "optional",
    source: "optional",
  },
  birthdayRadar: false,
  surveyEnabled: false,
  rating: null,
  googleMapsUrl: null,
  googlePlaceId: null,
  clientFieldSlots: null,
  googleRating: null,
  googleReviewsCount: null,
  reminders: null,
  onlinePayment: null,
  packageSales: null,
  customClientFields: [],
};

export function displayCompanyRating(
  settings: CompanySettings,
  googlePlace?: { rating: number | null; reviewsCount: number | null } | null,
) {
  // Prioriza a nota e o total de avaliações sincronizados via Google Places, preservando o preenchimento manual e a pesquisa interna como fallback.
  if (googlePlace?.rating != null) {
    return { average: googlePlace.rating, count: googlePlace.reviewsCount ?? 0, source: "Google Maps" };
  }
  return settings.googleRating != null
    ? { average: settings.googleRating, count: settings.googleReviewsCount ?? 0, source: "Google" }
    : settings.rating;
}

export function formatCompanyAddress(address: CompanyAddress | null) {
  if (!address) return "";
  return [
    [address.street, address.number].filter(Boolean).join(", "),
    address.district,
    [address.city, address.state].filter(Boolean).join(" - "),
    address.postalCode,
  ].filter(Boolean).join(" · ");
}

export const emptyClientFields: ClientFieldValues = {
  birthDate: "", document: "", email: "", gender: "", source: "",
};

export function clientFieldOptions(settings: CompanySettings, spanish: boolean) {
  const language = spanish ? 1 : 0;
  return [
    ...Object.entries(registrationFieldLabels).map(([id, labels]) => ({ id, label: labels[language], group: "registration" })),
    ...Object.entries(profileFieldLabels).map(([id, labels]) => ({
      id, label: labels[language], group: registrationProfileKeys.some((key) => key === id) ? "registration" : "technical",
    })),
    ...settings.customClientFields.map(({ id, label }) => ({ id, label, group: "custom" })),
  ];
}

export function selectedClientFields(settings: CompanySettings, spanish = false) {
  const options = clientFieldOptions(settings, spanish);
  const mode = (id: string) => settings.clientFields[id] ?? settings.customClientFields.find((custom) => custom.id === id)?.mode;
  const ids = settings.clientFieldSlots ?? options.filter(({ id }) => mode(id) === "required").map(({ id }) => id);
  return ids.flatMap((id) => {
    const option = options.find((item) => item.id === id);
    return option ? [{ ...option, required: mode(option.id) === "required" }] : [];
  });
}

export function collectedClientFields(values: ClientFieldValues, settings: CompanySettings) {
  return Object.fromEntries(selectedClientFields(settings).flatMap(({ id }) => {
    const value = values[id]?.trim();
    return value ? [[id, value]] : [];
  }));
}
