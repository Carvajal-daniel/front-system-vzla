"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Globe2,
  QrCode,
  Save,
  Shield,
  Zap,
} from "lucide-react";
import type { OnlinePaymentSettings } from "@/lib/company-settings";
import type { PaymentConnectionStatus } from "@/lib/online-payments";
import { toast } from "sonner";
import { saveCompanySettings, useCompanySettings } from "@/lib/use-company-settings";
import { useSession } from "@/components/ui/auth-guard";
import { PaymentGatewaySettings } from "./payment-gateway-settings";

const STORAGE_PREFIX = "salao_online_payment_config_";

export function OnlinePaymentSettingsPanel() {
  const { session } = useSession();
  const companyId = session.company.id;
  const { settings } = useCompanySettings(companyId, undefined, true, true);

  const [legacy] = useState<Partial<OnlinePaymentSettings>>(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${companyId}`);
      return raw ? JSON.parse(raw) as Partial<OnlinePaymentSettings> : {};
    } catch { return {}; }
  });
  const [draft, setDraft] = useState<Partial<OnlinePaymentSettings>>({});
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<PaymentConnectionStatus | null>(null);
  const current = {
    enabled: false, depositPercentage: 30, pixKeyType: "CNPJ", pixKey: "", autoRefundHours: 24,
    noShowPolicy: "Em caso de não comparecimento ou cancelamento com menos de 24 horas, o valor do sinal não será reembolsado.",
    ...(settings.onlinePayment ?? legacy), ...draft,
  } satisfies OnlinePaymentSettings;
  const { enabled, depositPercentage, pixKeyType, pixKey, autoRefundHours, noShowPolicy } = current;
  const update = (patch: Partial<OnlinePaymentSettings>) => setDraft((previous) => ({ ...previous, ...patch }));
  const publicPortalPath = settings.slug ? `/${encodeURIComponent(settings.slug)}` : null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveCompanySettings(companyId, { onlinePayment: current });
      setDraft({});
      toast.success("Configurações de Pagamento Online salvas com sucesso!");
    } catch {
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Globe2 className="size-6 text-accent" />
            Pagamento Online e Cobrança de Sinal
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Reduza faltas e no-shows cobrando um adiantamento no agendamento online do cliente.
          </p>
        </div>

      </div>

      <PaymentGatewaySettings onStatusChange={setConnectionStatus} />

      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink">Regras do sinal anti-no-show</h3>
            <p className="text-xs text-ink-muted">
              Defina o percentual de adiantamento e o prazo de reembolso aplicados no Portal Público.
            </p>
          </div>
          <button type="submit" disabled={saving}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">
            <Save size={14} aria-hidden />
            {saving ? "Salvando…" : "Salvar regras do sinal"}
          </button>
        </div>

        {connectionStatus?.connected && enabled && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 size={16} className="shrink-0" aria-hidden />
              <span>
                Tudo pronto! O sinal de {depositPercentage}% já está ativo para reservas no seu Portal Público
                {publicPortalPath ? ` (${publicPortalPath})` : ""}.
              </span>
            </div>
            {publicPortalPath && (
              <Link
                href={publicPortalPath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex cursor-pointer items-center gap-1 font-bold underline"
              >
                Abrir portal público
                <ExternalLink size={13} aria-hidden />
              </Link>
            )}
          </div>
        )}
        {/* Card de Status Principal */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`grid size-10 place-items-center rounded-xl shrink-0 ${
                enabled ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-canvas text-ink-muted"
              }`}
            >
              <Zap size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">
                Exigir Pagamento Online no Agendamento Público
              </h3>
              <p className="mt-0.5 text-xs text-ink-muted">
                Quando ativado, o cliente deve pagar o sinal via PIX para garantir o horário na agenda.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
              className="size-5 rounded-md accent-accent cursor-pointer"
            />
            <span
              className={`text-xs font-bold ${
                enabled ? "text-emerald-600 dark:text-emerald-400" : "text-ink-muted"
              }`}
            >
              {enabled ? "Ativado" : "Desativado"}
            </span>
          </label>
        </div>

        {/* Grade de Configurações */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Coluna 1: Valor do Sinal e Chave PIX */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <QrCode size={16} className="text-accent" />
              Valor do Sinal e Recebimento
            </h3>

            <div>
              <label className="text-xs font-semibold text-ink-secondary block mb-1.5">
                Porcentagem do Sinal Exigida
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[20, 30, 50, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => update({ depositPercentage: pct })}
                    className={`cursor-pointer rounded-xl border py-2.5 text-xs font-bold transition-all ${
                      depositPercentage === pct
                        ? "border-accent bg-accent/15 text-accent shadow-xs"
                        : "border-border-subtle bg-canvas/40 text-ink-secondary hover:text-ink"
                    }`}
                  >
                    {pct === 100 ? "100% (Total)" : `${pct}%`}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-ink-muted mt-1.5">
                Exemplo: Para um serviço de R$ 100, o cliente pagará R$ {depositPercentage},00 para confirmar o horário.
              </p>
            </div>

            <div className="pt-2 border-t border-border-subtle space-y-3">
              <label className="text-xs font-semibold text-ink-secondary block">
                Chave PIX para Recebimento Automático
              </label>

              <div className="grid grid-cols-3 gap-2">
                {(["CNPJ", "EMAIL", "PHONE", "EVP"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => update({ pixKeyType: type })}
                    className={`cursor-pointer rounded-lg border py-1.5 text-[11px] font-semibold transition-colors ${
                      pixKeyType === type
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-border-subtle bg-canvas/40 text-ink-secondary hover:text-ink"
                    }`}
                  >
                    {type === "PHONE" ? "Telefone" : type}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Insira sua chave PIX aqui..."
                value={pixKey}
                onChange={(e) => update({ pixKey: e.target.value })}
                className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink font-mono"
              />
            </div>
          </div>

          {/* Coluna 2: Política de Cancelamento e Reembolso */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Shield size={16} className="text-accent" />
              Política Anti-Falta e Reembolso
            </h3>

            <div>
              <label className="text-xs font-semibold text-ink-secondary block mb-1">
                Prazo Mínimo para Cancelamento com Reembolso
              </label>
              <select
                value={autoRefundHours}
                onChange={(e) => update({ autoRefundHours: Number(e.target.value) })}
                className="w-full cursor-pointer rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
              >
                <option value={6}>Até 6 horas antes do horário</option>
                <option value={12}>Até 12 horas antes do horário</option>
                <option value={24}>Até 24 horas antes do horário (Recomendado)</option>
                <option value={48}>Até 48 horas antes do horário</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-secondary block mb-1">
                Texto Exibido ao Cliente no Agendamento
              </label>
              <textarea
                rows={4}
                value={noShowPolicy}
                onChange={(e) => update({ noShowPolicy: e.target.value })}
                className="w-full rounded-xl border border-border-subtle bg-canvas/40 p-3 text-xs text-ink resize-y"
              />
            </div>

            <div className="rounded-xl border border-border-subtle bg-canvas/30 p-3 text-[11px] text-ink-muted flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 text-amber-500 mt-0.5" />
              <span>
                Este aviso será exibido com destaque antes do cliente concluir a reserva no link público do seu salão.
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
