
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, getApiBaseUrl } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import { paymentError, paymentProviders, providerLabels, type GatewaySettings, type PaymentProvider } from "@/lib/online-payments";

const paymentFieldClass = "min-h-10 w-full cursor-pointer rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

export function PaymentGatewaySettings() {
  const { locale } = useLocale();
  const es = locale === "es";
  const [saved, setSaved] = useState<GatewaySettings>();
  const [provider, setProvider] = useState<PaymentProvider>();
  const [apiKey, setApiKey] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [staticKey, setStaticKey] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<GatewaySettings>("/payments/config", { signal: controller.signal }).then(setSaved, () => {
      if (!controller.signal.aborted) setError(es ? "No se pudo cargar el proveedor." : "Não foi possível carregar o gateway.");
    });
    return () => controller.abort();
  }, [retry, es]);

  const selected = provider ?? saved?.paymentProvider ?? "NONE";
  const credentials = selected === "ASAAS" || selected === "MERCADO_PAGO";
  const hasExistingKey = selected === saved?.paymentProvider && saved.hasProviderApiKey;
  const hasExistingToken = selected === saved?.paymentProvider && saved.hasWebhookToken;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saved || saving) return;
    setSaving(true);
    setError("");
    setSavedNotice(false);
    try {
      const result = await apiRequest<GatewaySettings>("/payments/config", {
        method: "PUT",
        body: {
          paymentProvider: selected,
          staticPixKey: (staticKey ?? saved.staticPixKey ?? "").trim() || null,
          ...(credentials && apiKey.trim() ? { providerApiKey: apiKey.trim() } : {}),
          ...(credentials && webhookToken.trim() ? { webhookToken: webhookToken.trim() } : {}),
        },
      });
      setSaved(result);
      setProvider(undefined);
      setStaticKey(undefined);
      setApiKey("");
      setWebhookToken("");
      setSavedNotice(true);
    } catch (failure) {
      setError(paymentError(failure, es ? "No se pudo guardar el proveedor." : "Não foi possível salvar o gateway."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5" aria-labelledby="gateway-heading">
      <div>
        <h3 id="gateway-heading" className="flex items-center gap-2 text-base font-semibold text-ink"><ShieldCheck className="size-5 text-accent" aria-hidden />{es ? "Proveedor de pagos" : "Gateway de pagamentos"}</h3>
        <p className="mt-1 text-sm text-ink-secondary">{es ? "Configura el proveedor para cobrar comandas y suscripciones." : "Configure o provedor para cobrar comandas e assinaturas."}</p>
      </div>
      {saved ? <form onSubmit={save} className="space-y-4">
        <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">{es ? "Proveedor" : "Provedor"}
            <select className={paymentFieldClass} value={selected} onChange={(event) => {
              setProvider(event.target.value as PaymentProvider);
              setApiKey("");
              setWebhookToken("");
              setSavedNotice(false);
            }}>
              {paymentProviders.map((value) => <option key={value} value={value}>{value === "NONE" && es ? "Sin proveedor" : providerLabels[value]}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">{es ? "Clave Pix de respaldo" : "Chave Pix estática de fallback"}
            <input className={paymentFieldClass} value={staticKey ?? saved.staticPixKey ?? ""} onChange={(event) => { setStaticKey(event.target.value); setSavedNotice(false); }} maxLength={77} autoComplete="off" />
          </label>
          {credentials && <>
            <label className="space-y-1 text-sm font-medium">{selected === "MERCADO_PAGO" ? "Access Token" : "API Key"}
              <input type="password" className={paymentFieldClass} value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="new-password" minLength={12} maxLength={1000} required={!hasExistingKey}
                placeholder={hasExistingKey ? (es ? "Credencial guardada" : "Credencial cadastrada") : undefined} />
            </label>
            <label className="space-y-1 text-sm font-medium">{es ? "Secreto del webhook" : "Chave secreta do webhook"}
              <input type="password" className={paymentFieldClass} value={webhookToken} onChange={(event) => setWebhookToken(event.target.value)} autoComplete="new-password" minLength={32} maxLength={256} required={!hasExistingToken}
                placeholder={hasExistingToken ? (es ? "Credencial guardada" : "Credencial cadastrada") : undefined} />
            </label>
          </>}
        </fieldset>
        {selected === "MERCADO_PAGO" && <p className="flex gap-2 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-sm text-[var(--status-warning-ink)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />{es ? "Mercado Pago exige una vigencia mínima de 30 minutos para el Pix." : "O Mercado Pago exige validade mínima de 30 minutos para o Pix."}
        </p>}
        {selected === saved.paymentProvider && saved.webhookPath && <div className="space-y-1 text-xs text-ink-secondary"><p>{es ? "URL del webhook" : "URL do webhook"}</p><code className="block break-all rounded-lg bg-subtle p-2.5">{getApiBaseUrl() + saved.webhookPath}</code></div>}
        {error && <p role="alert" className="text-sm text-[var(--status-danger-ink)]">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving} size="touch" className="bg-accent text-accent-ink hover:bg-accent-hover">{saving ? (es ? "Guardando…" : "Salvando…") : (es ? "Guardar proveedor" : "Salvar gateway")}</Button>
          {savedNotice && <p role="status" className="text-sm text-[var(--status-success-ink)]">{es ? "Proveedor guardado." : "Gateway salvo."}</p>}
        </div>
      </form> : error
        ? <div className="space-y-2"><p role="alert" className="text-sm text-[var(--status-danger-ink)]">{error}</p><Button type="button" variant="outline" onClick={() => { setError(""); setRetry((n) => n + 1); }}>{es ? "Reintentar" : "Tentar novamente"}</Button></div>
        : <p role="status" className="text-sm text-ink-secondary">{es ? "Cargando proveedor…" : "Carregando gateway…"}</p>}
    </section>
  );
}
