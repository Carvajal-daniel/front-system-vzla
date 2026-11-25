"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  ChevronUp,
  Crown,
  FlaskConical,
  KeyRound,
  Loader2,
  Megaphone,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { ApiError } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import {
  intelligenceApi,
  type BillingUsageSummaryResponse,
} from "@/lib/intelligence-api";
import { useCompanySettings } from "@/lib/use-company-settings";
import { usePlanLimits } from "@/lib/use-plan-limits";
import {
  notifyWhatsAppConnectionUpdated,
  whatsappConnectionApi,
  type ConnectEvolutionResponse,
  type TenantWhatsAppChannelStatusDTO,
  type WhatsAppChannelsStatusResponse,
  type WhatsAppConnectionState,
} from "@/lib/whatsapp-connection";
import {
  whatsappInboxApi,
  type WhatsAppConversationItem,
} from "@/lib/whatsapp-inbox";
import { WhatsAppTabs } from "../../whatsapp/_components/whatsapp-tabs";
import {
  WhatsAppConnectionWizard,
  type MutedContactItem,
} from "./_components/connection-wizard";
import { GuidedAiConfigurator } from "./_components/guided-ai-configurator";
import {
  compileGuidedConfigToPrompt,
  DEFAULT_GUIDED_CONFIG,
  parsePromptToGuidedConfig,
  type GuidedReceptionistConfig,
} from "./_components/guided-prompt-config";
import { WhatsAppOverviewCards } from "./_components/overview-cards";

const fieldClass =
  "h-10 w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 text-sm text-ink placeholder:text-ink-muted focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25";

