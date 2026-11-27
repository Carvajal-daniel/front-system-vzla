
"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, Copy, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";
import { formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { paymentError, type PixCharge, type PixChargeStatus, type PixRequest } from "@/lib/online-payments";

const secondsUntil = (expiresAt: string | null) =>
  expiresAt ? Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1_000)) : null;

export function PixChargeDialog({ request, onClose, onConfirmed }: {
  request: PixRequest;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const { locale } = useLocale();
  const es = locale === "es";
  const [charge, setCharge] = useState<PixCharge | null>(null);
  const [error, setError] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [actionError, setActionError] = useState("");
  const confirmedHandler = useRef(onConfirmed);
  useEffect(() => { confirmedHandler.current = onConfirmed; }, [onConfirmed]);

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<PixCharge>("/payments/pix", { method: "POST", body: request, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setCharge(result);
        setRemaining(secondsUntil(result.expiresAt));
      }, (failure: unknown) => {
        if (!controller.signal.aborted) setError(paymentError(failure, es ? "No se pudo generar el Pix." : "Não foi possível gerar o Pix."));
      });
    return () => controller.abort();
  }, [request, attempt, es]);

  const chargeId = charge?.id;
  const status = charge?.status;
  const expiresAt = charge?.expiresAt ?? null;
  const isManual = charge?.paymentProvider === "NONE";
  const canPay = status === "PENDING" && remaining !== 0;

  useEffect(() => {
    if (!chargeId || status !== "PENDING" || isManual) return;
    const controller = new AbortController();
    let timer: number;
    async function poll() {
      try {
        const result = await apiRequest<PixChargeStatus>(`/payments/${chargeId}/status`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setStatusError(false);
        setCharge((current) => current?.id === result.id && current.status === "PENDING" ? { ...current, ...result } : current);
        if (result.status !== "PENDING") return;
      } catch {
        if (controller.signal.aborted) return;
        setStatusError(true);
      }
      timer = window.setTimeout(poll, 3_000);
    }
    timer = window.setTimeout(poll, 3_000);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [chargeId, status, isManual]);

  useEffect(() => {
    if (!expiresAt || status !== "PENDING") return;
    const timer = window.setInterval(() => setRemaining(secondsUntil(expiresAt)), 1_000);
    return () => window.clearInterval(timer);
  }, [expiresAt, status]);

  useEffect(() => {
    if (status !== "CONFIRMED") return;
    const timer = window.setTimeout(() => confirmedHandler.current(), 1_500);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function copyPix() {
    if (!charge?.pixCopyPaste) return;
    setActionError("");
    try {
      await navigator.clipboard.writeText(charge.pixCopyPaste);
      setCopied(true);
    } catch {
      setActionError(es ? "Selecciona y copia el código Pix manualmente." : "Selecione e copie o código Pix manualmente.");
    }
  }

  async function simulate() {
    if (!charge || simulating) return;
    setSimulating(true);
    setActionError("");
    try {
      const result = await apiRequest<PixChargeStatus>(`/payments/${charge.id}/simulate-confirmation`, { method: "POST" });
      setCharge((current) => current?.status === "PENDING" ? { ...current, ...result } : current);
    } catch (failure) {
      setActionError(paymentError(failure, es ? "No se pudo simular el pago." : "Não foi possível simular o pagamento."));
    } finally {
      setSimulating(false);
    }
  }

  const clock = remaining === null ? null : [Math.floor(remaining / 60), remaining % 60]
    .map((part) => String(part).padStart(2, "0")).join(":");
  const qr = charge?.pixQrCodeBase64;
  const qrSource = qr && /^[A-Za-z0-9+/=]+$/.test(qr) ? "data:image/png;base64," + qr : null;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) (status === "CONFIRMED" ? onConfirmed : onClose)(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8 text-lg font-semibold"><QrCode className="size-5 text-accent" aria-hidden />{isManual ? "Pix manual" : "Pix Online"}</DialogTitle>
          <DialogDescription>{isManual
            ? (es ? "Verifica el abono y regístralo en la comanda." : "Confira a transferência e registre o recebimento na comanda.")
            : (es ? "Escanea el QR o comparte el código Pix." : "Escaneie o QR Code ou compartilhe o código Pix.")}</DialogDescription>
        </DialogHeader>
        {!charge && !error && <p role="status" className="flex items-center gap-2 py-4 text-ink-secondary"><Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />{es ? "Generando Pix…" : "Gerando Pix…"}</p>}
        {error && <div className="space-y-3"><p role="alert" className="text-[var(--status-danger-ink)]">{error}</p><Button type="button" variant="outline" onClick={() => { setError(""); setAttempt((n) => n + 1); }}>{es ? "Reintentar" : "Tentar novamente"}</Button></div>}
        {charge && <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-subtle px-4 py-3">
            <div><p className="text-xs text-ink-secondary">{es ? "Importe de la cobranza" : "Valor da cobrança"}</p><p className="text-xl font-semibold tabular-nums">{formatPriceFromCents(charge.amountCents, locale, "BRL")}</p></div>
            {clock && canPay && <span className="inline-flex items-center gap-1.5 text-xs font-medium tabular-nums text-ink-secondary"><Clock3 className="size-4" aria-hidden />{es ? "Vence en" : "Expira em"} {clock}</span>}
          </div>
          {status === "CONFIRMED" && <p role="status" className="flex items-center gap-2 rounded-xl bg-[var(--status-success-bg)] p-3 font-semibold text-[var(--status-success-ink)]"><CheckCircle2 className="size-5" aria-hidden />{es ? "¡Pago confirmado!" : "Pagamento Confirmado!"}</p>}
          {status !== "CONFIRMED" && !canPay && <p role="status" className="rounded-xl bg-[var(--status-warning-bg)] p-3 text-[var(--status-warning-ink)]">{status === "CANCELED" ? (es ? "Cobranza cancelada." : "Cobrança cancelada.") : (es ? "El código Pix venció." : "O código Pix expirou.")}</p>}
          {canPay && <>
            {qrSource && <div className="mx-auto w-fit rounded-xl border border-border-subtle bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- QR image returned inline by the gateway */}
              <img src={qrSource} alt={es ? "Código QR de pago Pix" : "QR Code do pagamento Pix"} width={192} height={192} />
            </div>}
            {charge.pixCopyPaste && <>
              <textarea aria-label={es ? "Código Pix" : "Código Pix copia e cola"} readOnly rows={2} value={charge.pixCopyPaste} className="w-full resize-none rounded-lg border border-border-subtle bg-subtle p-2 text-xs text-ink" />
              <Button type="button" className="w-full bg-accent text-accent-ink hover:bg-accent-hover" size="touch" onClick={() => void copyPix()}><Copy aria-hidden />{copied ? "Código copiado" : "Copiar código Pix"}</Button>
            </>}
            {!isManual && <p role="status" className="text-center text-xs text-ink-secondary">{statusError ? (es ? "Reconectando con la cobranza…" : "Reconectando à cobrança…") : (es ? "Esperando confirmación" : "Aguardando confirmação")}</p>}
            {charge.paymentProvider === "SANDBOX" && <div className="text-center"><Button type="button" variant="ghost" size="sm" disabled={simulating} onClick={() => void simulate()}>{es ? "Simular pago (Sandbox)" : "Simular Pagamento (Sandbox)"}</Button></div>}
          </>}
          {actionError && <p role="alert" className="text-xs text-[var(--status-danger-ink)]">{actionError}</p>}
        </div>}
      </DialogContent>
    </Dialog>
  );
}
