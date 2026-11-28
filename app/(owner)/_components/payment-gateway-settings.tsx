"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FlaskConical,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
  Unlink,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { ApiError, apiRequest, getApiBaseUrl } from "@/lib/api-client";
import { useCompanySettings } from "@/lib/use-company-settings";
import {
  authorizeMercadoPagoOAuth,
  connectExistingAsaas,
  createAsaasExpressSubaccount,
  disconnectMercadoPagoOAuth,
  getPaymentConnectionStatus,
  paymentError,
  providerLabels,
  type GatewaySettings,
  type PaymentConnectionStatus,
} from "@/lib/online-payments";

const paymentFieldClass =
  "min-h-10 w-full cursor-pointer rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

interface PaymentGatewaySettingsProps {
  onStatusChange?: (status: PaymentConnectionStatus) => void;
}

function oauthErrorMessage(reason: string | null) {
  switch (reason) {
    case "OAUTH_INVALID_STATE":
      return "A sessão de autorização expirou ou é inválida. Tente conectar novamente.";
    case "OAUTH_PROVIDER_NOT_CONFIGURED":
      return "A integração OAuth do Mercado Pago ainda não está configurada no servidor.";
    case "access_denied":
      return "A autorização no Mercado Pago foi cancelada antes de concluir.";
    default:
      return "Não foi possível concluir a conexão com o Mercado Pago. Tente novamente.";
  }
}

