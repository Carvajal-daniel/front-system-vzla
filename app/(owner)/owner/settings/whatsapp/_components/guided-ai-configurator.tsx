"use client";

import { useState } from "react";
import {
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  CreditCard,
  Crown,
  Loader2,
  MessageSquareText,
  Repeat,
  Save,
  Sparkles,
  UserCheck,
  UserRoundCog,
} from "lucide-react";
import { AgendaDialog } from "@/components/ui/agenda-controls";
import { Button } from "@/components/ui/button";
import {
  countConfiguredTopics,
  HANDOFF_TRIGGER_OPTIONS,
  isTopicConfigured,
  type GuidedReceptionistConfig,
  type GuidedTopicId,
} from "./guided-prompt-config";

const inputClass =
  "h-10 w-full rounded-xl border border-border-subtle bg-canvas/50 px-3 text-sm text-ink placeholder:text-ink-muted focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25";

const textareaClass =
  "w-full rounded-xl border border-border-subtle bg-canvas/50 p-3 text-sm text-ink placeholder:text-ink-muted focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25";

export interface GuidedAiConfiguratorProps {
  es: boolean;
  companyName: string;
  config: GuidedReceptionistConfig;
  saving: boolean;
  onSaveConfig: (nextConfig: GuidedReceptionistConfig) => Promise<void>;
}

