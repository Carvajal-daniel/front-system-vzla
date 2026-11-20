export interface TimezoneOption {
  value: string;
  label: string;
  region: "BR" | "VE" | "OTHER";
}

/**
 * Lista curada de fusos horários IANA com prioridade para Brasil e Venezuela,
 * mantendo valores oficiais aceitos por Intl.DateTimeFormat e pela API Fastify.
 */
export const IANA_TIMEZONES: TimezoneOption[] = [
  { value: "America/Sao_Paulo", label: "Brasil — São Paulo / Brasília (UTC-3)", region: "BR" },
  { value: "America/Fortaleza", label: "Brasil — Fortaleza / Nordeste (UTC-3)", region: "BR" },
  { value: "America/Recife", label: "Brasil — Recife (UTC-3)", region: "BR" },
  { value: "America/Bahia", label: "Brasil — Salvador / Bahia (UTC-3)", region: "BR" },
  { value: "America/Belem", label: "Brasil — Belém / Pará (UTC-3)", region: "BR" },
  { value: "America/Manaus", label: "Brasil — Manaus / Amazonas (UTC-4)", region: "BR" },
  { value: "America/Cuiaba", label: "Brasil — Cuiabá / Mato Grosso (UTC-4)", region: "BR" },
  { value: "America/Porto_Velho", label: "Brasil — Porto Velho (UTC-4)", region: "BR" },
  { value: "America/Rio_Branco", label: "Brasil — Rio Branco / Acre (UTC-5)", region: "BR" },
  { value: "America/Caracas", label: "Venezuela — Caracas (UTC-4)", region: "VE" },
  { value: "America/Bogota", label: "Colômbia — Bogotá (UTC-5)", region: "OTHER" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina — Buenos Aires (UTC-3)", region: "OTHER" },
  { value: "Europe/Lisbon", label: "Portugal — Lisboa (UTC+0/+1)", region: "OTHER" },
  { value: "UTC", label: "UTC (Universal)", region: "OTHER" },
];

export function isValidIanaTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
