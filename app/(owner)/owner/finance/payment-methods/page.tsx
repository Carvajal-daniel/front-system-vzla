"use client";

import { useState } from "react";
import {
  Check,
  CreditCard,
  DollarSign,
  HelpCircle,
  Percent,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/ui/auth-guard";
import { usePaymentMethods } from "@/lib/use-payment-methods";
import type { PaymentMethod } from "@/lib/types/finance";

const methodIcons: Record<PaymentMethod, typeof CreditCard> = {
  PIX: Smartphone,
  CASH: DollarSign,
  CREDIT_CARD: CreditCard,
  DEBIT_CARD: CreditCard,
  TRANSFER: Wallet,
  OTHER: Wallet,
};

export default function PaymentMethodsPage() {
  const { session } = useSession();
  const { methods, updateMethod, resetDefaults } = usePaymentMethods(session.company.id);

  const handleToggle = (method: PaymentMethod, enabled: boolean) => {
    updateMethod(method, { enabled });
    toast.success(
      `${method} ${enabled ? "ativado" : "desativado"} com sucesso no balcão!`,
    );
  };

  const handleFeeChange = (method: PaymentMethod, val: string) => {
    const fee = parseFloat(val.replace(",", "."));
    updateMethod(method, { feePercentage: isNaN(fee) ? 0 : Math.max(0, fee) });
  };

  const handleDaysChange = (method: PaymentMethod, val: string) => {
    const days = parseInt(val, 10);
    updateMethod(method, { settlementDays: isNaN(days) ? 0 : Math.max(0, days) });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <CreditCard className="size-6 text-accent" />
            Formas de Pagamento no Balcão
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Configure quais meios de pagamento estão habilitados no caixa e suas respectivas taxas de operadora.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetDefaults();
            toast.success("Taxas e métodos restaurados para o padrão de mercado.");
          }}
          className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-xs font-semibold text-ink-secondary hover:text-ink hover:border-accent transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RotateCcw size={13} />
          Restaurar Padrões
        </button>
      </div>

      {/* Card de Aviso */}
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-3">
        <ShieldCheck className="size-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-ink">Impacto das Taxas de Cartão</p>
          <p className="text-ink-muted">
            As taxas cadastradas abaixo são utilizadas para deduzir o valor líquido recebido nas comandas e gerar o extrato com precisão contábil.
          </p>
        </div>
      </div>

      {/* Tabela de Configuração de Métodos */}
      <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
              <tr>
                <th className="py-3.5 px-4">Método de Pagamento</th>
                <th className="py-3.5 px-4">Status no Balcão</th>
                <th className="py-3.5 px-4">Taxa da Operadora (%)</th>
                <th className="py-3.5 px-4">Prazo de Compensação</th>
                <th className="py-3.5 px-4 text-right">Previsão Líquida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50">
              {methods.map((item) => {
                const Icon = methodIcons[item.method] ?? CreditCard;

                return (
                  <tr key={item.method} className="hover:bg-canvas/30 transition-colors">
                    <td className="py-3.5 px-4 min-w-[180px]">
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 place-items-center rounded-xl bg-accent/10 text-accent shrink-0">
                          <Icon size={16} />
                        </span>
                        <div>
                          <p className="font-semibold text-ink text-sm">{item.name}</p>
                          <p className="text-[11px] text-ink-muted">Código: {item.method}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) => handleToggle(item.method, e.target.checked)}
                          className="size-4 rounded-md accent-accent cursor-pointer"
                        />
                        <span
                          className={`text-xs font-semibold ${
                            item.enabled ? "text-emerald-600 dark:text-emerald-400" : "text-ink-muted"
                          }`}
                        >
                          {item.enabled ? "Ativo no Caixa" : "Desativado"}
                        </span>
                      </label>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 max-w-[110px]">
                        <input
                          type="text"
                          value={item.feePercentage}
                          disabled={!item.enabled}
                          onChange={(e) => handleFeeChange(item.method, e.target.value)}
                          className="w-16 rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1 text-xs text-ink font-mono text-center disabled:opacity-50"
                        />
                        <span className="text-ink-muted font-semibold">%</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 max-w-[140px]">
                        <input
                          type="number"
                          min={0}
                          max={90}
                          value={item.settlementDays}
                          disabled={!item.enabled}
                          onChange={(e) => handleDaysChange(item.method, e.target.value)}
                          className="w-16 rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1 text-xs text-ink font-mono text-center disabled:opacity-50"
                        />
                        <span className="text-ink-muted">
                          {item.settlementDays === 0 ? "Imediato (D+0)" : `dias (D+${item.settlementDays})`}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="text-xs text-ink font-medium">
                        R$ 100,00 →{" "}
                        <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                          R$ {(100 - (100 * item.feePercentage) / 100).toFixed(2).replace(".", ",")}
                        </strong>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
