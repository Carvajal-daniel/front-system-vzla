export type GuidedTopicId =
  | "presentation"
  | "recurring"
  | "policies"
  | "plans"
  | "handoff"
  | "extra";

export type RecurringBehavior = "suggest_usual" | "ask_every_time";
export type AttendantTone = "friendly" | "professional" | "casual";

export interface GuidedReceptionistConfig {
  // 1. Nome e apresentação do atendente
  attendantName: string;
  attendantTone: AttendantTone;
  welcomeGreeting: string;
  // 2. Sugestão para clientes recorrentes
  recurringBehavior: RecurringBehavior | "";
  recurringNote: string;
  // 3. Formas de pagamento e regras de cancelamento/atraso
  paymentMethods: string;
  delayTolerance: string;
  cancellationPolicy: string;
  // 4. Divulgação de planos de assinatura
  promotePlans: boolean | null;
  plansPitch: string;
  // 5. Quando transferir para atendimento humano
  handoffTriggers: string[];
  customHandoffTrigger: string;
  // 6. Instruções extras livres
  extraInstructions: string;
}

export const DEFAULT_GUIDED_CONFIG: GuidedReceptionistConfig = {
  attendantName: "",
  attendantTone: "friendly",
  welcomeGreeting: "",
  recurringBehavior: "",
  recurringNote: "",
  paymentMethods: "",
  delayTolerance: "",
  cancellationPolicy: "",
  promotePlans: null,
  plansPitch: "",
  handoffTriggers: [],
  customHandoffTrigger: "",
  extraInstructions: "",
};

export const HANDOFF_TRIGGER_OPTIONS = [
  {
    id: "complaints",
    labelPt: "Reclamações ou insatisfação",
    labelEs: "Quejas o insatisfacción",
  },
  {
    id: "discounts",
    labelPt: "Pedidos de desconto ou negociação",
    labelEs: "Pedidos de descuento o negociación",
  },
  {
    id: "events",
    labelPt: "Noivos, eventos ou grupos grandes",
    labelEs: "Bodas, eventos o grupos grandes",
  },
  {
    id: "complex_services",
    labelPt: "Químicas complexas ou avaliação técnica",
    labelEs: "Químicos complejos o evaluación técnica",
  },
  {
    id: "human_request",
    labelPt: "Sempre que o cliente pedir um humano",
    labelEs: "Siempre que el cliente pida un humano",
  },
] as const;

const SECTION_LABELS = {
  presentation: "[APRESENTAÇÃO DO ATENDENTE]",
  recurring: "[CLIENTES RECORRENTES]",
  policies: "[PAGAMENTO, ATRASO E CANCELAMENTO]",
  plans: "[PLANOS DE ASSINATURA]",
  handoff: "[TRANSBORDO PARA HUMANO]",
  extra: "[INSTRUÇÕES EXTRAS]",
} as const;

export function isTopicConfigured(
  config: GuidedReceptionistConfig,
  topic: GuidedTopicId,
): boolean {
  switch (topic) {
    case "presentation":
      return Boolean(
        config.attendantName.trim() || config.welcomeGreeting.trim(),
      );
    case "recurring":
      return Boolean(config.recurringBehavior);
    case "policies":
      return Boolean(
        config.paymentMethods.trim() ||
          config.delayTolerance.trim() ||
          config.cancellationPolicy.trim(),
      );
    case "plans":
      return config.promotePlans !== null || Boolean(config.plansPitch.trim());
    case "handoff":
      return (
        config.handoffTriggers.length > 0 ||
        Boolean(config.customHandoffTrigger.trim())
      );
    case "extra":
      return Boolean(config.extraInstructions.trim());
  }
}

export function countConfiguredTopics(config: GuidedReceptionistConfig): number {
  const topics: GuidedTopicId[] = [
    "presentation",
    "recurring",
    "policies",
    "plans",
    "handoff",
    "extra",
  ];
  return topics.filter((topic) => isTopicConfigured(config, topic)).length;
}

