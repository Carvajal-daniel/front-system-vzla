"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Globe2,
  Lock,
  QrCode,
  Save,
  Shield,
  Smartphone,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/ui/auth-guard";

const STORAGE_PREFIX = "salao_online_payment_config_";

export default function OnlinePaymentsPage() {
  const { session } = useSession();
  const companyId = session.company.id;

  const [enabled, setEnabled] = useState(false);
  const [depositPercentage, setDepositPercentage] = useState<number>(30);
  const [pixKeyType, setPixKeyType] = useState<"CNPJ" | "EMAIL" | "PHONE" | "EVP">("CNPJ");
  const [pixKey, setPixKey] = useState("");
  const [autoRefundHours, setAutoRefundHours] = useState<number>(24);
  const [noShowPolicy, setNoShowPolicy] = useState(
    "Em caso de não comparecimento ou cancelamento com menos de 24 horas, o valor do sinal não será reembolsado.",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !companyId) return;
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${companyId}`);
      if (raw) {
        const config = JSON.parse(raw);
        setEnabled(Boolean(config.enabled));
        if (config.depositPercentage) setDepositPercentage(config.depositPercentage);
        if (config.pixKeyType) setPixKeyType(config.pixKeyType);
        if (config.pixKey) setPixKey(config.pixKey);
        if (config.autoRefundHours) setAutoRefundHours(config.autoRefundHours);
        if (config.noShowPolicy) setNoShowPolicy(config.noShowPolicy);
      }
    } catch {
      // ignore
    }
  }, [companyId]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const config = {
        enabled,
        depositPercentage,
        pixKeyType,
        pixKey,
        autoRefundHours,
        noShowPolicy,
      };
      localStorage.setItem(`${STORAGE_PREFIX}${companyId}`, JSON.stringify(config));
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

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Save size={14} />
          Salvar Configurações
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
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
              onChange={(e) => setEnabled(e.target.checked)}
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
                    onClick={() => setDepositPercentage(pct)}
                    className={`rounded-xl border py-2.5 text-xs font-bold transition-all ${
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
                    onClick={() => setPixKeyType(type)}
                    className={`rounded-lg border py-1.5 text-[11px] font-semibold transition-colors ${
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
                onChange={(e) => setPixKey(e.target.value)}
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
                onChange={(e) => setAutoRefundHours(Number(e.target.value))}
                className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
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
                onChange={(e) => setNoShowPolicy(e.target.value)}
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
