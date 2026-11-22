"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Coins,
  DollarSign,
  Download,
  Filter,
  HandCoins,
  History,
  Loader2,
  MinusCircle,
  Plus,
  Receipt,
  RefreshCw,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import { formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import type {
  CommissionDeductionCategory,
  CommissionReport,
  PaymentMethod,
} from "@/lib/types/finance";
import type { Collaborator } from "@/lib/types/team";

const dayInMs = 86_400_000;

function formatIsoInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export default function CommissionsPage() {
  const { session } = useSession();
  const { locale, t } = useLocale();
  const timezone = session.company.timezone;
  const currency = session.company.currency ?? "BRL";

  const todayIso = useMemo(() => formatIsoInTimezone(new Date(), timezone), [timezone]);
  const [fromDate, setFromDate] = useState(() => {
    const [y, m] = todayIso.split("-").map(Number);
    return formatIsoInTimezone(new Date(Date.UTC(y, m - 1, 1)), timezone);
  });
  const [toDate, setToDate] = useState(() => {
    const [y, m] = todayIso.split("-").map(Number);
    return formatIsoInTimezone(new Date(Date.UTC(y, m, 0)), timezone);
  });

  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string>("");
  const [report, setReport] = useState<CommissionReport | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais de Vale e Liquidação
  const [deductionModalOpen, setDeductionModalOpen] = useState(false);
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);

  // Form de Vale / Dedução
  const [deductCollabId, setDeductCollabId] = useState("");
  const [deductCategory, setDeductCategory] = useState<CommissionDeductionCategory>("ADVANCE");
  const [deductDescription, setDeductDescription] = useState("");
  const [deductAmount, setDeductAmount] = useState("");
  const [deducting, setDeducting] = useState(false);

  // Form de Pagamento / Liquidação
  const [settleCollabId, setSettleCollabId] = useState("");
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>("PIX");
  const [settleNotes, setSettleNotes] = useState("");
  const [settling, setSettling] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [commissionsRes, collabsRes] = await Promise.all([
        apiRequest<CommissionReport>("/finance/commissions", {
          query: {
            from: fromDate,
            to: toDate,
            collaboratorId: selectedCollaboratorId || undefined,
          },
        }),
        apiRequest<{ collaborators: Collaborator[] } | Collaborator[]>("/collaborators"),
      ]);

      setReport(commissionsRes);
      setCollaborators(Array.isArray(collabsRes) ? collabsRes : collabsRes.collaborators ?? []);
    } catch {
      toast.error("Erro ao carregar relatório de comissões.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, selectedCollaboratorId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Totais dos 3 KPIs
  const totals = useMemo(() => {
    let grossCommissionsCents = 0;
    let deductionsCents = 0;
    let netPayableCents = 0;

    if (report?.professionals) {
      for (const p of report.professionals) {
        grossCommissionsCents += p.payableInCents;
        deductionsCents += p.deductionsInCents;
        netPayableCents += p.netPayableInCents;
      }
    }

    return { grossCommissionsCents, deductionsCents, netPayableCents };
  }, [report]);

  // Salvar Vale / Dedução
  const handleSaveDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deductCollabId || !deductDescription.trim()) {
      toast.warning("Preencha todos os campos do vale.");
      return;
    }
    const cents = Math.round(Number(deductAmount.replace(",", ".")) * 100);
    if (!cents || cents <= 0) {
      toast.warning("Informe um valor válido em reais.");
      return;
    }

    setDeducting(true);
    try {
      await apiRequest("/finance/commission-deductions", {
        method: "POST",
        body: {
          collaboratorId: deductCollabId,
          category: deductCategory,
          description: deductDescription.trim(),
          amountCents: cents,
          deductedAt: todayIso,
        },
      });

      toast.success("Vale / Abatimento lançado com sucesso!");
      setDeductionModalOpen(false);
      setDeductDescription("");
      setDeductAmount("");
      void loadData();
    } catch {
      toast.error("Erro ao lançar vale para o profissional.");
    } finally {
      setDeducting(false);
    }
  };

  // Salvar Liquidação / Pagamento
  const handleSaveSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleCollabId) {
      toast.warning("Selecione o profissional para liquidar.");
      return;
    }

    setSettling(true);
    try {
      await apiRequest("/finance/commission-settlements", {
        method: "POST",
        body: {
          collaboratorId: settleCollabId,
          periodStart: fromDate,
          periodEnd: toDate,
          paidOn: todayIso,
          paymentMethod: settleMethod,
          notes: settleNotes.trim() || undefined,
        },
      });

      toast.success("Comissões pagas e liquidadas com sucesso!");
      setSettlementModalOpen(false);
      setSettleNotes("");
      void loadData();
    } catch {
      toast.error("Erro ao liquidar comissões.");
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho com Ações */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Coins className="size-6 text-accent" />
            Gestão de Comissões e Vales
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Calcule pagamentos da equipe, lance adiantamentos/vales e liquide comissões por período.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDeductCollabId(selectedCollaboratorId || collaborators[0]?.id || "");
              setDeductionModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-xs font-semibold text-ink hover:border-accent transition-colors cursor-pointer"
          >
            <MinusCircle size={14} className="text-rose-500" />
            + Lançar Vale / Abatimento
          </button>

          <button
            type="button"
            onClick={() => {
              setSettleCollabId(selectedCollaboratorId || collaborators[0]?.id || "");
              setSettlementModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs cursor-pointer"
          >
            <HandCoins size={14} />
            Pagar Comissões
          </button>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="grid size-9 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink disabled:opacity-50 transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* 3 KPIs Principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            Comissões Brutas (A Pagar)
          </span>
          <div className="mt-2 text-2xl font-bold text-ink">
            <SensitiveValue>
              {formatPriceFromCents(totals.grossCommissionsCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Gerado por serviços concluídos no período</p>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 shadow-xs">
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
            Vales e Abatimentos
          </span>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
            -
            <SensitiveValue>
              {formatPriceFromCents(totals.deductionsCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Produtos consumidos ou adiantamentos</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
            Saldo Líquido a Pagar
          </span>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            <SensitiveValue>
              {formatPriceFromCents(totals.netPayableCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Valor final a transferir para os profissionais</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink-secondary">Período:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
            />
            <span className="text-ink-muted">até</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink-secondary">Profissional:</span>
            <select
              value={selectedCollaboratorId}
              onChange={(e) => setSelectedCollaboratorId(e.target.value)}
              className="rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
            >
              <option value="">Toda a Equipe</option>
              {collaborators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex rounded-xl border border-border-subtle bg-canvas/40 p-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setFromDate(todayIso);
              setToDate(todayIso);
            }}
            className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => {
              setFromDate(formatIsoInTimezone(new Date(Date.now() - 7 * dayInMs), timezone));
              setToDate(todayIso);
            }}
            className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors"
          >
            Semana
          </button>
          <button
            type="button"
            onClick={() => {
              const [y, m] = todayIso.split("-").map(Number);
              const first = new Date(Date.UTC(y, m - 1, 1));
              const last = new Date(Date.UTC(y, m, 0));
              setFromDate(formatIsoInTimezone(first, timezone));
              setToDate(formatIsoInTimezone(last, timezone));
            }}
            className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors"
          >
            Este mês
          </button>
        </div>
      </div>

      {/* Tabela de Comissões por Profissional */}
      <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="mt-3 text-xs text-ink-muted">Calculando comissões da equipe...</p>
          </div>
        ) : !report?.professionals || report.professionals.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-muted">
            Nenhuma comissão encontrada para os profissionais no período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">Profissional</th>
                  <th className="py-3 px-4">Comissão Prevista</th>
                  <th className="py-3 px-4">Vales / Deduções</th>
                  <th className="py-3 px-4">Saldo Líquido</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {report.professionals.map((prof) => (
                  <tr key={prof.collaboratorId} className="hover:bg-canvas/30 transition-colors">
                    <td className="py-3 px-4 min-w-[140px]">
                      <span className="font-semibold text-ink text-sm block">{prof.name}</span>
                      <span className="text-[11px] text-ink-muted">
                        {prof.deductions?.length ?? 0} vale(s) ativos
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-medium text-ink">
                      <SensitiveValue>
                        {formatPriceFromCents(prof.payableInCents, locale, currency)}
                      </SensitiveValue>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-rose-500 font-medium">
                      {prof.deductionsInCents > 0 ? (
                        <>
                          -
                          <SensitiveValue>
                            {formatPriceFromCents(prof.deductionsInCents, locale, currency)}
                          </SensitiveValue>
                        </>
                      ) : (
                        "R$ 0,00"
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      <SensitiveValue>
                        {formatPriceFromCents(prof.netPayableInCents, locale, currency)}
                      </SensitiveValue>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setSettleCollabId(prof.collaboratorId);
                          setSettlementModalOpen(true);
                        }}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors shadow-2xs"
                      >
                        Liquidar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Lançar Vale / Abatimento */}
      {deductionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <MinusCircle size={18} className="text-rose-500" />
              Lançar Vale / Abatimento
            </h3>

            <form onSubmit={handleSaveDeduction} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-ink-secondary block mb-1">
                  Profissional
                </label>
                <select
                  required
                  value={deductCollabId}
                  onChange={(e) => setDeductCollabId(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-ink"
                >
                  {collaborators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-ink-secondary block mb-1">
                  Tipo de Dedução
                </label>
                <select
                  value={deductCategory}
                  onChange={(e) =>
                    setDeductCategory(e.target.value as CommissionDeductionCategory)
                  }
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-ink"
                >
                  <option value="ADVANCE">Adiantamento em Dinheiro (Vale)</option>
                  <option value="STOCK_PRODUCT">Consumo de Produto do Estoque</option>
                  <option value="OTHER">Outros / Danos / Empréstimo</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-ink-secondary block mb-1">
                  Descrição do Vale
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Vale semanal ou Pomada modeladora"
                  value={deductDescription}
                  onChange={(e) => setDeductDescription(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-ink"
                />
              </div>

              <div>
                <label className="font-semibold text-ink-secondary block mb-1">
                  Valor a Descontar (R$)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 50,00"
                  value={deductAmount}
                  onChange={(e) => setDeductAmount(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-ink font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeductionModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-ink-secondary hover:text-ink transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={deducting}
                  className="rounded-xl bg-accent px-4 py-2 font-bold text-accent-ink hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {deducting ? "Salvando..." : "Confirmar Vale"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Liquidar Comissões */}
      {settlementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <HandCoins size={18} className="text-accent" />
              Liquidar Pagamento de Comissões
            </h3>

            <form onSubmit={handleSaveSettlement} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-ink-secondary block mb-1">
                  Profissional a Receber
                </label>
                <select
                  required
                  value={settleCollabId}
                  onChange={(e) => setSettleCollabId(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-ink"
                >
                  {collaborators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-ink-secondary block mb-1">
                  Forma de Pagamento
                </label>
                <select
                  value={settleMethod}
                  onChange={(e) => setSettleMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-ink"
                >
                  <option value="PIX">PIX</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="TRANSFER">Transferência Bancária</option>
                  <option value="OTHER">Outros</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-ink-secondary block mb-1">
                  Observações / Comprovante
                </label>
                <textarea
                  placeholder="Ex: Pago via chave PIX Nubank..."
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-ink min-h-16"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettlementModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-ink-secondary hover:text-ink transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={settling}
                  className="rounded-xl bg-accent px-4 py-2 font-bold text-accent-ink hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {settling ? "Processando..." : "Confirmar Liquidação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
