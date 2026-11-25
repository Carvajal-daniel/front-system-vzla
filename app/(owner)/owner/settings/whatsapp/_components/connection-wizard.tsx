"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BellRing,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type {
  ConnectEvolutionResponse,
  EvolutionConnectionStatus,
} from "@/lib/whatsapp-connection";

export interface MutedContactItem {
  id: string;
  label: string;
  phone: string;
}

export interface WhatsAppConnectionWizardProps {
  es: boolean;
  companyId: string;
  status: EvolutionConnectionStatus;
  phoneNumber: string | null;
  aiAutopilotEnabled: boolean;
  connecting: boolean;
  connectResult: ConnectEvolutionResponse | null;
  mutedContacts: MutedContactItem[];
  onSelectServiceMode: (enableAi: boolean) => Promise<void>;
  onGenerateConnection: () => Promise<void>;
  onRefreshStatus: () => Promise<void>;
  onAddMutedContact: (contact: { label: string; phone: string }) => Promise<void>;
  onRemoveMutedContact: (id: string) => void;
  onClose?: () => void;
}

const QR_TTL_SECONDS = 20;

export function WhatsAppConnectionWizard({
  es,
  status,
  phoneNumber,
  aiAutopilotEnabled,
  connecting,
  connectResult,
  mutedContacts,
  onSelectServiceMode,
  onGenerateConnection,
  onRefreshStatus,
  onAddMutedContact,
  onRemoveMutedContact,
  onClose,
}: WhatsAppConnectionWizardProps) {
  const isConnected = status === "CONNECTED";

  const [step, setStep] = useState<1 | 2>(isConnected ? 2 : 1);
  const [selectedMode, setSelectedMode] = useState<"AI" | "REMINDERS_ONLY">(
    aiAutopilotEnabled ? "AI" : "REMINDERS_ONLY",
  );
  const [savingMode, setSavingMode] = useState(false);

  const [pairMethod, setPairMethod] = useState<"QR" | "PAIRING_CODE">("QR");
  const [acceptedAntiBan, setAcceptedAntiBan] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(QR_TTL_SECONDS);

  const [mutedLabel, setMutedLabel] = useState("");
  const [mutedPhone, setMutedPhone] = useState("");
  const [addingMuted, setAddingMuted] = useState(false);

  useEffect(() => {
    setSelectedMode(aiAutopilotEnabled ? "AI" : "REMINDERS_ONLY");
  }, [aiAutopilotEnabled]);

  // Contador regressivo de 20s para renovação visual do QR Code enquanto aguarda leitura
  useEffect(() => {
    if (isConnected || !connectResult?.qrCodeBase64 || pairMethod !== "QR") {
      return;
    }
    setSecondsLeft(QR_TTL_SECONDS);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          void onGenerateConnection();
          return QR_TTL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isConnected, connectResult?.qrCodeBase64, pairMethod, onGenerateConnection]);

  async function handleContinueToStep2() {
    setSavingMode(true);
    try {
      await onSelectServiceMode(selectedMode === "AI");
      setStep(2);
    } finally {
      setSavingMode(false);
    }
  }

  async function handleAddMuted(event: React.FormEvent) {
    event.preventDefault();
    const cleanPhone = mutedPhone.trim();
    if (cleanPhone.replace(/\D/g, "").length < 10) {
      toast.error(
        es
          ? "Ingresa un teléfono válido con código de área."
          : "Informe um telefone válido com DDD.",
      );
      return;
    }
    setAddingMuted(true);
    try {
      await onAddMutedContact({
        label: mutedLabel.trim() || (es ? "Contacto personal" : "Contato pessoal"),
        phone: cleanPhone,
      });
      setMutedLabel("");
      setMutedPhone("");
    } finally {
      setAddingMuted(false);
    }
  }

  const progressPct = Math.max(0, Math.min(100, (secondsLeft / QR_TTL_SECONDS) * 100));

  return (
    <section className="rounded-2xl border border-emerald-500/25 bg-surface p-5 sm:p-6 shadow-xs space-y-6">
      {/* Cabeçalho e stepper */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-500">
            <Sparkles size={12} />
            {isConnected
              ? es
                ? "Canal Conectado"
                : "Canal Conectado"
              : es
                ? `Asistente de Conexión · Etapa ${step} de 2`
                : `Assistente de Conexão · Etapa ${step} de 2`}
          </div>
          <h2 className="text-base sm:text-lg font-bold text-ink">
            {isConnected
              ? es
                ? "Tu WhatsApp está activo y listo"
                : "Seu WhatsApp está ativo e pronto"
              : step === 1
                ? es
                  ? "Etapa 1 — ¿Quién atiende a tus clientes?"
                  : "Etapa 1 — Quem atende seus clientes?"
                : es
                  ? "Etapa 2 — Conecta tu WhatsApp"
                  : "Etapa 2 — Conecte seu WhatsApp"}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {!isConnected && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  step === 1
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-subtle text-ink-secondary hover:text-ink"
                }`}
              >
                1. {es ? "Modo" : "Modo"}
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  step === 2
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-subtle text-ink-secondary hover:text-ink"
                }`}
              >
                2. {es ? "Conexión" : "Conexão"}
              </button>
            </div>
          )}
          {onClose && isConnected && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-xl text-xs font-semibold"
            >
              {es ? "Ocultar" : "Ocultar"}
            </Button>
          )}
        </div>
      </div>

      {/* TELA DE SUCESSO QUANDO CONECTADO */}
      {isConnected ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-emerald-500">
                <CheckCircle2 size={22} />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-bold text-ink">
                  {es
                    ? "Conexión establecida con Evolution API v2"
                    : "Conexão estabelecida via Evolution API v2"}
                </p>
                <p className="text-xs text-ink-secondary">
                  {es
                    ? "Número activo respondiendo en tiempo real:"
                    : "Número ativo operando em tempo real:"}
                </p>
                <p className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-canvas/70 px-3 py-1 font-mono text-sm font-semibold text-emerald-500">
                  {phoneNumber ?? (es ? "Número sincronizado" : "Número sincronizado")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep(1)}
                className="rounded-xl text-xs font-semibold"
              >
                {es ? "Cambiar modo (IA / Recordatorios)" : "Alterar modo (IA / Lembretes)"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onRefreshStatus()}
                className="rounded-xl text-xs font-semibold"
              >
                <RefreshCw size={13} />
                {es ? "Sincronizar" : "Sincronizar"}
              </Button>
            </div>
          </div>

          {/* Card de Contatos Silenciados (não clientes) */}
          <div className="rounded-2xl border border-border-subtle bg-canvas/40 p-5 space-y-3.5">
            <div className="flex items-start gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-subtle text-ink-secondary">
                <VolumeX size={16} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-ink">
                  {es
                    ? "Contactos Silenciados (no clientes)"
                    : "Contatos Silenciados (não clientes)"}
                </h3>
                <p className="text-xs text-ink-muted">
                  {es
                    ? "Agrega familiares o proveedores para pausar la IA automáticamente y no gastar cuota."
                    : "Cadastre família ou fornecedores para evitar gastar cota da IA com conversas pessoais."}
                </p>
              </div>
            </div>

            <form
              onSubmit={handleAddMuted}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]"
            >
              <input
                type="text"
                value={mutedLabel}
                onChange={(e) => setMutedLabel(e.target.value)}
                placeholder={es ? "Nombre (ej. Proveedor)" : "Nome (ex.: Fornecedor)"}
                className="h-9 rounded-xl border border-border-subtle bg-surface px-3 text-xs text-ink placeholder:text-ink-muted focus:border-emerald-500 focus:outline-none"
              />
              <input
                type="tel"
                required
                value={mutedPhone}
                onChange={(e) => setMutedPhone(e.target.value)}
                placeholder="+55 11 99999-0000"
                className="h-9 rounded-xl border border-border-subtle bg-surface px-3 font-mono text-xs text-ink placeholder:text-ink-muted focus:border-emerald-500 focus:outline-none"
              />
              <Button
                type="submit"
                size="sm"
                disabled={addingMuted}
                className="h-9 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 text-xs font-semibold"
              >
                {addingMuted ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                {es ? "Silenciar" : "Silenciar"}
              </Button>
            </form>

            {mutedContacts.length === 0 ? (
              <p className="text-[11px] text-ink-muted">
                {es
                  ? "Ningún contacto silenciado todavía."
                  : "Nenhum contato silenciado ainda."}
              </p>
            ) : (
              <ul className="max-h-32 space-y-1.5 overflow-y-auto pr-1">
                {mutedContacts.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-ink">{item.label}</span>
                      <span className="ml-2 font-mono text-[11px] text-ink-muted">
                        {item.phone}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveMutedContact(item.id)}
                      className="text-ink-muted hover:text-rose-500 transition-colors cursor-pointer"
                      aria-label={es ? "Eliminar" : "Remover"}
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : step === 1 ? (
        /* ETAPA 1: Quem atende seus clientes? */
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Opção A: Recepcionista IA */}
            <button
              type="button"
              onClick={() => setSelectedMode("AI")}
              className={`group flex flex-col justify-between rounded-2xl border p-5 text-left transition-all cursor-pointer ${
                selectedMode === "AI"
                  ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20"
                  : "border-border-subtle bg-canvas/40 hover:border-border-strong"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-500">
                    <Bot size={20} />
                  </span>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                    {es ? "Recomendado" : "Recomendado"}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">
                    {es ? "Recepcionista IA Completa" : "Recepcionista IA"}
                  </h3>
                  <p className="mt-1 text-xs text-ink-secondary">
                    {es
                      ? "Atiende 24/7 por WhatsApp: agenda, reprograma, muestra el catálogo por categorías y presenta planes de suscripción."
                      : "Atende 24/7 no WhatsApp: agenda, remarca, envia catálogo completo por categorias e apresenta planos de assinatura."}
                  </p>
                </div>
                <ul className="space-y-1.5 pt-1 text-xs text-ink-secondary">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500 shrink-0" />
                    {es
                      ? "Agendamiento y reprogramación en tiempo real"
                      : "Agendamento, remarcação e cancelamento automáticos"}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500 shrink-0" />
                    {es
                      ? "Catálogo organizado y planes de suscripción"
                      : "Catálogo enxuto e divulgação de planos de assinatura"}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500 shrink-0" />
                    {es
                      ? "Consume cuota de conversaciones IA del plan"
                      : "Consome cota de conversas IA do seu plano"}
                  </li>
                </ul>
              </div>
            </button>

            {/* Opção B: Apenas Lembretes */}
            <button
              type="button"
              onClick={() => setSelectedMode("REMINDERS_ONLY")}
              className={`group flex flex-col justify-between rounded-2xl border p-5 text-left transition-all cursor-pointer ${
                selectedMode === "REMINDERS_ONLY"
                  ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20"
                  : "border-border-subtle bg-canvas/40 hover:border-border-strong"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="grid size-10 place-items-center rounded-xl bg-subtle text-ink-secondary">
                    <BellRing size={20} />
                  </span>
                  <span className="rounded-full border border-border-subtle bg-subtle px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-secondary">
                    {es ? "Sin consumo IA" : "Sem consumo de IA"}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">
                    {es ? "Solo Recordatorios" : "Apenas Lembretes"}
                  </h3>
                  <p className="mt-1 text-xs text-ink-secondary">
                    {es
                      ? "Usa tu WhatsApp solo para confirmaciones automáticas 24h/2h antes de la cita y encuesta NPS post-visita."
                      : "Use seu WhatsApp apenas para confirmações automáticas 24h/2h antes do horário e pesquisa de satisfação pós-visita."}
                  </p>
                </div>
                <ul className="space-y-1.5 pt-1 text-xs text-ink-secondary">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500 shrink-0" />
                    {es
                      ? "Recordatorios automáticos 24h y 2h antes"
                      : "Lembretes automáticos 24h e 2h antes do atendimento"}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500 shrink-0" />
                    {es
                      ? "Encuesta de satisfacción (NPS 1 a 5) + Google Maps"
                      : "Pesquisa de satisfação (NPS 1 a 5) + link Google Maps"}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500 shrink-0" />
                    {es
                      ? "0 consumo de cuota IA (tu equipo responde el chat)"
                      : "Zero consumo de cota IA (sua equipe responde o chat)"}
                  </li>
                </ul>
              </div>
            </button>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void handleContinueToStep2()}
              disabled={savingMode}
              className="rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold text-xs px-5"
            >
              {savingMode ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ArrowRight size={14} />
              )}
              {es
                ? "Guardar modo y continuar a la conexión"
                : "Salvar modo e ir para conexão"}
            </Button>
          </div>
        </div>
      ) : (
        /* ETAPA 2: Conecte seu WhatsApp (QR Code / Pairing Code) */
        <div className="space-y-5">
          {/* Seletor QR Code vs Pairing Code */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-border-subtle bg-canvas/50 p-1">
              <button
                type="button"
                onClick={() => setPairMethod("QR")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  pairMethod === "QR"
                    ? "bg-emerald-500 text-slate-950"
                    : "text-ink-secondary hover:text-ink"
                }`}
              >
                <QrCode size={14} />
                {es ? "Leer QR Code" : "Ler QR Code"}
              </button>
              <button
                type="button"
                onClick={() => setPairMethod("PAIRING_CODE")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  pairMethod === "PAIRING_CODE"
                    ? "bg-emerald-500 text-slate-950"
                    : "text-ink-secondary hover:text-ink"
                }`}
              >
                <KeyRound size={14} />
                {es ? "Código de Pareamento" : "Código de Pareamento"}
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep(1)}
              className="rounded-xl text-xs font-semibold"
            >
              <ArrowLeft size={13} />
              {es ? "Volver a Etapa 1" : "Voltar para Etapa 1"}
            </Button>
          </div>

          {/* Aviso de boas práticas anti-bloqueio */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-500" />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-ink">
                  {es
                    ? "Buenas prácticas anti-bloqueo de WhatsApp"
                    : "Boas práticas anti-bloqueio do WhatsApp"}
                </p>
                <p className="text-ink-secondary leading-relaxed">
                  {es
                    ? "Usa un número ya calentado (no chip recién estrenado), evita envíos masivos por este canal (usa Datafy/API Oficial para campañas) y mantén activas las respuestas solo para clientes que escriben primero."
                    : "Use um número já ativo (evite chip recém-comprado sem histórico), não faça disparos em massa por este canal (use o canal oficial para campanhas) e responda apenas clientes que iniciarem contato ou tiverem agendamento."}
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none rounded-xl border border-amber-500/25 bg-surface/70 px-3 py-2 text-xs font-medium text-ink">
              <input
                type="checkbox"
                checked={acceptedAntiBan}
                onChange={(e) => setAcceptedAntiBan(e.target.checked)}
                className="size-4 rounded accent-emerald-500 cursor-pointer"
              />
              <span>
                {es
                  ? "Entiendo las buenas prácticas de seguridad y quiero generar la conexión."
                  : "Li e estou ciente das boas práticas de segurança do WhatsApp para gerar o pareamento."}
              </span>
            </label>
          </div>

          {/* Área de pareamento */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-center">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border-subtle bg-canvas/50 p-6 text-center space-y-4">
              {!connectResult ? (
                <>
                  <span className="grid size-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-500">
                    {pairMethod === "QR" ? (
                      <QrCode size={28} />
                    ) : (
                      <KeyRound size={28} />
                    )}
                  </span>
                  <div className="space-y-1 max-w-xs">
                    <p className="text-sm font-bold text-ink">
                      {pairMethod === "QR"
                        ? es
                          ? "Genera tu QR Code seguro"
                          : "Gere seu QR Code seguro"
                        : es
                          ? "Genera tu Código de Pareamento"
                          : "Gere seu Código de Pareamento"}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {es
                        ? "Marca la casilla de arriba para habilitar la generación."
                        : "Marque a caixa de ciência acima para liberar a geração."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    disabled={!acceptedAntiBan || connecting}
                    onClick={() => void onGenerateConnection()}
                    className="rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold text-xs px-5"
                  >
                    {connecting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : pairMethod === "QR" ? (
                      <QrCode size={14} />
                    ) : (
                      <KeyRound size={14} />
                    )}
                    {pairMethod === "QR"
                      ? es
                        ? "Generar QR Code"
                        : "Gerar QR Code"
                      : es
                        ? "Generar Código de Pareamento"
                        : "Gerar Código de Pareamento"}
                  </Button>
                </>
              ) : pairMethod === "QR" ? (
                <>
                  {connectResult.qrCodeBase64 ? (
                    <div className="rounded-2xl border border-border-subtle bg-white p-3 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={connectResult.qrCodeBase64}
                        alt="WhatsApp QR Code"
                        className="size-52 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-500">
                      <AlertTriangle size={15} />
                      {es
                        ? "QR aún no disponible. Haz clic en renovar."
                        : "QR ainda não retornado. Clique em renovar."}
                    </div>
                  )}

                  {/* Barra de progresso de renovação 20s */}
                  <div className="w-full max-w-[230px] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-ink-muted">
                      <span>
                        {es ? "Renovación automática" : "Renovação automática"}
                      </span>
                      <span className="font-mono font-semibold text-emerald-500">
                        {secondsLeft}s
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-1000 ease-linear"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={connecting}
                      onClick={() => void onGenerateConnection()}
                      className="rounded-xl text-xs font-semibold"
                    >
                      <RefreshCw
                        size={13}
                        className={connecting ? "animate-spin" : ""}
                      />
                      {es ? "Renovar QR" : "Renovar QR"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void onRefreshStatus()}
                      className="rounded-xl text-xs font-semibold"
                    >
                      {es ? "Ya escaneé" : "Já escaneei"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {es ? "Código de Pareamento" : "Código de Pareamento"}
                  </p>
                  {connectResult.pairingCode ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-surface px-5 py-3">
                      <span className="font-mono text-xl font-bold tracking-widest text-emerald-500">
                        {connectResult.pairingCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(
                            connectResult.pairingCode ?? "",
                          );
                          toast.success(
                            es ? "Código copiado." : "Código copiado!",
                          );
                        }}
                        className="rounded-lg p-1.5 text-ink-secondary hover:bg-subtle hover:text-ink cursor-pointer"
                        aria-label="Copiar"
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                  ) : (
                    <p className="max-w-xs text-xs text-ink-muted">
                      {es
                        ? "La instancia no devolvió Pairing Code en este intento. Puedes usar la pestaña QR Code o intentar nuevamente."
                        : "A instância Evolution não retornou Pairing Code nesta tentativa. Use a aba Ler QR Code ou clique em gerar novamente."}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={connecting}
                      onClick={() => void onGenerateConnection()}
                      className="rounded-xl text-xs font-semibold"
                    >
                      <RefreshCw
                        size={13}
                        className={connecting ? "animate-spin" : ""}
                      />
                      {es ? "Generar nuevo código" : "Gerar novo código"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void onRefreshStatus()}
                      className="rounded-xl text-xs font-semibold"
                    >
                      {es ? "Verificar conexión" : "Verificar conexão"}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Passo a passo numerado */}
            <div className="space-y-4 rounded-2xl border border-border-subtle bg-canvas/30 p-5">
              <p className="text-sm font-bold text-ink">
                {es ? "Cómo conectar en 3 pasos" : "Como conectar em 3 passos"}
              </p>
              <ol className="space-y-3 text-xs text-ink-secondary">
                <li className="flex items-start gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500/15 font-mono text-xs font-bold text-emerald-500">
                    1
                  </span>
                  <span>
                    <strong className="text-ink">
                      {es ? "Abre WhatsApp" : "Abra o WhatsApp"}
                    </strong>{" "}
                    {es
                      ? "en el teléfono principal de tu barbería o salón."
                      : "no celular principal da sua barbearia ou salão."}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500/15 font-mono text-xs font-bold text-emerald-500">
                    2
                  </span>
                  <span>
                    {es ? "Toca en " : "Toque em "}
                    <strong className="text-ink">
                      {es
                        ? "Dispositivos vinculados → Vincular dispositivo"
                        : "Aparelhos conectados → Conectar aparelho"}
                    </strong>
                    .
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500/15 font-mono text-xs font-bold text-emerald-500">
                    3
                  </span>
                  <span>
                    {pairMethod === "QR" ? (
                      <>
                        <strong className="text-ink">
                          {es ? "Apunta la cámara" : "Aponte a câmera"}
                        </strong>{" "}
                        {es
                          ? "al QR Code de al lado y espera la confirmación automática."
                          : "para o QR Code ao lado e aguarde a confirmação automática."}
                      </>
                    ) : (
                      <>
                        {es ? "Elige " : "Selecione "}
                        <strong className="text-ink">
                          {es
                            ? "Vincular con número de teléfono"
                            : "Conectar com número de telefone"}
                        </strong>{" "}
                        {es
                          ? "e ingresa el Código de Pareamento generado."
                          : "e digite o Código de Pareamento exibido ao lado."}
                      </>
                    )}
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
