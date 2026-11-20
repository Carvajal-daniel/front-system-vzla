import type { Locale } from "@/lib/i18n";
import type { PhoneCountryCode } from "@/lib/types/public-booking";

/**
 * Formata data e hora sempre com locale e timeZone explícitos da empresa,
 * garantindo renderização determinística entre servidor e cliente (zero erros de hidratação).
 */
export function formatDateTimeInTimezone(
  isoDate: string,
  timezone: string,
  locale: Locale,
): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatTimeInTimezone(
  isoDate: string,
  timezone: string,
  locale: Locale,
): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDateInTimezone(
  isoDate: string,
  timezone: string,
  locale: Locale,
): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);
}

/**
 * Retorna a data corrente no formato YYYY-MM-DD no fuso horário da empresa.
 * Deve ser chamada apenas dentro de efeitos/eventos no cliente para evitar mismatch de hidratação.
 */
export function getTodayIsoDateInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function formatPrice(
  amount: number,
  locale: Locale,
  currency?: string,
): string {
  const resolvedCurrency = currency ?? (locale === "es" ? "USD" : "BRL");
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: resolvedCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Converte valores inteiros em centavos retornados pela API Fastify (priceInCents)
 * para moeda formatada com locale explícito.
 */
export function formatPriceFromCents(
  priceInCents: number,
  locale: Locale,
  currency?: string,
): string {
  return formatPrice(priceInCents / 100, locale, currency);
}

export function formatPercentage(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export function formatDuration(minutes: number, locale: Locale): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) {
    return `${hours}h`;
  }
  return locale === "es" ? `${hours}h ${rest} min` : `${hours}h ${rest}min`;
}

export function stripNonDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Normaliza telefone nacional para formato E.164 aceito pela API (+55 Brasil / +58 Venezuela).
 */
export function formatPhoneToE164(
  countryCode: PhoneCountryCode,
  nationalDigits: string,
): string {
  const digits = stripNonDigits(nationalDigits);
  // Remove zero à esquerda comum em números venezuelanos (ex.: 0412... -> 412...)
  const normalized =
    countryCode === "+58" && digits.startsWith("0") ? digits.slice(1) : digits;
  return `${countryCode}${normalized}`;
}

export function isValidInternationalPhone(
  countryCode: PhoneCountryCode,
  nationalInput: string,
): boolean {
  const digits = stripNonDigits(nationalInput);
  if (countryCode === "+55") {
    return digits.length === 10 || digits.length === 11;
  }
  const normalizedVe = digits.startsWith("0") ? digits.slice(1) : digits;
  return normalizedVe.length === 10;
}

export function formatNationalPhoneDisplay(
  countryCode: PhoneCountryCode,
  rawDigits: string,
): string {
  const digits = stripNonDigits(rawDigits);
  if (countryCode === "+55") {
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }

  // Padrão Venezuela: 412-123-4567 (ou 0412-123-4567)
  const clean = digits.startsWith("0") ? digits.slice(1) : digits;
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 10)}`;
}