// Compila os 6 tópicos guiados em um texto estruturado e limpo para o campo `aiSystemPrompt`
// de PATCH /v1/whatsapp/settings (limite de 4000 caracteres no backend).
export function compileGuidedConfigToPrompt(
  config: GuidedReceptionistConfig,
): string | null {
  const blocks: string[] = [];

  if (isTopicConfigured(config, "presentation")) {
    const toneLabel =
      config.attendantTone === "professional"
        ? "Profissional e elegante"
        : config.attendantTone === "casual"
          ? "Descontraído e próximo"
          : "Cordial e acolhedor";
    const lines: string[] = [SECTION_LABELS.presentation];
    if (config.attendantName.trim()) {
      lines.push(`Nome do atendente: ${config.attendantName.trim()}`);
    }
    lines.push(`Tom de voz: ${toneLabel}`);
    if (config.welcomeGreeting.trim()) {
      lines.push(`Saudação preferida: ${config.welcomeGreeting.trim()}`);
    }
    blocks.push(lines.join("\n"));
  }

  if (isTopicConfigured(config, "recurring")) {
    const lines: string[] = [SECTION_LABELS.recurring];
    lines.push(
      config.recurringBehavior === "ask_every_time"
        ? "Estratégia: Perguntar a cada atendimento qual serviço e profissional o cliente prefere."
        : "Estratégia: Sugerir proativamente o serviço e barbeiro habitual ('o de sempre') logo na saudação.",
    );
    if (config.recurringNote.trim()) {
      lines.push(`Observação: ${config.recurringNote.trim()}`);
    }
    blocks.push(lines.join("\n"));
  }

  if (isTopicConfigured(config, "policies")) {
    const lines: string[] = [SECTION_LABELS.policies];
    if (config.paymentMethods.trim()) {
      lines.push(`Formas de pagamento: ${config.paymentMethods.trim()}`);
    }
    if (config.delayTolerance.trim()) {
      lines.push(`Tolerância de atraso: ${config.delayTolerance.trim()}`);
    }
    if (config.cancellationPolicy.trim()) {
      lines.push(`Cancelamento/remarcação: ${config.cancellationPolicy.trim()}`);
    }
    blocks.push(lines.join("\n"));
  }

  if (isTopicConfigured(config, "plans")) {
    const lines: string[] = [SECTION_LABELS.plans];
    lines.push(
      config.promotePlans === false
        ? "Divulgação: Não oferecer planos proativamente; informe apenas se o cliente perguntar."
        : "Divulgação: Apresentar os planos de assinatura/clube como opção vantajosa para quem corta com frequência.",
    );
    if (config.plansPitch.trim()) {
      lines.push(`Destaque dos planos: ${config.plansPitch.trim()}`);
    }
    blocks.push(lines.join("\n"));
  }

  if (isTopicConfigured(config, "handoff")) {
    const lines: string[] = [SECTION_LABELS.handoff];
    if (config.handoffTriggers.length > 0) {
      const labels = config.handoffTriggers.map((id) => {
        const match = HANDOFF_TRIGGER_OPTIONS.find((o) => o.id === id);
        return match ? match.labelPt : id;
      });
      lines.push(`Transferir automaticamente quando: ${labels.join("; ")}.`);
    }
    if (config.customHandoffTrigger.trim()) {
      lines.push(`Regra adicional: ${config.customHandoffTrigger.trim()}`);
    }
    blocks.push(lines.join("\n"));
  }

  if (isTopicConfigured(config, "extra")) {
    blocks.push(
      `${SECTION_LABELS.extra}\n${config.extraInstructions.trim()}`,
    );
  }

  if (blocks.length === 0) return null;
  return blocks.join("\n\n").slice(0, 4000);
}

