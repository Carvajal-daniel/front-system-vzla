"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Crown,
  KeyRound,
  Loader2,
  Megaphone,
  Power,
  QrCode,
  RefreshCw,
  Save,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { AgendaDialog } from "@/components/ui/agenda-controls";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { ApiError } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import { usePlanLimits } from "@/lib/use-plan-limits";
import {
  notifyWhatsAppConnectionUpdated,
  whatsappConnectionApi,
  type ConnectEvolutionResponse,
  type WhatsAppConnectionState,
} from "@/lib/whatsapp-connection";

const fieldClass =
  "h-10 w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25";

export default function WhatsAppSettingsPage() {
  const { locale } = useLocale();
  const es = locale === "es";
  const { currentPlan } = usePlanLimits();

  const [connection, setConnection] = useState<WhatsAppConnectionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estado do fluxo Evolution (QR Code e desconexão)
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [qrModal, setQrModal] = useState<ConnectEvolutionResponse | null>(null);

  // Configurações de IA do canal 1-a-1
  const [aiAutopilotEnabled, setAiAutopilotEnabled] = useState(true);
  const [aiSystemPrompt, setAiSystemPrompt] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Credenciais Datafy (Campanhas em Massa)
  const [datafyEnabled, setDatafyEnabled] = useState(false);
  const [datafyInstanceId, setDatafyInstanceId] = useState("");
  const [datafyApiToken, setDatafyApiToken] = useState("");
  const [savingDatafy, setSavingDatafy] = useState(false);

  const syncFromState = useCallback((state: WhatsAppConnectionState) => {
    setConnection(state);
    setAiAutopilotEnabled(state.settings.aiAutopilotEnabled);
    setAiSystemPrompt(state.settings.aiSystemPrompt ?? "");
    setDatafyEnabled(state.datafy.enabled);
    setDatafyInstanceId(state.datafy.instanceId ?? "");
  }, []);

  const loadConnection = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);
      else setRefreshing(true);

      try {
        const state = await whatsappConnectionApi.get();
        syncFromState(state);
        if (state.evolution.status === "CONNECTED") {
          setQrModal(null);
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
    void loadConnection(true);
  }, [loadConnection]);

  // Atualiza automaticamente enquanto aguarda leitura do QR Code
  useEffect(() => {
    if (!qrModal || connection?.evolution.status === "CONNECTED") return;
    const interval = setInterval(() => {
      void whatsappConnectionApi
        .get()
        .then((state) => {
          syncFromState(state);
          if (state.evolution.status === "CONNECTED") {
            setQrModal(null);
            notifyWhatsAppConnectionUpdated();
            toast.success(
              es ? "¡WhatsApp conectado con éxito!" : "WhatsApp conectado com sucesso!",
            );
          }
        })
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(interval);
  }, [qrModal, connection?.evolution.status, es, syncFromState]);

  async function handleConnectEvolution() {
    setConnecting(true);
    try {
      const response = await whatsappConnectionApi.connectEvolution();
      notifyWhatsAppConnectionUpdated();
      await loadConnection(false);

      if (response.status === "CONNECTED") {
        setQrModal(null);
        toast.success(
          es ? "WhatsApp ya está conectado." : "WhatsApp já está conectado.",
        );
      } else {
        setQrModal(response);
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
  }

  async function handleDisconnectEvolution() {
    setDisconnecting(true);
    try {
      await whatsappConnectionApi.disconnectEvolution();
      setQrModal(null);
      notifyWhatsAppConnectionUpdated();
      await loadConnection(false);
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

  async function handleSaveSettings(event: React.FormEvent) {
    event.preventDefault();
    setSavingSettings(true);
    try {
      const updated = await whatsappConnectionApi.saveSettings({
        aiAutopilotEnabled,
        aiSystemPrompt: aiSystemPrompt.trim() || null,
      });
      syncFromState(updated);
      toast.success(
        es
          ? "Configuración de atención guardada."
          : "Configurações de atendimento salvas com sucesso.",
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

  const evolutionStatus = connection?.evolution.status ?? "DISCONNECTED";
  const isEvolutionConnected = evolutionStatus === "CONNECTED";
  const isEvolutionPending = evolutionStatus === "QRCODE_PENDING";
  const isDatafyConnected =
    Boolean(connection?.datafy.enabled) &&
    connection?.datafy.status === "CONNECTED";

  return (
    <div className="space-y-6">
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
            <span className="grid size-9 place-items-center rounded-xl bg-[#25D366]/15 text-[#25D366]">
              <WhatsAppIcon className="size-5" />
            </span>
            {es ? "Conexión de WhatsApp y Canales" : "Conexão WhatsApp e Canais"}
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted">
            {es
              ? "Administra el WhatsApp de atención 1-a-1 (QR Code) y el canal oficial de campañas masivas (Datafy)."
              : "Gerencie o WhatsApp de atendimento 1-a-1 (QR Code) e o canal oficial de campanhas em massa (Datafy)."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/owner/whatsapp"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs"
          >
            <Bot size={14} />
            {es ? "Abrir Inbox y Simulador" : "Abrir Inbox & Simulador"}
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadConnection(false)}
            disabled={loading || refreshing}
            className="rounded-xl border-border-subtle bg-surface text-xs font-semibold text-ink hover:border-accent"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {es ? "Actualizar estado" : "Atualizar status"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border-subtle bg-surface py-20 shadow-xs">
          <Loader2 className="size-8 animate-spin text-accent" />
          <p className="mt-3 text-xs text-ink-muted">
            {es
              ? "Consultando estado de los canales..."
              : "Consultando status dos canais..."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* CARD 1: Atendimento & Agenda (WhatsApp QR Code - Evolution API) */}
          <section className="flex flex-col justify-between rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 shadow-xs space-y-6">
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <QrCode size={20} />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-ink">
                      {es
                        ? "Atención y Agenda (WhatsApp QR Code)"
                        : "Atendimento & Agenda (WhatsApp QR Code)"}
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {es
                        ? "Canal 1-a-1 vía Evolution API para recordatorios, confirmaciones y atención al cliente."
                        : "Canal 1-a-1 via Evolution API para lembretes, confirmações e atendimento direto."}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    isEvolutionConnected
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : isEvolutionPending
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {isEvolutionConnected ? (
                    <CheckCircle2 size={13} />
                  ) : (
                    <WifiOff size={13} />
                  )}
                  {isEvolutionConnected
                    ? es
                      ? "Conectado"
                      : "Conectado"
                    : isEvolutionPending
                      ? es
                        ? "Esperando QR Code"
                        : "Aguardando QR Code"
                      : es
                        ? "Desconectado"
                        : "Desconectado"}
                </span>
              </div>

              {/* Resumo da instância e botões de ação */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-canvas/40 p-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold text-ink">
                    {es ? "Instancia de la empresa" : "Instância da empresa"}
                  </p>
                  <p className="truncate font-mono text-[11px] text-ink-muted">
                    {connection?.evolution.instanceName}
                  </p>
                  {connection?.evolution.phoneNumber && (
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      {es ? "Número conectado:" : "Número conectado:"}{" "}
                      <span className="font-mono">
                        {connection.evolution.phoneNumber}
                      </span>
                    </p>
                  )}
                  {connection?.evolution.mode === "MOCK_READY" && (
                    <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                      {es
                        ? "Modo desarrollo (MOCK_READY)"
                        : "Modo desenvolvimento (MOCK_READY)"}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isEvolutionConnected && (
                    <Button
                      type="button"
                      onClick={() => void handleConnectEvolution()}
                      disabled={connecting}
                      className="rounded-xl bg-[#25D366] text-[#0F172A] hover:bg-[#20bd5a] font-semibold text-xs"
                    >
                      {connecting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <QrCode size={14} />
                      )}
                      {es ? "Conectar WhatsApp" : "Conectar WhatsApp"}
                    </Button>
                  )}

                  {(isEvolutionConnected || isEvolutionPending) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleDisconnectEvolution()}
                      disabled={disconnecting}
                      className="rounded-xl border-rose-500/30 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 text-xs font-semibold"
                    >
                      {disconnecting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Power size={14} />
                      )}
                      {es ? "Desconectar" : "Desconectar"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Configurações do Agente de Atendimento Automático (IA) */}
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="flex items-start justify-between gap-4 rounded-xl border border-border-subtle bg-canvas/30 p-4">
                  <div className="flex items-start gap-2.5">
                    <Bot size={18} className="mt-0.5 shrink-0 text-accent" />
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {es
                          ? "Atención automática por IA"
                          : "Atendimento automático por IA"}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {es
                          ? "Permite responder automáticamente consultas y horarios usando las instrucciones de abajo."
                          : "Permite responder dúvidas e horários automaticamente seguindo as instruções abaixo."}
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center shrink-0">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={aiAutopilotEnabled}
                      onChange={(event) =>
                        setAiAutopilotEnabled(event.target.checked)
                      }
                    />
                    <span className="h-6 w-11 rounded-full bg-border-subtle transition-colors peer-checked:bg-accent after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
                  </label>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-ink-secondary">
                    {es
                      ? "Instrucciones de la barbería / salón"
                      : "Instruções da barbearia / salão"}
                  </span>
                  <textarea
                    rows={4}
                    maxLength={4000}
                    value={aiSystemPrompt}
                    onChange={(event) => setAiSystemPrompt(event.target.value)}
                    placeholder={
                      es
                        ? "Ej.: Atiende con tono cordial, recuerda que aceptamos PIX y tarjeta, y ofrece siempre horarios disponibles..."
                        : "Ex.: Atenda com tom cordial, informe que aceitamos PIX e cartão, e sempre ofereça horários disponíveis na agenda..."
                    }
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 p-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
                  />
                </label>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={savingSettings}
                    className="rounded-xl bg-accent text-accent-ink hover:bg-accent-hover text-xs font-semibold"
                  >
                    {savingSettings ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    {es ? "Guardar configuración" : "Salvar configurações"}
                  </Button>
                </div>
              </form>
            </div>
          </section>

          {/* CARD 2: Campanhas & Disparos em Massa (API Oficial Datafy) */}
          <section className="flex flex-col justify-between rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 shadow-xs space-y-6">
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
                    <Megaphone size={20} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-ink">
                        {es
                          ? "Campañas y Envíos Masivos (API Oficial Datafy)"
                          : "Campanhas & Disparos em Massa (API Oficial Datafy)"}
                      </h2>
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        <Crown size={11} />
                        {es ? "Plan Pro / Enterprise" : "Plano Pro / Enterprise"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {es
                        ? "Canal dedicado para campañas de reactivación y promociones masivas sin riesgo para tu número de agenda."
                        : "Canal dedicado para campanhas de reativação e promoções em massa com segurança para seu número principal."}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    isDatafyConnected
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-border-subtle bg-subtle text-ink-secondary"
                  }`}
                >
                  {isDatafyConnected ? (
                    <ShieldCheck size={13} />
                  ) : (
                    <KeyRound size={13} />
                  )}
                  {isDatafyConnected
                    ? es
                      ? "Conectado"
                      : "Conectado"
                    : es
                      ? "Desconectado"
                      : "Desconectado"}
                </span>
              </div>

              {currentPlan === "TRIAL" && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
                  <p className="font-semibold">
                    {es
                      ? "Recurso recomendado para planes superiores"
                      : "Recurso para planos superiores"}
                  </p>
                  <p className="mt-0.5 opacity-90">
                    {es
                      ? "Puedes preconfigurar tus credenciales de la API Oficial Datafy ahora; los envíos masivos se enrutan exclusivamente por este canal."
                      : "Você já pode configurar suas credenciais da API Oficial Datafy abaixo; todos os disparos em massa são roteados exclusivamente por este canal."}
                  </p>
                </div>
              )}

              <form onSubmit={handleSaveDatafy} className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-ink-secondary">
                    Datafy Instance ID
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={datafyInstanceId}
                    onChange={(event) => setDatafyInstanceId(event.target.value)}
                    placeholder="ex.: dfy_inst_9a8b7c6d"
                    className={fieldClass}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="flex items-center justify-between text-xs font-semibold text-ink-secondary">
                    <span>Datafy API Token</span>
                    {connection?.datafy.hasApiToken && (
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        {es ? "Token guardado (cifrado)" : "Token salvo (criptografado)"}
                      </span>
                    )}
                  </span>
                  <input
                    type="password"
                    required={!connection?.datafy.hasApiToken}
                    maxLength={512}
                    value={datafyApiToken}
                    onChange={(event) => setDatafyApiToken(event.target.value)}
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

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
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
                    className="rounded-xl bg-accent text-accent-ink hover:bg-accent-hover text-xs font-semibold"
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
          </section>
        </div>
      )}

      {/* Modal de QR Code para pareamento Evolution */}
      {qrModal && (
        <AgendaDialog
          centered
          title={
            es
              ? "Escanea el QR Code en tu WhatsApp"
              : "Escaneie o QR Code no seu WhatsApp"
          }
          onClose={() => setQrModal(null)}
        >
          <div className="flex flex-col items-center space-y-4 text-center">
            <p className="text-xs text-ink-secondary">
              {es
                ? "Abre WhatsApp en tu teléfono → Dispositivos vinculados → Vincular un dispositivo."
                : "Abra o WhatsApp no seu celular → Dispositivos conectados → Conectar um dispositivo."}
            </p>

            {qrModal.qrCodeBase64 ? (
              <div className="rounded-2xl border border-border-subtle bg-white p-3 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrModal.qrCodeBase64}
                  alt="WhatsApp QR Code"
                  className="size-56 object-contain"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-border-subtle bg-subtle px-4 py-6 text-xs text-ink-muted">
                {es
                  ? "QR Code no disponible todavía. Intenta actualizar el estado."
                  : "QR Code ainda não disponível. Tente atualizar o status."}
              </div>
            )}

            {qrModal.pairingCode && (
              <p className="rounded-lg border border-border-subtle bg-canvas px-3 py-1.5 font-mono text-xs font-semibold text-ink">
                {es ? "Código:" : "Código:"} {qrModal.pairingCode}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadConnection(false)}
                disabled={refreshing}
                className="rounded-xl text-xs font-semibold"
              >
                <RefreshCw
                  size={13}
                  className={refreshing ? "animate-spin" : ""}
                />
                {es ? "Verificar conexión" : "Verificar conexão"}
              </Button>
              <Button
                type="button"
                onClick={() => setQrModal(null)}
                className="rounded-xl text-xs font-semibold"
              >
                {es ? "Cerrar" : "Fechar"}
              </Button>
            </div>
          </div>
        </AgendaDialog>
      )}
    </div>
  );
}