export function GuidedAiConfigurator({
  es,
  companyName,
  config,
  saving,
  onSaveConfig,
}: GuidedAiConfiguratorProps) {
  const [activeTopic, setActiveTopic] = useState<GuidedTopicId | null>(null);
  const [draft, setDraft] = useState<GuidedReceptionistConfig>(config);

  const configuredCount = countConfiguredTopics(config);
  const progressPercent = Math.round((configuredCount / 6) * 100);

  const topics: Array<{
    id: GuidedTopicId;
    title: string;
    subtitle: string;
    icon: typeof Sparkles;
  }> = [
    {
      id: "presentation",
      title: es
        ? "1. Nombre y presentación del asistente"
        : "1. Nome e apresentação do atendente",
      subtitle: config.attendantName
        ? `${config.attendantName} · ${
            config.attendantTone === "professional"
              ? es
                ? "Profesional"
                : "Profissional"
              : config.attendantTone === "casual"
                ? es
                  ? "Cercano"
                  : "Descontraído"
                : es
                  ? "Cordial"
                  : "Cordial"
          }`
        : es
          ? "Define nombre, tono y vista previa en burbuja de WhatsApp"
          : "Defina nome, tom de voz e veja o preview ao vivo no WhatsApp",
      icon: Sparkles,
    },
    {
      id: "recurring",
      title: es
        ? "2. Sugerencia para clientes recurrentes"
        : "2. Sugestão para clientes recorrentes",
      subtitle:
        config.recurringBehavior === "suggest_usual"
          ? es
            ? "Sugerir el servicio/barbero habitual"
            : "Sugerir 'o de sempre' automaticamente"
          : config.recurringBehavior === "ask_every_time"
            ? es
              ? "Preguntar servicio/barbero cada vez"
              : "Perguntar serviço/barbeiro a cada visita"
            : es
              ? "Elige entre sugerir 'lo de siempre' o preguntar cada vez"
              : "Escolha entre sugerir o de sempre ou perguntar a cada vez",
      icon: Repeat,
    },
    {
      id: "policies",
      title: es
        ? "3. Pagos y reglas de atraso / cancelación"
        : "3. Formas de pagamento e regras de cancelamento/atraso",
      subtitle: config.paymentMethods
        ? config.paymentMethods
        : es
          ? "PIX, tarjeta, tolerancia de atraso y cancelación"
          : "PIX, cartão, tolerância de atraso e cancelamento",
      icon: CreditCard,
    },
    {
      id: "plans",
      title: es
        ? "4. Divulgación de planes de suscripción"
        : "4. Divulgação de planos de assinatura",
      subtitle:
        config.promotePlans === true
          ? es
            ? "Promoción activa de clubes y suscripciones"
            : "Divulgação ativa de clubes e assinaturas"
          : config.promotePlans === false
            ? es
              ? "Solo responder si el cliente pregunta"
              : "Informar apenas quando o cliente perguntar"
            : es
              ? "Cómo presentar tus clubes o planes mensuales"
              : "Defina como apresentar seus clubes e assinaturas",
      icon: Crown,
    },
    {
      id: "handoff",
      title: es
        ? "5. Cuándo transferir a atención humana"
        : "5. Quando transferir para atendimento humano",
      subtitle:
        config.handoffTriggers.length > 0
          ? `${config.handoffTriggers.length} ${
              es ? "regla(s) activa(s)" : "regra(s) ativa(s)"
            }`
          : es
            ? "Quejas, descuentos, eventos o solicitud directa"
            : "Reclamações, descontos, eventos ou pedido direto",
      icon: UserRoundCog,
    },
    {
      id: "extra",
      title: es ? "6. Instrucciones extras libres" : "6. Instruções extras livres",
      subtitle: config.extraInstructions
        ? `${config.extraInstructions.slice(0, 68)}${
            config.extraInstructions.length > 68 ? "..." : ""
          }`
        : es
          ? "Estacionamiento, café de cortesía o detalles únicos"
          : "Estacionamento, cortesias ou orientações extras",
      icon: MessageSquareText,
    },
  ];

  function openTopic(id: GuidedTopicId) {
    setDraft({
      ...config,
      handoffTriggers: [...config.handoffTriggers],
    });
    setActiveTopic(id);
  }

  async function handleConfirmTopic(event: React.FormEvent) {
    event.preventDefault();
    await onSaveConfig(draft);
    setActiveTopic(null);
  }

  function toggleHandoffTrigger(id: string) {
    setDraft((prev) => ({
      ...prev,
      handoffTriggers: prev.handoffTriggers.includes(id)
        ? prev.handoffTriggers.filter((item) => item !== id)
        : [...prev.handoffTriggers, id],
    }));
  }

  // Mensagem renderizada ao vivo no balão de WhatsApp (Tópico 1)
  const previewGreeting = (() => {
    const attendant = draft.attendantName.trim();
    const customLine = draft.welcomeGreeting.trim();
    const brand = companyName || "Barbearia";
    const intro =
      customLine ||
      (draft.attendantTone === "professional"
        ? es
          ? `Hola, bienvenido a ${brand}.${attendant ? ` Soy ${attendant}, tu asistente virtual.` : ""}`
          : `Olá! Seja bem-vindo à ${brand}.${attendant ? ` Sou ${attendant}, seu assistente virtual.` : ""}`
        : draft.attendantTone === "casual"
          ? es
            ? `¡Hola! ¿Todo bien? 💈✂️${attendant ? ` Aquí ${attendant} de ${brand}.` : ` Bienvenido a ${brand}.`}`
            : `Olá! Tudo bem? 💈✂️${attendant ? ` Aqui é ${attendant}, da ${brand}.` : ` Seja bem-vindo à ${brand}!`}`
          : es
            ? `¡Hola! ¿Cómo estás? 💈✂️ Bienvenido a ${brand}.${attendant ? ` Soy ${attendant}.` : ""}`
            : `Olá! Tudo bem? 💈✂️ Seja bem-vindo à ${brand}!${attendant ? ` Sou ${attendant}.` : ""}`);

    return [
      intro,
      "",
      es ? "Cómo puedo ayudarte hoy:" : "Como posso te ajudar hoje:",
      es
        ? "1️⃣ Agendar un horario"
        : '1️⃣ Agendar um horário (diga o serviço, barbeiro ou "tanto faz", e o dia/hora)',
      es
        ? "2️⃣ Ver catálogo completo de servicios"
        : "2️⃣ Ver catálogo completo de serviços",
      es
        ? "3️⃣ Conocer planes de suscripción 👑"
        : "3️⃣ Conhecer nossos planos de assinatura 👑",
      es ? "4️⃣ Hablar con un humano" : "4️⃣ Falar com um atendente",
    ].join("\n");
  })();

  const activeTopicMeta = topics.find((t) => t.id === activeTopic);

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 shadow-xs space-y-5">
      {/* Barra de progresso */}
      <div className="space-y-3 border-b border-border-subtle pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-ink">
              {es
                ? "Configurador Guiado de la Recepcionista IA"
                : "Configurador Guiado da Recepcionista IA"}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {es
                ? "Personaliza cada tema sin escribir prompts desde cero. Al guardar, se compila automáticamente para tu agente."
                : "Personalize cada tópico sem precisar escrever prompts do zero. Ao salvar, compilamos automaticamente para o seu agente."}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500">
            <UserCheck size={13} />
            {configuredCount} {es ? "de 6 temas configurados" : "de 6 tópicos configurados"}
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-subtle">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Lista clicável dos 6 tópicos */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {topics.map((topic) => {
          const Icon = topic.icon;
          const done = isTopicConfigured(config, topic.id);
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => openTopic(topic.id)}
              className={`group flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                done
                  ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/60"
                  : "border-border-subtle bg-canvas/40 hover:border-border-strong"
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                    done
                      ? "bg-emerald-500/20 text-emerald-500"
                      : "bg-subtle text-ink-secondary"
                  }`}
                >
                  <Icon size={17} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {topic.title}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">
                    {topic.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {done ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <CircleDashed size={16} className="text-ink-muted" />
                )}
                <ChevronRight
                  size={16}
                  className="text-ink-muted transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal de edição do tópico selecionado */}
      {activeTopic && activeTopicMeta && (
        <AgendaDialog
          centered
          title={activeTopicMeta.title}
          onClose={() => setActiveTopic(null)}
        >
          <form onSubmit={handleConfirmTopic} className="space-y-4">
            {activeTopic === "presentation" && (
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-ink-secondary">
                    {es
                      ? "Nombre del asistente (opcional)"
                      : "Nome do atendente (opcional)"}
                  </span>
                  <input
                    type="text"
                    maxLength={60}
                    value={draft.attendantName}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        attendantName: e.target.value,
                      }))
                    }
                    placeholder={es ? "Ej.: Sofía / Lucas" : "Ex.: Bia / Léo"}
                    className={inputClass}
                  />
                </label>

                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-ink-secondary">
                    {es ? "Tono de conversación" : "Tom de voz"}
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        {
                          id: "friendly",
                          pt: "Cordial",
                          es: "Cordial",
                        },
                        {
                          id: "casual",
                          pt: "Descontraído",
                          es: "Cercano",
                        },
                        {
                          id: "professional",
                          pt: "Profissional",
                          es: "Profesional",
                        },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            attendantTone: option.id,
                          }))
                        }
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                          draft.attendantTone === option.id
                            ? "border-emerald-500 bg-emerald-500/15 text-emerald-500"
                            : "border-border-subtle bg-canvas/40 text-ink-secondary hover:text-ink"
                        }`}
                      >
                        {es ? option.es : option.pt}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-ink-secondary">
                    {es
                      ? "Frase de bienvenida personalizada (opcional)"
                      : "Frase de boas-vindas personalizada (opcional)"}
                  </span>
                  <input
                    type="text"
                    maxLength={220}
                    value={draft.welcomeGreeting}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        welcomeGreeting: e.target.value,
                      }))
                    }
                    placeholder={
                      es
                        ? "Ej.: ¡Hola! Qué gusto recibirte en nuestra barbería 💈"
                        : "Ex.: Fala, campeão! Bem-vindo à nossa barbearia 💈✂️"
                    }
                    className={inputClass}
                  />
                </label>

                {/* Preview ao vivo de balão de WhatsApp */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    {es
                      ? "Vista previa en vivo (WhatsApp)"
                      : "Preview ao vivo (WhatsApp)"}
                  </span>
                  <div className="rounded-2xl border border-emerald-500/20 bg-[#0b141a] p-4">
                    <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-[#005c4b] px-3.5 py-2.5 text-xs leading-relaxed text-[#e9edef] shadow-sm whitespace-pre-line">
                      {previewGreeting}
                      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#aebac1]">
                        <span>14:32</span>
                        <CheckCheck size={13} className="text-[#53bdeb]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTopic === "recurring" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        recurringBehavior: "suggest_usual",
                      }))
                    }
                    className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                      draft.recurringBehavior === "suggest_usual"
                        ? "border-emerald-500 bg-emerald-500/15"
                        : "border-border-subtle bg-canvas/40 hover:border-border-strong"
                    }`}
                  >
                    <p className="text-sm font-semibold text-ink">
                      {es
                        ? "Sugerir 'lo de siempre' automáticamente"
                        : "Sugerir 'o de sempre' automaticamente"}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {es
                        ? "Menciona el servicio y barbero más frecuentes del cliente para agilizar la reserva."
                        : "Cita o serviço e barbeiro habituais do cliente logo na primeira mensagem para agilizar o agendamento."}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        recurringBehavior: "ask_every_time",
                      }))
                    }
                    className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                      draft.recurringBehavior === "ask_every_time"
                        ? "border-emerald-500 bg-emerald-500/15"
                        : "border-border-subtle bg-canvas/40 hover:border-border-strong"
                    }`}
                  >
                    <p className="text-sm font-semibold text-ink">
                      {es
                        ? "Preguntar servicio y barbero cada vez"
                        : "Perguntar serviço e barbeiro a cada vez"}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {es
                        ? "Saluda por su nombre pero siempre pregunta qué desea hacerse hoy."
                        : "Cumprimenta pelo nome, mas sempre pergunta qual serviço e profissional ele prefere hoje."}
                    </p>
                  </button>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-ink-secondary">
                    {es ? "Nota adicional (opcional)" : "Observação extra (opcional)"}
                  </span>
                  <input
                    type="text"
                    maxLength={200}
                    value={draft.recurringNote}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        recurringNote: e.target.value,
                      }))
                    }
                    placeholder={
                      es
                        ? "Ej.: Ofrecer también perfilado de cejas como adicional."
                        : "Ex.: Oferecer sobrancelha ou barba como adicional."
                    }
                    className={inputClass}
                  />
                </label>
              </div>
            )}

            {activeTopic === "policies" && (
              <div className="space-y-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-ink-secondary">
                    {es ? "Formas de pago aceptadas" : "Formas de pagamento aceitas"}
                  </span>
                  <input
                    type="text"
                    maxLength={220}
                    value={draft.paymentMethods}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        paymentMethods: e.target.value,
                      }))
                    }
                    placeholder="Ex.: PIX, Cartão de Crédito/Débito e Dinheiro"
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-ink-secondary">
                    {es ? "Tolerancia de atraso" : "Tolerância de atraso"}
                  </span>
                  <input
                    type="text"
                    maxLength={220}
                    value={draft.delayTolerance}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        delayTolerance: e.target.value,
                      }))
                    }
                    placeholder="Ex.: Tolerância máxima de 10 minutos."
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-ink-secondary">
                    {es
                      ? "Regla de cancelación / reprogramación"
                      : "Regra de cancelamento / remarcação"}
                  </span>
                  <input
                    type="text"
                    maxLength={220}
                    value={draft.cancellationPolicy}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        cancellationPolicy: e.target.value,
                      }))
                    }
                    placeholder="Ex.: Avisar com pelo menos 2 horas de antecedência."
                    className={inputClass}
                  />
                </label>
              </div>
            )}

            {activeTopic === "plans" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, promotePlans: true }))
                    }
                    className={`rounded-xl border p-3 text-left text-xs font-semibold transition-colors cursor-pointer ${
                      draft.promotePlans === true
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-500"
                        : "border-border-subtle bg-canvas/40 text-ink-secondary"
                    }`}
                  >
                    {es
                      ? "Promover activamente 👑"
                      : "Divulgar ativamente 👑"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, promotePlans: false }))
                    }
                    className={`rounded-xl border p-3 text-left text-xs font-semibold transition-colors cursor-pointer ${
                      draft.promotePlans === false
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-500"
                        : "border-border-subtle bg-canvas/40 text-ink-secondary"
                    }`}
                  >
                    {es
                      ? "Solo si preguntan"
                      : "Apenas se perguntarem"}
                  </button>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-ink-secondary">
                    {es
                      ? "Resumen o argumento de tus planes"
                      : "Resumo ou destaque dos planos de assinatura"}
                  </span>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={draft.plansPitch}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        plansPitch: e.target.value,
                      }))
                    }
                    placeholder="Ex.: Clube Prime por R$ 149/mês com cortes ilimitados de segunda a quarta e 10% OFF em produtos."
                    className={textareaClass}
                  />
                </label>
              </div>
            )}

            {activeTopic === "handoff" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {HANDOFF_TRIGGER_OPTIONS.map((opt) => {
                    const checked = draft.handoffTriggers.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors ${
                          checked
                            ? "border-emerald-500/50 bg-emerald-500/10 text-ink"
                            : "border-border-subtle bg-canvas/40 text-ink-secondary"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleHandoffTrigger(opt.id)}
                          className="size-4 accent-emerald-500 cursor-pointer"
                        />
                        <span>{es ? opt.labelEs : opt.labelPt}</span>
                      </label>
                    );
                  })}
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-ink-secondary">
                    {es
                      ? "Otro motivo personalizado (opcional)"
                      : "Outro motivo personalizado (opcional)"}
                  </span>
                  <input
                    type="text"
                    maxLength={220}
                    value={draft.customHandoffTrigger}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        customHandoffTrigger: e.target.value,
                      }))
                    }
                    placeholder="Ex.: Quando o cliente quiser falar direto com o dono."
                    className={inputClass}
                  />
                </label>
              </div>
            )}

            {activeTopic === "extra" && (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-ink-secondary">
                  {es
                    ? "Instrucciones adicionales libres"
                    : "Instruções extras livres para a Recepcionista IA"}
                </span>
                <textarea
                  rows={5}
                  maxLength={1500}
                  value={draft.extraInstructions}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      extraInstructions: e.target.value,
                    }))
                  }
                  placeholder="Ex.: Temos estacionamento gratuito nos fundos e café expresso cortesia na recepção."
                  className={textareaClass}
                />
              </label>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTopic(null)}
                className="rounded-xl text-xs font-semibold"
              >
                {es ? "Cancelar" : "Cancelar"}
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 text-xs font-semibold"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {es ? "Guardar tópico" : "Salvar tópico"}
              </Button>
            </div>
          </form>
        </AgendaDialog>
      )}
    </section>
  );
}
