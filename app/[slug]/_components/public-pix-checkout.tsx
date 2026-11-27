"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  X,
} from "lucide-react";
import { formatPriceFromCents } from "@/lib/format";
import {
  getPublicPaymentStatus,
  type PublicPaymentChargeDTO,
  type PublicPaymentStatus,
} from "@/src/services/public-portal";

interface PublicPixCheckoutProps {
  slug: string;
  charge: PublicPaymentChargeDTO;
  currency: string;
  title: string;
  subtitle?: string;
  onConfirmed: () => void;
  onClose?: () => void;
}

function getRemainingSeconds(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const target = Date.parse(expiresAt);
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / 1000));
}

function normalizeQrSrc(qrCodeBase64: string | null): string | null {
  if (!qrCodeBase64) return null;
  const trimmed = qrCodeBase64.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/")) return trimmed;
  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
    return `data:image/png;base64,${trimmed.replace(/\s+/g, "")}`;
  }
  return null;
}

/**
 * Componente reutilizável de Checkout Pix para sinal de agendamento e adesão ao Clube VIP.
 * Faz polling automático a cada 3 segundos até confirmação ou expiração.
 */
export function PublicPixCheckout({
  slug,
  charge,
  currency,
  title,
  subtitle,
  onConfirmed,
  onClose,
}: PublicPixCheckoutProps) {
  const [status, setStatus] = useState<PublicPaymentStatus>(charge.status);
  const [expiresAt, setExpiresAt] = useState<string | null>(charge.expiresAt);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(() =>
    getRemainingSeconds(charge.expiresAt),
  );
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [pollingWarning, setPollingWarning] = useState(false);

  const onConfirmedRef = useRef(onConfirmed);
  const confirmedFiredRef = useRef(false);

  useEffect(() => {
    onConfirmedRef.current = onConfirmed;
  }, [onConfirmed]);

  // Dispara callback de confirmação apenas uma vez ao transitar para CONFIRMED.
  useEffect(() => {
    if (status === "CONFIRMED" && !confirmedFiredRef.current) {
      confirmedFiredRef.current = true;
      onConfirmedRef.current();
    }
  }, [status]);

  // Contagem regressiva local baseada no expiresAt retornado pelo backend.
  useEffect(() => {
    if (!expiresAt || status !== "PENDING") return;
    const interval = window.setInterval(() => {
      const next = getRemainingSeconds(expiresAt);
      setRemainingSeconds(next);
      if (next === 0) {
        setStatus((prev) => (prev === "PENDING" ? "EXPIRED" : prev));
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt, status]);

  // Polling a cada 3s no endpoint público de status da cobrança.
  useEffect(() => {
    if (!charge.paymentId || status !== "PENDING") return;

    const controller = new AbortController();
    let timeoutId: number;

    async function pollStatus() {
      try {
        const result = await getPublicPaymentStatus(
          slug,
          charge.paymentId,
          controller.signal,
        );
        if (controller.signal.aborted) return;

        setPollingWarning(false);
        if (result.expiresAt) {
          setExpiresAt(result.expiresAt);
        }
        setStatus(result.status);
        if (result.status !== "PENDING") {
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
        setPollingWarning(true);
      }

      timeoutId = window.setTimeout(pollStatus, 3000);
    }

    timeoutId = window.setTimeout(pollStatus, 3000);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [slug, charge.paymentId, status]);

  async function handleCopyPix() {
    if (!charge.copyPaste) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(charge.copyPaste);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyError(
        "Não foi possível copiar automaticamente. Selecione e copie o código manualmente.",
      );
    }
  }

  const qrSrc = normalizeQrSrc(charge.qrCodeBase64);
  const clock =
    remainingSeconds === null
      ? null
      : `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(
          remainingSeconds % 60,
        ).padStart(2, "0")}`;
  const isTerminalFailure = status === "EXPIRED" || status === "CANCELED";

  return (
    <section
      aria-label={title}
      className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <QrCode className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-ink-secondary">{subtitle}</p>
            )}
          </div>
        </div>
        {onClose && status !== "CONFIRMED" && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar pagamento Pix"
            className="cursor-pointer rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-subtle hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 rounded-xl bg-subtle px-4 py-3">
        <div>
          <p className="text-xs text-ink-secondary">Valor do Pix</p>
          <p className="text-xl font-bold tabular-nums text-ink">
            {formatPriceFromCents(charge.amountCents, "pt-BR", currency)}
          </p>
        </div>
        {status === "PENDING" && clock && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-medium tabular-nums text-ink-secondary">
            <Clock3 className="size-3.5" aria-hidden="true" />
            Expira em {clock}
          </span>
        )}
      </div>

      {status === "CONFIRMED" && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-3.5 text-sm font-semibold text-[var(--status-success-ink)]"
        >
          <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
          Pagamento confirmado com sucesso!
        </div>
      )}

      {isTerminalFailure && (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-sm text-[var(--status-warning-ink)]"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              {status === "CANCELED"
                ? "Esta cobrança Pix foi cancelada. Volte para gerar um novo pagamento."
                : "O tempo deste código Pix expirou. Volte para gerar uma nova cobrança."}
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer inline-flex min-h-10 items-center justify-center rounded-xl bg-surface px-4 text-xs font-semibold text-ink border border-border-subtle hover:bg-subtle transition-colors"
            >
              Voltar e tentar novamente
            </button>
          )}
        </div>
      )}

      {status === "PENDING" && (
        <div className="space-y-4">
          {qrSrc && (
            <div className="mx-auto w-fit rounded-2xl border border-border-subtle bg-white p-3 shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element -- QR Code base64 retornado dinamicamente pelo gateway */}
              <img
                src={qrSrc}
                alt="QR Code para pagamento via Pix"
                width={200}
                height={200}
                className="size-48 sm:size-52 object-contain"
              />
            </div>
          )}

          {charge.copyPaste && (
            <div className="space-y-2">
              <label
                htmlFor={`pix-code-${charge.paymentId}`}
                className="block text-xs font-medium text-ink-secondary"
              >
                Pix Copia e Cola
              </label>
              <textarea
                id={`pix-code-${charge.paymentId}`}
                readOnly
                rows={3}
                value={charge.copyPaste}
                className="w-full resize-none rounded-xl border border-border-subtle bg-subtle p-3 font-mono text-xs text-ink focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleCopyPix()}
                className="cursor-pointer flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
              >
                {copied ? (
                  <>
                    <Check className="size-4" aria-hidden="true" />
                    Código Pix copiado!
                  </>
                ) : (
                  <>
                    <Copy className="size-4" aria-hidden="true" />
                    Copiar Código Pix
                  </>
                )}
              </button>
              {copyError && (
                <p
                  role="alert"
                  className="text-xs text-[var(--status-danger-ink)]"
                >
                  {copyError}
                </p>
              )}
            </div>
          )}

          {charge.checkoutUrl && (
            <a
              href={charge.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-subtle"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              Abrir link de pagamento
            </a>
          )}

          <div
            role="status"
            className="flex items-center justify-center gap-2 rounded-xl bg-subtle/70 px-3 py-2.5 text-xs text-ink-secondary"
          >
            <Loader2
              className="size-3.5 motion-safe:animate-spin text-accent"
              aria-hidden="true"
            />
            {pollingWarning
              ? "Reconectando para verificar o pagamento…"
              : "Aguardando confirmação automática do Pix…"}
          </div>
        </div>
      )}
    </section>
  );
}
