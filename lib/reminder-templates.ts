import type { ReminderSettings } from "@/lib/company-settings";

export type ReminderTemplateId = ReminderSettings["template"];
export type ReminderLocale = "pt-BR" | "es";

export interface ReminderRenderContext {
  clientName: string;
  companyName: string;
  professionalName: string;
  serviceName: string;
  date: string;
  time: string;
  appUrl?: string;
}

// Variáveis oficiais exibidas nos chips do editor; {responsavel} e {cliente} permanecem como aliases retrocompatíveis.
export const REMINDER_VARIABLES = [
  "nome",
  "empresa",
  "data",
  "hora",
  "profissional",
  "servico",
  "appURL",
] as const;

const STANDARD_TEMPLATES: Record<ReminderLocale, string> = {
  "pt-BR": [
    "Olá *{nome}*!",
    "",
    "Você tem um compromisso em *{empresa}*:",
    "",
    "Data: *{data}* às *{hora}*",
    "Profissional: *{profissional}*",
    "Serviço: *{servico}*",
  ].join("\n"),
  es: [
    "¡Hola *{nome}*!",
    "",
    "Tienes una cita en *{empresa}*:",
    "",
    "Fecha: *{data}* a las *{hora}*",
    "Profesional: *{profissional}*",
    "Servicio: *{servico}*",
  ].join("\n"),
};

export const DEFAULT_CUSTOM_REMINDER_MESSAGES: Record<ReminderLocale, string> = {
  "pt-BR": [
    STANDARD_TEMPLATES["pt-BR"],
    "",
    "Iremos te aguardar no dia e horário acima, caso tenha qualquer imprevisto por favor nos avise.",
    "",
    "Clique: {appURL}",
  ].join("\n"),
  es: [
    STANDARD_TEMPLATES.es,
    "",
    "Te esperamos en el día y horario indicados; ante cualquier imprevisto, por favor avísanos.",
    "",
    "Enlace: {appURL}",
  ].join("\n"),
};

export function getReminderTemplate(
  template: ReminderTemplateId,
  locale: ReminderLocale = "pt-BR",
  customMessage?: string | null,
): string {
  // Todos os 5 modelos exibem explicitamente cliente, estabelecimento e profissional; no modo personalizado usa o texto editado.
  if (template === "custom") {
    const trimmed = customMessage?.trim();
    return trimmed ? customMessage! : DEFAULT_CUSTOM_REMINDER_MESSAGES[locale];
  }
  return STANDARD_TEMPLATES[locale];
}

export function renderReminderMessage(
  template: ReminderTemplateId,
  context: ReminderRenderContext,
  options?: { locale?: ReminderLocale; customMessage?: string | null },
): string {
  const locale = options?.locale ?? "pt-BR";
  const source = getReminderTemplate(template, locale, options?.customMessage);
  const replacements: Record<string, string> = {
    nome: context.clientName,
    cliente: context.clientName,
    empresa: context.companyName,
    data: context.date,
    hora: context.time,
    profissional: context.professionalName,
    responsavel: context.professionalName,
    servico: context.serviceName,
    appURL: context.appUrl ?? "",
  };

  return source.replace(/\{(\w+)\}/g, (token, key: string) => replacements[key] ?? token);
}