export function PaymentGatewaySettings({ onStatusChange }: PaymentGatewaySettingsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useSession();
  const { settings } = useCompanySettings(session.company.id, undefined, true, true);

  const [status, setStatus] = useState<PaymentConnectionStatus | null>(null);
  const [gatewayConfig, setGatewayConfig] = useState<GatewaySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [oauthBanner, setOauthBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Ações Mercado Pago
  const [connectingMp, setConnectingMp] = useState(false);
  const [disconnectingMp, setDisconnectingMp] = useState(false);

  // Modal Asaas Express
  const [asaasModalOpen, setAsaasModalOpen] = useState(false);
  const [submittingAsaas, setSubmittingAsaas] = useState(false);
  const [asaasError, setAsaasError] = useState("");
  const [asaasName, setAsaasName] = useState("");
  const [asaasEmail, setAsaasEmail] = useState("");
  const [asaasCpfCnpj, setAsaasCpfCnpj] = useState("");
  const [asaasPhone, setAsaasPhone] = useState("");
  const [asaasIncome, setAsaasIncome] = useState("10000");
  const [asaasAddress, setAsaasAddress] = useState("");
  const [asaasAddressNumber, setAsaasAddressNumber] = useState("");
  const [asaasPostalCode, setAsaasPostalCode] = useState("");

  // Acordeão de conexão Asaas existente via API Key (sem exigir token de webhook)
  const [manualAsaasOpen, setManualAsaasOpen] = useState(false);
  const [manualApiKey, setManualApiKey] = useState("");
  const [manualStaticPixKey, setManualStaticPixKey] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [manualError, setManualError] = useState("");

  // Toggle Sandbox
  const [togglingSandbox, setTogglingSandbox] = useState(false);

  const loadPaymentData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setLoadError("");
      try {
        const [connectionStatus, config] = await Promise.all([
          getPaymentConnectionStatus(signal),
          apiRequest<GatewaySettings>("/payments/config", { signal }),
        ]);
        if (signal?.aborted) return;
        setStatus(connectionStatus);
        setGatewayConfig(config);
        setManualStaticPixKey(config.staticPixKey ?? "");
        onStatusChange?.(connectionStatus);
      } catch {
        if (!signal?.aborted) {
          setLoadError("Não foi possível carregar o status de conexão dos pagamentos.");
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [onStatusChange],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadPaymentData(controller.signal);
    return () => controller.abort();
  }, [loadPaymentData]);

  // Detecta o retorno OAuth do Mercado Pago (?oauth=success ou ?oauth=error) e limpa a URL.
  useEffect(() => {
    const oauthResult = searchParams.get("oauth");
    if (!oauthResult) return;

    if (oauthResult === "success") {
      const message = "Conta Mercado Pago conectada com sucesso! Seus recebimentos online já estão ativos.";
      setOauthBanner({ type: "success", message });
      toast.success(message);
      void loadPaymentData();
    } else if (oauthResult === "error") {
      const message = oauthErrorMessage(searchParams.get("reason"));
      setOauthBanner({ type: "error", message });
      toast.error(message);
    }

    router.replace("/owner/settings?tab=payments", { scroll: false });
  }, [searchParams, router, loadPaymentData]);

  const openAsaasModal = () => {
    const brAddress = settings.address && "postalCode" in settings.address ? settings.address : null;
    setAsaasName(session.company.companyName || "");
    setAsaasEmail(session.email || "");
    setAsaasPhone(session.phone || "");
    setAsaasCpfCnpj(settings.documents?.businessDoc || settings.documents?.personalDoc || "");
    setAsaasAddress(brAddress?.street || "");
    setAsaasAddressNumber(brAddress?.number || "");
    setAsaasPostalCode(brAddress?.postalCode || "");
    setAsaasIncome("10000");
    setAsaasError("");
    setAsaasModalOpen(true);
  };

  const handleConnectMercadoPago = async () => {
    if (connectingMp) return;
    setConnectingMp(true);
    try {
      const { authorizationUrl } = await authorizeMercadoPagoOAuth();
      window.location.assign(authorizationUrl);
    } catch (error) {
      const message =
        error instanceof ApiError && error.code === "OAUTH_PROVIDER_NOT_CONFIGURED"
          ? "A conexão 1 clique com o Mercado Pago ainda não foi habilitada no servidor."
          : paymentError(error, "Não foi possível iniciar a conexão com o Mercado Pago.");
      toast.error(message);
      setConnectingMp(false);
    }
  };

  const handleDisconnectMercadoPago = async () => {
    if (disconnectingMp) return;
    setDisconnectingMp(true);
    try {
      await disconnectMercadoPagoOAuth();
      toast.success("Conta Mercado Pago desconectada.");
      await loadPaymentData();
    } catch (error) {
      toast.error(paymentError(error, "Não foi possível desconectar a conta Mercado Pago."));
    } finally {
      setDisconnectingMp(false);
    }
  };

  const handleCreateAsaasSubaccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingAsaas) return;
    setAsaasError("");

    const incomeNumber = Number(asaasIncome.replace(",", "."));
    if (!Number.isFinite(incomeNumber) || incomeNumber <= 0) {
      setAsaasError("Informe um faturamento mensal estimado válido.");
      return;
    }

    setSubmittingAsaas(true);
    try {
      await createAsaasExpressSubaccount({
        name: asaasName.trim(),
        email: asaasEmail.trim(),
        cpfCnpj: asaasCpfCnpj.trim(),
        mobilePhone: asaasPhone.trim(),
        incomeValue: incomeNumber,
        ...(asaasAddress.trim() ? { address: asaasAddress.trim() } : {}),
        ...(asaasAddressNumber.trim() ? { addressNumber: asaasAddressNumber.trim() } : {}),
        ...(asaasPostalCode.trim() ? { postalCode: asaasPostalCode.trim() } : {}),
      });
      toast.success("Conta Asaas criada e ativada com sucesso! O Pix já está pronto para receber.");
      setAsaasModalOpen(false);
      await loadPaymentData();
    } catch (error) {
      const message =
        error instanceof ApiError && error.code === "ASAAS_MASTER_NOT_CONFIGURED"
          ? "A criação automática de conta Asaas ainda não foi configurada no servidor. Use a opção de chave manual abaixo."
          : paymentError(error, "Não foi possível criar a conta Asaas automática.");
      setAsaasError(message);
    } finally {
      setSubmittingAsaas(false);
    }
  };

  const handleSaveManualAsaas = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingManual) return;
    const trimmedKey = manualApiKey.trim();
    if (trimmedKey.length < 12) {
      setManualError("Informe uma API Key válida do Asaas.");
      return;
    }
    setSavingManual(true);
    setManualError("");
    try {
      await connectExistingAsaas({
        apiKey: trimmedKey,
        staticPixKey: manualStaticPixKey.trim() || null,
      });
      setManualApiKey("");
      toast.success("Conta Asaas conectada com sucesso!");
      await loadPaymentData();
    } catch (error) {
      setManualError(paymentError(error, "Não foi possível validar a API Key do Asaas."));
    } finally {
      setSavingManual(false);
    }
  };

  const handleToggleSandbox = async () => {
    if (togglingSandbox || !status) return;
    setTogglingSandbox(true);
    const enabling = status.provider !== "SANDBOX";
    try {
      await apiRequest<GatewaySettings>("/payments/config", {
        method: "PUT",
        body: {
          paymentProvider: enabling ? "SANDBOX" : "NONE",
          staticPixKey: gatewayConfig?.staticPixKey ?? null,
        },
      });
      toast.success(
        enabling
          ? "Modo Sandbox ativado para testes locais sem dinheiro real."
          : "Modo Sandbox desativado.",
      );
      await loadPaymentData();
    } catch (error) {
      toast.error(paymentError(error, "Não foi possível alterar o modo Sandbox."));
    } finally {
      setTogglingSandbox(false);
    }
  };

  const isMpConnected = status?.provider === "MERCADO_PAGO" && status.connected;
  const isAsaasConnected = status?.provider === "ASAAS" && status.connected;
  const isSandboxActive = status?.provider === "SANDBOX" && status.connected;
  const mpOAuthAvailable = status ? status.capabilities.mercadoPagoOAuthAvailable : true;
  const asaasExpressAvailable = status ? status.capabilities.asaasExpressAvailable : true;
  const highlightFallbackOptions = Boolean(
    status && !status.connected && (!mpOAuthAvailable || !asaasExpressAvailable),
  );

  return (
    <section className="space-y-4" aria-labelledby="payment-hub-heading">
      {/* Banner de retorno OAuth */}
      {oauthBanner && (
        <div
          role={oauthBanner.type === "error" ? "alert" : "status"}
          className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm ${
            oauthBanner.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-ink)]"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {oauthBanner.type === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <span>{oauthBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setOauthBanner(null)}
            aria-label="Fechar aviso"
            className="cursor-pointer rounded-lg p-1 opacity-75 hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Banner de Status Atual no Topo */}
      <div
        className={`rounded-2xl border p-5 shadow-xs transition-colors ${
          status?.connected
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-amber-500/30 bg-amber-500/10"
        }`}
      >
        {loading ? (
          <div className="flex items-center gap-3 text-sm text-ink-secondary">
            <Loader2 className="size-4 animate-spin text-accent" aria-hidden />
            Carregando status de recebimento online…
          </div>
        ) : loadError ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="alert" className="text-sm text-[var(--status-danger-ink)]">
              {loadError}
            </p>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => void loadPaymentData()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : status?.connected ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-5" aria-hidden />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id="payment-hub-heading" className="text-sm font-bold text-ink">
                    Recebimentos Online Ativos
                  </h3>
                  <span className="rounded-full bg-emerald-600/15 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {providerLabels[status.provider]}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-secondary">
                  {status.accountLabel
                    ? `Conta conectada: ${status.accountLabel}`
                    : status.provider === "SANDBOX"
                      ? "Modo de testes locais ativo — cobranças simuladas sem dinheiro real."
                      : "Sua conta está conectada e pronta para receber Pix e assinaturas."}
                </p>
              </div>
            </div>
            {(status.mpUserId || status.walletId) && (
              <span className="self-start rounded-lg bg-surface/80 px-2.5 py-1 font-mono text-[11px] text-ink-muted sm:self-center">
                {status.mpUserId ? `ID MP: ${status.mpUserId}` : `Carteira: ${status.walletId}`}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
              <AlertCircle className="size-5" aria-hidden />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 id="payment-hub-heading" className="text-sm font-bold text-ink">
                  Recebimentos Online Pendentes de Conexão
                </h3>
                <span className="rounded-full bg-amber-600/15 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                  Pendente
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-secondary">
                Conecte sua conta do Mercado Pago em 1 clique ou ative uma conta Asaas automática para começar a cobrar sinais e assinaturas sem copiar chaves manualmente.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Hub de Provedores */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Card Mercado Pago (1 Clique) */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="flex items-center gap-2 text-base font-bold text-ink">
                  <ShieldCheck className="size-5 text-sky-500" aria-hidden />
                  Mercado Pago
                </h4>
                <p className="mt-1 text-xs text-ink-muted">
                  Conecte sua conta Mercado Pago em 1 clique com renovação automática de credenciais.
                </p>
              </div>
              {isMpConnected && (
                <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  Conta Mercado Pago conectada
                </span>
              )}
            </div>

            {isMpConnected ? (
              <div className="space-y-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
                <p className="font-semibold text-ink">
                  {status?.accountLabel || "Conta vinculada via OAuth"}
                </p>
                {status?.mpUserId && (
                  <p className="font-mono text-[11px] text-ink-muted">
                    ID da conta: {status.mpUserId}
                  </p>
                )}
                {gatewayConfig?.webhookPath && (
                  <div className="pt-1">
                    <p className="text-[11px] text-ink-muted">URL do webhook:</p>
                    <code className="mt-0.5 block break-all rounded-lg bg-surface px-2 py-1 text-[11px] text-ink-secondary">
                      {getApiBaseUrl() + gatewayConfig.webhookPath}
                    </code>
                  </div>
                )}
              </div>
            ) : (
              <p className="rounded-xl border border-border-subtle bg-canvas/40 p-3 text-xs text-ink-secondary">
                Ideal para quem já usa Mercado Pago no dia a dia. Sem copiar tokens ou configurar chaves manualmente.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {isMpConnected ? (
              <Button
                type="button"
                variant="outline"
                disabled={disconnectingMp}
                onClick={() => void handleDisconnectMercadoPago()}
                className="cursor-pointer border-[var(--status-danger-border)] text-[var(--status-danger-ink)] hover:bg-[var(--status-danger-bg)]"
              >
                {disconnectingMp ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Unlink className="size-4" aria-hidden />
                )}
                {disconnectingMp ? "Desconectando…" : "Desconectar"}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={connectingMp || !mpOAuthAvailable}
                onClick={() => void handleConnectMercadoPago()}
                className="w-full cursor-pointer bg-sky-600 text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
              >
                {connectingMp ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ExternalLink className="size-4" aria-hidden />
                )}
                {connectingMp ? "Redirecionando…" : "Conectar com Mercado Pago"}
              </Button>
            )}
            {!isMpConnected && status && !mpOAuthAvailable && (
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                Aguardando configuração da plataforma
              </span>
            )}
          </div>
        </div>

        {/* Card Asaas (Ativação Expressa + Fallback Manual) */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="flex items-center gap-2 text-base font-bold text-ink">
                  <Sparkles className="size-5 text-accent" aria-hidden />
                  Asaas Pix &amp; Assinaturas
                </h4>
                <p className="mt-1 text-xs text-ink-muted">
                  Crie sua subconta Asaas automaticamente em segundos para receber sinais via Pix e mensalidades do Clube VIP.
                </p>
              </div>
              {isAsaasConnected && (
                <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  Conta Asaas conectada
                </span>
              )}
            </div>

            {isAsaasConnected ? (
              <div className="space-y-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
                <p className="font-semibold text-ink">
                  {status?.accountLabel || "Conta Asaas ativa"}
                </p>
                {status?.walletId && (
                  <p className="font-mono text-[11px] text-ink-muted">
                    Wallet ID: {status.walletId}
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-xl border border-border-subtle bg-canvas/40 p-3 text-xs text-ink-secondary">
                Suporta Pix dinâmico com expiração curta (15 min) para sinais anti-no-show no Portal Público e cobranças recorrentes.
              </p>
            )}
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={!asaasExpressAvailable}
                onClick={openAsaasModal}
                className="w-full cursor-pointer bg-accent text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
              >
                <Sparkles className="size-4" aria-hidden />
                {isAsaasConnected ? "Recriar / Atualizar Conta Asaas" : "Ativar Conta Asaas Automática"}
              </Button>
              {status && !asaasExpressAvailable && !isAsaasConnected && (
                <span className="inline-flex items-center rounded-full border border-border-subtle bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                  Aguardando configuração da plataforma
                </span>
              )}
            </div>

            {/* Conexão direta de conta Asaas existente via API Key (sem exigir webhook token) */}
            <div
              className={`border-t border-border-subtle pt-2.5 ${
                highlightFallbackOptions && !isAsaasConnected
                  ? "rounded-xl border border-accent/35 bg-accent/5 p-3"
                  : ""
              }`}
            >
              <button
                type="button"
                onClick={() => setManualAsaasOpen((open) => !open)}
                className="flex w-full cursor-pointer items-center justify-between gap-1.5 text-xs font-semibold text-ink hover:text-accent"
              >
                <span className="flex items-center gap-1.5">
                  <KeyRound className="size-3.5 text-accent" aria-hidden />
                  Já possui conta Asaas? Conectar via API Key
                </span>
                {manualAsaasOpen || (highlightFallbackOptions && !isAsaasConnected) ? (
                  <ChevronUp className="size-3.5" aria-hidden />
                ) : (
                  <ChevronDown className="size-3.5" aria-hidden />
                )}
              </button>

              {(manualAsaasOpen || (highlightFallbackOptions && !isAsaasConnected)) && (
                <form onSubmit={handleSaveManualAsaas} className="mt-3 space-y-3 rounded-xl border border-border-subtle bg-canvas/40 p-3.5">
                  <label className="block space-y-1 text-xs font-medium text-ink">
                    API Key do Asaas
                    <input
                      type="password"
                      value={manualApiKey}
                      onChange={(e) => setManualApiKey(e.target.value)}
                      minLength={12}
                      maxLength={1000}
                      required
                      autoComplete="new-password"
                      placeholder={
                        gatewayConfig?.paymentProvider === "ASAAS" && gatewayConfig.hasProviderApiKey
                          ? "Cole uma nova API Key para atualizar"
                          : "$aact_..."
                      }
                      className={paymentFieldClass}
                    />
                    <span className="block text-[11px] font-normal text-ink-muted">
                      Encontre no painel do Asaas em <strong>Integrações → Chaves de API</strong>. O webhook é configurado automaticamente.
                    </span>
                  </label>
                  <label className="block space-y-1 text-xs font-medium text-ink">
                    Chave Pix estática (opcional)
                    <input
                      type="text"
                      value={manualStaticPixKey}
                      onChange={(e) => setManualStaticPixKey(e.target.value)}
                      maxLength={77}
                      placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                      className={paymentFieldClass}
                    />
                  </label>
                  {manualError && (
                    <p role="alert" className="text-xs text-[var(--status-danger-ink)]">
                      {manualError}
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={savingManual}
                    className="cursor-pointer bg-accent text-accent-ink hover:bg-accent-hover"
                  >
                    {savingManual ? "Validando e conectando…" : "Conectar conta Asaas"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card Modo Sandbox (Testes) */}
      <div
        className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between ${
          highlightFallbackOptions && !isSandboxActive
            ? "border-violet-500/40 bg-violet-500/5"
            : "border-border-subtle bg-surface"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`grid size-10 shrink-0 place-items-center rounded-xl ${
              isSandboxActive
                ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                : "bg-canvas text-ink-muted"
            }`}
          >
            <FlaskConical className="size-5" aria-hidden />
          </div>
          <div>
            <h4 className="text-sm font-bold text-ink">Modo Sandbox (Testes Locais)</h4>
            <p className="mt-0.5 text-xs text-ink-muted">
              Ative para testar reservas com sinal Pix e o Clube VIP sem movimentar dinheiro real.
            </p>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 self-start sm:self-center">
          <input
            type="checkbox"
            role="switch"
            checked={isSandboxActive}
            disabled={togglingSandbox || loading}
            onChange={() => void handleToggleSandbox()}
            className="size-5 cursor-pointer rounded-md accent-accent disabled:cursor-not-allowed"
          />
          <span
            className={`text-xs font-bold ${
              isSandboxActive ? "text-violet-600 dark:text-violet-400" : "text-ink-muted"
            }`}
          >
            {togglingSandbox ? "Atualizando…" : isSandboxActive ? "Sandbox ativo" : "Ativar Sandbox"}
          </span>
        </label>
      </div>

      {/* Modal Enxuto de Criação Expressa de Subconta Asaas */}
      {asaasModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="asaas-express-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-subtle bg-surface p-5 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="asaas-express-modal-title" className="text-lg font-bold text-ink">
                  Ativar Conta Asaas Automática
                </h3>
                <p className="mt-1 text-xs text-ink-muted">
                  Confirmamos seus dados cadastrados e ativamos o recebimento via Pix na hora, sem precisar copiar chaves.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAsaasModalOpen(false)}
                aria-label="Fechar modal"
                className="cursor-pointer rounded-lg p-1.5 text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAsaasSubaccount} className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-semibold text-ink sm:col-span-2">
                  Nome da barbearia / razão social
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={160}
                    value={asaasName}
                    onChange={(e) => setAsaasName(e.target.value)}
                    className={paymentFieldClass}
                  />
                </label>

                <label className="space-y-1 text-xs font-semibold text-ink">
                  CPF ou CNPJ *
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    value={asaasCpfCnpj}
                    onChange={(e) => setAsaasCpfCnpj(e.target.value)}
                    className={paymentFieldClass}
                  />
                </label>

                <label className="space-y-1 text-xs font-semibold text-ink">
                  Faturamento mensal estimado (R$) *
                  <input
                    type="number"
                    required
                    min={100}
                    step="100"
                    value={asaasIncome}
                    onChange={(e) => setAsaasIncome(e.target.value)}
                    placeholder="10000"
                    className={paymentFieldClass}
                  />
                </label>

                <label className="space-y-1 text-xs font-semibold text-ink">
                  E-mail financeiro *
                  <input
                    type="email"
                    required
                    value={asaasEmail}
                    onChange={(e) => setAsaasEmail(e.target.value)}
                    className={paymentFieldClass}
                  />
                </label>

                <label className="space-y-1 text-xs font-semibold text-ink">
                  Celular / WhatsApp *
                  <input
                    type="tel"
                    required
                    value={asaasPhone}
                    onChange={(e) => setAsaasPhone(e.target.value)}
                    className={paymentFieldClass}
                  />
                </label>

                <label className="space-y-1 text-xs font-semibold text-ink">
                  CEP (opcional)
                  <input
                    type="text"
                    value={asaasPostalCode}
                    onChange={(e) => setAsaasPostalCode(e.target.value)}
                    placeholder="00000-000"
                    className={paymentFieldClass}
                  />
                </label>

                <label className="space-y-1 text-xs font-semibold text-ink">
                  Número (opcional)
                  <input
                    type="text"
                    value={asaasAddressNumber}
                    onChange={(e) => setAsaasAddressNumber(e.target.value)}
                    placeholder="123"
                    className={paymentFieldClass}
                  />
                </label>

                <label className="space-y-1 text-xs font-semibold text-ink sm:col-span-2">
                  Endereço (opcional)
                  <input
                    type="text"
                    value={asaasAddress}
                    onChange={(e) => setAsaasAddress(e.target.value)}
                    placeholder="Rua, Avenida..."
                    className={paymentFieldClass}
                  />
                </label>
              </div>

              {asaasError && (
                <p role="alert" className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-xs text-[var(--status-danger-ink)]">
                  {asaasError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAsaasModalOpen(false)}
                  className="cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingAsaas}
                  className="cursor-pointer bg-accent text-accent-ink hover:bg-accent-hover"
                >
                  {submittingAsaas ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Ativando conta…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" aria-hidden />
                      Ativar Pix agora
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