function getMutedStorageKey(companyId: string): string {
  return `cloudgo:whatsapp:muted-contacts:${companyId}`;
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export default function WhatsAppSettingsPage() {
  const { locale } = useLocale();
  const es = locale === "es";
  const { session } = useSession();
  const { currentPlan } = usePlanLimits();

  const companyId = session.company.id;
  const companyName = session.company.companyName;
  const { settings: companySettings } = useCompanySettings(
    companyId,
    undefined,
    Boolean(companyId),
    true,
  );

  const [connection, setConnection] = useState<WhatsAppConnectionState | null>(
    null,
  );
  const [channelsState, setChannelsState] =
    useState<WhatsAppChannelsStatusResponse | null>(null);
  const [conversations, setConversations] = useState<WhatsAppConversationItem[]>(
    [],
  );
  const [billingUsage, setBillingUsage] =
    useState<BillingUsageSummaryResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estado do Wizard Evolution (QR Code / Pairing Code e tela de sucesso)
  const [wizardOpen, setWizardOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connectResult, setConnectResult] =
    useState<ConnectEvolutionResponse | null>(null);

  // Estado da Recepcionista IA e Configurador Guiado
  const [aiAutopilotEnabled, setAiAutopilotEnabled] = useState(true);
  const [guidedConfig, setGuidedConfig] = useState<GuidedReceptionistConfig>(
    DEFAULT_GUIDED_CONFIG,
  );
  const [savingSettings, setSavingSettings] = useState(false);

  // Contatos silenciados (não clientes) persistidos localmente por empresa
  const [mutedContacts, setMutedContacts] = useState<MutedContactItem[]>([]);

  // Bloco secundário Datafy (Campanhas em Massa)
  const [showDatafy, setShowDatafy] = useState(false);
  const [datafyEnabled, setDatafyEnabled] = useState(false);
  const [datafyInstanceId, setDatafyInstanceId] = useState("");
  const [datafyApiToken, setDatafyApiToken] = useState("");
  const [savingDatafy, setSavingDatafy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !companyId) return;
    try {
      const raw = window.localStorage.getItem(getMutedStorageKey(companyId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as MutedContactItem[];
      if (Array.isArray(parsed)) {
        setMutedContacts(parsed);
      }
    } catch {
      // Ignora conteúdo inválido no storage local
    }
  }, [companyId]);

  const persistMutedContacts = useCallback(
    (next: MutedContactItem[]) => {
      setMutedContacts(next);
      if (typeof window !== "undefined" && companyId) {
        try {
          window.localStorage.setItem(
            getMutedStorageKey(companyId),
            JSON.stringify(next),
          );
        } catch {
          // Ignora erro de quota do storage
        }
      }
    },
    [companyId],
  );

  const syncFromState = useCallback((state: WhatsAppConnectionState) => {
    setConnection(state);
    setAiAutopilotEnabled(state.settings.aiAutopilotEnabled);
    setGuidedConfig(parsePromptToGuidedConfig(state.settings.aiSystemPrompt));
    setDatafyEnabled(state.datafy.enabled);
    setDatafyInstanceId(state.datafy.instanceId ?? "");
  }, []);

  const evolutionChannel: TenantWhatsAppChannelStatusDTO | undefined =
    channelsState?.channels.find((channel) => channel.provider === "EVOLUTION");

  const loadAll = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);
      else setRefreshing(true);

      try {
        const [state, channels, convRes, usageRes] = await Promise.all([
          whatsappConnectionApi.get(),
          whatsappConnectionApi.getChannelsStatus(),
          whatsappInboxApi
            .listConversations()
            .catch(() => ({ conversations: [] as WhatsAppConversationItem[] })),
          intelligenceApi.getBillingUsage().catch(() => null),
        ]);
        syncFromState(state);
        setChannelsState(channels);
        setConversations(convRes.conversations ?? []);
        setBillingUsage(usageRes);

        const evo = channels.channels.find((c) => c.provider === "EVOLUTION");
        const resolvedStatus =
          evo?.status ?? state.evolution.status ?? "DISCONNECTED";
        notifyWhatsAppConnectionUpdated(resolvedStatus);
        if (resolvedStatus === "CONNECTED") {
          setConnectResult(null);
        }
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : es
              ? "No fue posible cargar el estado de WhatsApp."
              : "Não foi possível carregar o status do WhatsApp.";
        toast.error(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [es, syncFromState],
  );

  useEffect(() => {
    void loadAll(true);
  }, [loadAll]);

  const currentEvolutionStatus =
    evolutionChannel?.status ?? connection?.evolution.status ?? "DISCONNECTED";
  const isEvolutionConnected = currentEvolutionStatus === "CONNECTED";
  const evolutionPhoneNumber =
    evolutionChannel?.phoneNumber ?? connection?.evolution.phoneNumber ?? null;

  // Polling leve a cada 5s em /v1/whatsapp/channels/status enquanto aguarda leitura do QR Code
  useEffect(() => {
    const shouldPoll =
      Boolean(connectResult) || currentEvolutionStatus === "QRCODE_PENDING";
    if (!shouldPoll || isEvolutionConnected) return;

    const interval = setInterval(() => {
      void whatsappConnectionApi
        .getChannelsStatus()
        .then((channels) => {
          setChannelsState(channels);
          const evo = channels.channels.find((c) => c.provider === "EVOLUTION");
          if (evo?.status) {
            notifyWhatsAppConnectionUpdated(evo.status);
          }
          if (evo?.status === "CONNECTED") {
            setConnectResult(null);
            setWizardOpen(true);
            toast.success(
              es
                ? "¡WhatsApp conectado con éxito!"
                : "WhatsApp conectado com sucesso!",
            );
          }
        })
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(interval);
  }, [connectResult, currentEvolutionStatus, isEvolutionConnected, es]);

  // Conversas pausadas ou em modo HUMAN aguardando atendente humano
  const humanQueueCount = useMemo(() => {
    const nowMs = Date.now();
    return conversations.filter((conv) => {
      if (conv.assignedMode === "HUMAN") return true;
      if (conv.aiPausedUntil) {
        const untilMs = new Date(conv.aiPausedUntil).getTime();
        if (Number.isFinite(untilMs) && untilMs > nowMs) return true;
      }
      return false;
    }).length;
  }, [conversations]);

  const handleGenerateConnection = useCallback(async () => {
    setConnecting(true);
    try {
      const response = await whatsappConnectionApi.connectEvolution();
      notifyWhatsAppConnectionUpdated(response.status);
      if (response.status === "CONNECTED") {
        setConnectResult(null);
        await loadAll(false);
        toast.success(
          es ? "WhatsApp ya está conectado." : "WhatsApp já está conectado.",
        );
      } else {
        setConnectResult(response);
      }
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : es
            ? "No fue posible iniciar la conexión de WhatsApp."
            : "Não foi possível iniciar a conexão do WhatsApp.",
      );
    } finally {
      setConnecting(false);
    }
  }, [es, loadAll]);

  async function handleDisconnectEvolution() {
    setDisconnecting(true);
    try {
      await whatsappConnectionApi.disconnectEvolution();
      setConnectResult(null);
      notifyWhatsAppConnectionUpdated("DISCONNECTED");
      await loadAll(false);
      toast.success(
        es ? "WhatsApp desconectado." : "WhatsApp desconectado com sucesso.",
      );
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : es
            ? "No fue posible desconectar WhatsApp."
            : "Não foi possível desconectar o WhatsApp.",
      );
    } finally {
      setDisconnecting(false);
    }
  }

  async function persistSettings(params: {
    nextAutopilot: boolean;
    nextConfig: GuidedReceptionistConfig;
    successMessage?: string;
  }) {
    setSavingSettings(true);
    try {
      const compiledPrompt = compileGuidedConfigToPrompt(params.nextConfig);
      const updated = await whatsappConnectionApi.saveSettings({
        aiAutopilotEnabled: params.nextAutopilot,
        aiSystemPrompt: compiledPrompt,
      });
      syncFromState(updated);
      toast.success(
        params.successMessage ??
          (es
            ? "Configuración de la Recepcionista IA guardada."
            : "Configurações da Recepcionista IA salvas!"),
      );
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : es
            ? "No fue posible guardar la configuración."
            : "Não foi possível salvar as configurações.",
      );
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleToggleAutopilot(enabled: boolean) {
    setAiAutopilotEnabled(enabled);
    await persistSettings({
      nextAutopilot: enabled,
      nextConfig: guidedConfig,
      successMessage: enabled
        ? es
          ? "Recepcionista IA activada."
          : "Recepcionista IA ativada!"
        : es
          ? "Recepcionista IA pausada (solo recordatorios activos)."
          : "Recepcionista IA desativada (apenas lembretes ativos).",
    });
  }

  async function handleSelectWizardMode(enableAi: boolean) {
    setAiAutopilotEnabled(enableAi);
    await persistSettings({
      nextAutopilot: enableAi,
      nextConfig: guidedConfig,
      successMessage: enableAi
        ? es
          ? "Modo Recepcionista IA seleccionado."
          : "Modo Recepcionista IA selecionado."
        : es
          ? "Modo Solo Recordatorios seleccionado."
          : "Modo Apenas Lembretes selecionado.",
    });
  }

  async function handleSaveGuidedTopic(nextConfig: GuidedReceptionistConfig) {
    setGuidedConfig(nextConfig);
    await persistSettings({
      nextAutopilot: aiAutopilotEnabled,
      nextConfig,
      successMessage: es
        ? "Tema guardado y compilado en tu agente IA."
        : "Tópico salvo e compilado na sua Recepcionista IA!",
    });
  }

  async function handleAddMutedContact(input: { label: string; phone: string }) {
    const newItem: MutedContactItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: input.label,
      phone: input.phone,
    };
    const next = [newItem, ...mutedContacts];
    persistMutedContacts(next);

    // Se já existir conversa com esse número no Inbox, pausa a IA imediatamente (24h)
    const targetDigits = normalizePhoneDigits(input.phone);
    const matchingConv = conversations.find((conv) => {
      const convDigits = normalizePhoneDigits(conv.phone);
      return (
        convDigits === targetDigits ||
        convDigits.endsWith(targetDigits) ||
        targetDigits.endsWith(convDigits)
      );
    });

    if (matchingConv) {
      try {
        await whatsappInboxApi.pauseAi(matchingConv.id, 1440);
        await loadAll(false);
      } catch {
        // Mantém o contato registrado mesmo se a pausa imediata falhar
      }
    }

    toast.success(
      es
        ? "Contacto agregado a la lista de silenciados."
        : "Contato adicionado aos silenciados.",
    );
  }

  function handleRemoveMutedContact(id: string) {
    persistMutedContacts(mutedContacts.filter((item) => item.id !== id));
    toast.info(es ? "Contacto eliminado." : "Contato removido dos silenciados.");
  }

  async function handleSaveDatafy(event: React.FormEvent) {
    event.preventDefault();
    setSavingDatafy(true);
    try {
      const updated = await whatsappConnectionApi.saveDatafy({
        enabled: true,
        datafyInstanceId: datafyInstanceId.trim(),
        ...(datafyApiToken.trim()
          ? { datafyApiToken: datafyApiToken.trim() }
          : {}),
      });
      syncFromState(updated);
      setDatafyApiToken("");
      toast.success(
        es
          ? "Credenciales de Datafy validadas y guardadas."
          : "Credenciais da Datafy validadas e salvas com sucesso.",
      );
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : es
            ? "No fue posible guardar las credenciales de Datafy."
            : "Não foi possível salvar as credenciais da Datafy.",
      );
    } finally {
      setSavingDatafy(false);
    }
  }

  async function handleDisableDatafy() {
    setSavingDatafy(true);
    try {
      const updated = await whatsappConnectionApi.saveDatafy({
        enabled: false,
      });
      syncFromState(updated);
      toast.info(
        es ? "Canal de campañas desactivado." : "Canal de campanhas desativado.",
      );
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : es
            ? "No fue posible desactivar Datafy."
            : "Não foi possível desativar a Datafy.",
      );
    } finally {
      setSavingDatafy(false);
    }
  }

  const shouldShowWizard = !isEvolutionConnected || wizardOpen;
  const isDatafyConnected =
    Boolean(connection?.datafy.enabled) &&
    connection?.datafy.status === "CONNECTED";

  return (
    <div className="space-y-6">
      <WhatsAppTabs active="settings" />

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/owner/settings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} />
            {es ? "Volver a Configuración" : "Voltar para Configurações"}
          </Link>
          <h1 className="flex items-center gap-2.5 text-xl sm:text-2xl font-bold tracking-tight text-ink">
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500">
              <WhatsAppIcon className="size-5" />
            </span>
            {es
              ? "Recepcionista IA y Canales WhatsApp"
              : "Recepcionista IA & Canais WhatsApp"}
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted">
            {es
              ? "Conecta tu número, monitorea recordatorios y personaliza el comportamiento de tu Recepcionista IA paso a paso."
              : "Conecte seu número, acompanhe lembretes e fila humana, e personalize sua Recepcionista IA de forma guiada."}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void loadAll(false)}
          disabled={loading || refreshing}
          className="rounded-xl border-border-subtle bg-surface text-xs font-semibold text-ink hover:border-emerald-500"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {es ? "Actualizar estado" : "Atualizar status"}
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border-subtle bg-surface py-20 shadow-xs">
          <Loader2 className="size-8 animate-spin text-emerald-500" />
          <p className="mt-3 text-xs text-ink-muted">
            {es
              ? "Cargando estado de canales y métricas..."
              : "Carregando status dos canais e métricas..."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. Cards de Visão Geral no topo */}
          <WhatsAppOverviewCards
            es={es}
            status={currentEvolutionStatus}
            phoneNumber={evolutionPhoneNumber}
            remindersEnabled={Boolean(companySettings.reminders?.enabled)}
            remindersSent30d={billingUsage?.outboundMessages.used ?? 0}
            humanQueueCount={humanQueueCount}
            disconnecting={disconnecting}
            onOpenWizard={() => setWizardOpen(true)}
            onDisconnect={() => void handleDisconnectEvolution()}
          />

          {/* 2. Wizard de Conexão em 2 etapas (visível quando desconectado ou ao clicar em Configurar) */}
          {shouldShowWizard && (
            <WhatsAppConnectionWizard
              es={es}
              companyId={companyId}
              status={currentEvolutionStatus}
              phoneNumber={evolutionPhoneNumber}
              aiAutopilotEnabled={aiAutopilotEnabled}
              connecting={connecting}
              connectResult={connectResult}
              mutedContacts={mutedContacts}
              onSelectServiceMode={handleSelectWizardMode}
              onGenerateConnection={handleGenerateConnection}
              onRefreshStatus={() => loadAll(false)}
              onAddMutedContact={handleAddMutedContact}
              onRemoveMutedContact={handleRemoveMutedContact}
              onClose={
                isEvolutionConnected ? () => setWizardOpen(false) : undefined
              }
            />
          )}

          {/* Switch principal da Recepcionista IA + Botão "Testar no Simulador antes de ativar" */}
          <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500">
                  <Bot size={20} />
                </span>
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-ink">
                      {es
                        ? "Piloto Automático de la Recepcionista IA"
                        : "Piloto Automático da Recepcionista IA"}
                    </h2>
                    {billingUsage && (
                      <span className="rounded-full border border-border-subtle bg-canvas/60 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-ink-secondary">
                        {billingUsage.aiSessions.used}/
                        {billingUsage.aiSessions.limit}{" "}
                        {es ? "sesiones IA" : "sessões IA"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted">
                    {es
                      ? "Activa las respuestas automáticas 24/7 en WhatsApp o prueba primero tus ajustes en el simulador."
                      : "Ative o atendimento automático 24/7 no WhatsApp ou teste suas configurações primeiro no simulador."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/owner/whatsapp"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3.5 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                >
                  <FlaskConical size={14} />
                  {es
                    ? "Probar en el Simulador antes de activar"
                    : "Testar no Simulador antes de ativar"}
                </Link>

                <label className="relative inline-flex cursor-pointer items-center shrink-0">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    disabled={savingSettings}
                    checked={aiAutopilotEnabled}
                    onChange={(event) =>
                      void handleToggleAutopilot(event.target.checked)
                    }
                  />
                  <span className="h-6 w-11 rounded-full bg-border-subtle transition-colors peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
                </label>
              </div>
            </div>
          </section>

          {/* 3. Configurador Guiado da Recepcionista IA (6 tópicos) */}
          <GuidedAiConfigurator
            es={es}
            companyName={companyName}
            config={guidedConfig}
            saving={savingSettings}
            onSaveConfig={handleSaveGuidedTopic}
          />

          {/* Seção secundária colapsável: API Oficial Datafy (Campanhas em Massa) */}
          <section className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDatafy((prev) => !prev)}
              className="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-subtle/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-subtle text-ink-secondary">
                  <Megaphone size={18} />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-ink">
                      {es
                        ? "Campañas y Envíos Masivos (API Oficial Datafy)"
                        : "Campanhas & Disparos em Massa (API Oficial Datafy)"}
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                      <Crown size={11} />
                      Pro / Enterprise
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted">
                    {es
                      ? "Canal dedicado para campañas de reactivación protegiendo tu número principal."
                      : "Canal dedicado para campanhas de reativação com segurança para seu número principal."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                    isDatafyConnected
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                      : "border-border-subtle bg-subtle text-ink-secondary"
                  }`}
                >
                  {isDatafyConnected ? (
                    <ShieldCheck size={12} />
                  ) : (
                    <KeyRound size={12} />
                  )}
                  {isDatafyConnected ? "Conectado" : "Desconectado"}
                </span>
                {showDatafy ? (
                  <ChevronUp size={16} className="text-ink-muted" />
                ) : (
                  <ChevronDown size={16} className="text-ink-muted" />
                )}
              </div>
            </button>

            {showDatafy && (
              <div className="border-t border-border-subtle p-5 space-y-4">
                {currentPlan === "TRIAL" && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-600 dark:text-amber-300">
                    <p className="font-semibold">
                      {es
                        ? "Recurso recomendado para planes superiores"
                        : "Recurso para planos superiores"}
                    </p>
                    <p className="mt-0.5 opacity-90">
                      {es
                        ? "Puedes preconfigurar tus credenciales de la API Oficial Datafy ahora."
                        : "Você já pode configurar suas credenciais da API Oficial Datafy abaixo."}
                    </p>
                  </div>
                )}

                <form
                  onSubmit={handleSaveDatafy}
                  className="grid grid-cols-1 gap-4 md:grid-cols-2"
                >
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-ink-secondary">
                      Datafy Instance ID
                    </span>
                    <input
                      type="text"
                      required
                      maxLength={160}
                      value={datafyInstanceId}
                      onChange={(event) =>
                        setDatafyInstanceId(event.target.value)
                      }
                      placeholder="ex.: dfy_inst_9a8b7c6d"
                      className={fieldClass}
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="flex items-center justify-between text-xs font-semibold text-ink-secondary">
                      <span>Datafy API Token</span>
                      {connection?.datafy.hasApiToken && (
                        <span className="text-[11px] font-medium text-emerald-500">
                          {es
                            ? "Token guardado (cifrado)"
                            : "Token salvo (criptografado)"}
                        </span>
                      )}
                    </span>
                    <input
                      type="password"
                      required={!connection?.datafy.hasApiToken}
                      maxLength={512}
                      value={datafyApiToken}
                      onChange={(event) =>
                        setDatafyApiToken(event.target.value)
                      }
                      placeholder={
                        connection?.datafy.hasApiToken
                          ? es
                            ? "Dejar vacío para mantener el token actual"
                            : "Deixe em branco para manter o token atual"
                          : es
                            ? "Ingresa tu API Token de Datafy"
                            : "Informe o API Token da Datafy"
                      }
                      className={fieldClass}
                    />
                  </label>

                  <div className="flex flex-wrap items-center justify-end gap-2 md:col-span-2">
                    {datafyEnabled && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleDisableDatafy()}
                        disabled={savingDatafy}
                        className="rounded-xl border-border-subtle text-xs font-semibold"
                      >
                        {es ? "Desactivar canal" : "Desativar canal"}
                      </Button>
                    )}

                    <Button
                      type="submit"
                      disabled={savingDatafy}
                      className="rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 text-xs font-semibold"
                    >
                      {savingDatafy ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={14} />
                      )}
                      {es ? "Validar y guardar Datafy" : "Validar e salvar Datafy"}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