// Hidrata os 6 tópicos a partir do `aiSystemPrompt` salvo no banco, preservando
// qualquer texto livre legado dentro do tópico 6 (Instruções extras livres).
export function parsePromptToGuidedConfig(
  rawPrompt: string | null | undefined,
): GuidedReceptionistConfig {
  const result: GuidedReceptionistConfig = {
    ...DEFAULT_GUIDED_CONFIG,
    handoffTriggers: [],
  };
  const text = rawPrompt?.trim();
  if (!text) return result;

  const knownHeaders = Object.values(SECTION_LABELS);
  const hasStructuredHeader = knownHeaders.some((header) =>
    text.includes(header),
  );

  if (!hasStructuredHeader) {
    result.extraInstructions = text;
    return result;
  }

  const sectionPattern =
    /\[(APRESENTAÇÃO DO ATENDENTE|CLIENTES RECORRENTES|PAGAMENTO, ATRASO E CANCELAMENTO|PLANOS DE ASSINATURA|TRANSBORDO PARA HUMANO|INSTRUÇÕES EXTRAS)\]/g;
  const matches = Array.from(text.matchAll(sectionPattern));

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    if (!current || current.index === undefined) continue;

    const header = current[0];
    const start = current.index + header.length;
    const end = next?.index ?? text.length;
    const body = text.slice(start, end).trim();
    if (!body) continue;

    if (header === SECTION_LABELS.presentation) {
      const nameMatch = /^Nome do atendente:\s*(.+)$/m.exec(body);
      if (nameMatch?.[1]) result.attendantName = nameMatch[1].trim();
      const toneMatch = /^Tom de voz:\s*(.+)$/m.exec(body);
      if (toneMatch?.[1]) {
        const lower = toneMatch[1].toLowerCase();
        if (lower.includes("profissional")) result.attendantTone = "professional";
        else if (lower.includes("descontra")) result.attendantTone = "casual";
        else result.attendantTone = "friendly";
      }
      const greetingMatch = /^Saudação preferida:\s*(.+)$/m.exec(body);
      if (greetingMatch?.[1]) result.welcomeGreeting = greetingMatch[1].trim();
    } else if (header === SECTION_LABELS.recurring) {
      if (body.toLowerCase().includes("perguntar a cada")) {
        result.recurringBehavior = "ask_every_time";
      } else {
        result.recurringBehavior = "suggest_usual";
      }
      const noteMatch = /^Observação:\s*(.+)$/m.exec(body);
      if (noteMatch?.[1]) result.recurringNote = noteMatch[1].trim();
    } else if (header === SECTION_LABELS.policies) {
      const payMatch = /^Formas de pagamento:\s*(.+)$/m.exec(body);
      if (payMatch?.[1]) result.paymentMethods = payMatch[1].trim();
      const delayMatch = /^Tolerância de atraso:\s*(.+)$/m.exec(body);
      if (delayMatch?.[1]) result.delayTolerance = delayMatch[1].trim();
      const cancelMatch = /^Cancelamento\/remarcação:\s*(.+)$/m.exec(body);
      if (cancelMatch?.[1]) result.cancellationPolicy = cancelMatch[1].trim();
    } else if (header === SECTION_LABELS.plans) {
      result.promotePlans = !body.toLowerCase().includes("não oferecer");
      const pitchMatch = /^Destaque dos planos:\s*(.+)$/m.exec(body);
      if (pitchMatch?.[1]) result.plansPitch = pitchMatch[1].trim();
    } else if (header === SECTION_LABELS.handoff) {
      const triggersMatch = /^Transferir automaticamente quando:\s*(.+)$/m.exec(
        body,
      );
      if (triggersMatch?.[1]) {
        const rawList = triggersMatch[1].replace(/\.$/, "");
        const matchedIds: string[] = [];
        for (const opt of HANDOFF_TRIGGER_OPTIONS) {
          if (rawList.includes(opt.labelPt)) {
            matchedIds.push(opt.id);
          }
        }
        result.handoffTriggers = matchedIds;
      }
      const customMatch = /^Regra adicional:\s*(.+)$/m.exec(body);
      if (customMatch?.[1]) {
        result.customHandoffTrigger = customMatch[1].trim();
      }
    } else if (header === SECTION_LABELS.extra) {
      result.extraInstructions = body;
    }
  }

  return result;
}
