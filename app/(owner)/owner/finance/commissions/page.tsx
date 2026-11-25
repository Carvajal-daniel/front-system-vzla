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
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import type {
  CommissionDeductionCategory,
  CommissionReport,
  PaymentMethod,
} from "@/lib/types/finance";
import type { Collaborator } from "@/lib/types/team";
import { CommissionDetailDrawer } from "./_components/commission-detail-drawer";

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

  // Modais de Vale, Liquidação e Drawer de Relatório Detalhado
  const [deductionModalOpen, setDeductionModalOpen] = useState(false);
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const [detailCollaboratorId, setDetailCollaboratorId] = useState<string | null>(null);

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
      toast.error(locale === "es" ? "Error al cargar el reporte de comisiones." : "Erro ao carregar relatório de comissões.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, selectedCollaboratorId, locale]);

  const es = locale === "es";

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
      toast.warning(es ? "Completa todos los campos del vale." : "Preencha todos os campos do vale.");
      return;
    }
    const cents = Math.round(Number(deductAmount.replace(",", ".")) * 100);
    if (!cents || cents <= 0) {
      toast.warning(es ? `Ingresa un monto válido en ${currency}.` : `Informe um valor válido em ${currency}.`);
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

      toast.success(es ? "¡Vale / descuento registrado con éxito!" : "Vale / Abatimento lançado com sucesso!");
      setDeductionModalOpen(false);
      setDeductDescription("");
      setDeductAmount("");
      void loadData();
    } catch {
      toast.error(es ? "Error al registrar el vale para el profesional." : "Erro ao lançar vale para o profissional.");
    } finally {
      setDeducting(false);
    }
  };

  // Salvar Liquidação / Pagamento
  const handleSaveSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleCollabId) {
      toast.warning(es ? "Selecciona el profesional a liquidar." : "Selecione o profissional para liquidar.");
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

      toast.success(es ? "¡Comisiones pagadas y liquidadas con éxito!" : "Comissões pagas e liquidadas com sucesso!");
      setSettlementModalOpen(false);
      setSettleNotes("");
      void loadData();
    } catch {
      toast.error(es ? "Error al liquidar comisiones." : "Erro ao liquidar comissões.");
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho com Ações */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2 text-balance">
            <Coins className="size-6 text-accent" aria-hidden="true" />
            {es ? "Gestión de Comisiones y Vales" : "Gestão de Comissões e Vales"}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            {es
              ? "Calcula pagos del equipo, registra adelantos/vales y liquida comisiones por período."
              : "Calcule pagamentos da equipe, lance adiantamentos/vales e liquide comissões por período."}
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
            <MinusCircle size={14} className="text-[var(--status-danger)]" aria-hidden="true" />
            {es ? "Registrar Vale / Descuento" : "Lançar Vale / Abatimento"}
          </button>

          <button
            type="button"
            onClick={() => {
              setSettleCollabId(selectedCollaboratorId || collaborators[0]?.id || "");
              setSettlementModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs cursor-pointer"
          >
            <HandCoins size={14} aria-hidden="true" />
            {es ? "Pagar Comisiones" : "Pagar Comissões"}
          </button>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="grid size-9 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink disabled:opacity-50 transition-colors cursor-pointer"
            title={es ? "Actualizar datos" : "Atualizar dados"}
            aria-label={es ? "Actualizar datos" : "Atualizar dados"}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 3 KPIs Principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-[0_1px_3px_0_rgb(15_23_42/0.06),0_1px_2px_-1px_rgb(15_23_42/0.04)]">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            {es ? "Comisiones Brutas (Por Pagar)" : "Comissões Brutas (A Pagar)"}
          </span>
          <div className="mt-2 font-mono text-2xl font-bold text-ink tabular-nums">
            <SensitiveValue>
              {formatPriceFromCents(totals.grossCommissionsCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {es ? "Generado por servicios concluidos en el período" : "Gerado por serviços concluídos no período"}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-5 shadow-[0_1px_3px_0_rgb(15_23_42/0.06),0_1px_2px_-1px_rgb(15_23_42/0.04)]">
          <span className="text-xs font-semibold text-[var(--status-danger-ink)] uppercase tracking-wide">
            {es ? "Vales y Descuentos" : "Vales e Abatimentos"}
          </span>
          <div className="mt-2 font-mono text-2xl font-bold text-[var(--status-danger-ink)] tabular-nums">
            -
            <SensitiveValue>
              {formatPriceFromCents(totals.deductionsCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-[var(--status-danger-ink)]/80">
            {es ? "Productos consumidos o adelantos" : "Produtos consumidos ou adiantamentos"}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-5 shadow-[0_1px_3px_0_rgb(15_23_42/0.06),0_1px_2px_-1px_rgb(15_23_42/0.04)]">
          <span className="text-xs font-semibold text-[var(--status-success-ink)] uppercase tracking-wide">
            {es ? "Saldo Neto a Pagar" : "Saldo Líquido a Pagar"}
          </span>
          <div className="mt-2 font-mono text-2xl font-bold text-[var(--status-success-ink)] tabular-nums">
            <SensitiveValue>
              {formatPriceFromCents(totals.netPayableCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-[var(--status-success-ink)]/80">
            {es ? "Valor final a transferir a los profesionales" : "Valor final a transferir para os profissionais"}
          </p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink-secondary">{es ? "Período:" : "Período:"}</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5 font-mono text-xs text-ink tabular-nums"
            />
            <span className="text-ink-muted">{es ? "hasta" : "até"}</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5 font-mono text-xs text-ink tabular-nums"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink-secondary">{es ? "Profesional:" : "Profissional:"}</span>
            <select
              value={selectedCollaboratorId}
              onChange={(e) => setSelectedCollaboratorId(e.target.value)}
              className="rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
            >
              <option value="">{es ? "Todo el Equipo" : "Toda a Equipe"}</option>
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
                      <button
                        type="button"
                        onClick={() => setDetailCollaboratorId(prof.collaboratorId)}
                        className="cursor-pointer text-left group"
                      >
                        <span className="font-semibold text-ink text-sm block group-hover:text-accent group-hover:underline">
                          {prof.name}
                        </span>
                        <span className="text-[11px] text-ink-muted">
                          {prof.deductions?.length ?? 0}{" "}
                          {locale === "es" ? "vale(s) activo(s)" : "vale(s) ativos"}
                        </span>
                      </button>
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
                        formatPriceFromCents(0, locale, currency)
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
                        onClick={() => setDetailCollaboratorId(prof.collaboratorId)}
                        className="cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors shadow-2xs"
                      >
                        {locale === "es" ? "Ver Reporte / Liquidar" : "Ver Relatório / Liquidar"}
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
      <Modal
        open={deductionModalOpen}
        title={es ? "Registrar Vale / Descuento" : "Lançar Vale / Abatimento"}
        maxWidth="max-w-md"
        onClose={() => setDeductionModalOpen(false)}
      >
        <form onSubmit={handleSaveDeduction} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-ink-secondary block mb-1">
              {es ? "Profesional" : "Profissional"}
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
              {es ? "Tipo de Deducción" : "Tipo de Dedução"}
            </label>
            <select
              value={deductCategory}
              onChange={(e) =>
                setDeductCategory(e.target.value as CommissionDeductionCategory)
              }
              className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-ink"
            >
              <option value="ADVANCE">{es ? "Adelanto en Efectivo (Vale)" : "Adiantamento em Dinheiro (Vale)"}</option>
              <option value="STOCK_PRODUCT">{es ? "Consumo de Producto de Inventario" : "Consumo de Produto do Estoque"}</option>
              <option value="OTHER">{es ? "Otros / Daños / Préstamo" : "Outros / Danos / Empréstimo"}</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-ink-secondary block mb-1">
              {es ? "Descripción del Vale" : "Descrição do Vale"}
            </label>
            <input
              type="text"
              required
              placeholder={es ? "Ej: Vale semanal o Pomada" : "Ex: Vale semanal ou Pomada modeladora"}
              value={deductDescription}
              onChange={(e) => setDeductDescription(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-ink"
            />
          </div>

          <div>
            <label className="font-semibold text-ink-secondary block mb-1">
              {es ? `Monto a Descontar (${currency})` : `Valor a Descontar (${currency})`}
            </label>
            <input
              type="text"
              required
              placeholder="50,00"
              value={deductAmount}
              onChange={(e) => setDeductAmount(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-ink font-mono tabular-nums"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeductionModalOpen(false)}
            >
              {es ? "Cancelar" : "Cancelar"}
            </Button>
            <Button type="submit" disabled={deducting}>
              {deducting
                ? es ? "Guardando..." : "Salvando..."
                : es ? "Confirmar Vale" : "Confirmar Vale"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Liquidar Comissões */}
      <Modal
        open={settlementModalOpen}
        title={es ? "Liquidar Pago de Comisiones" : "Liquidar Pagamento de Comissões"}
        maxWidth="max-w-md"
        onClose={() => setSettlementModalOpen(false)}
      >
        <form onSubmit={handleSaveSettlement} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-ink-secondary block mb-1">
              {es ? "Profesional a Recibir" : "Profissional a Receber"}
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
              {es ? "Forma de Pago" : "Forma de Pagamento"}
            </label>
            <select
              value={settleMethod}
              onChange={(e) => setSettleMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-ink"
            >
              <option value="PIX">PIX</option>
              <option value="CASH">{es ? "Efectivo" : "Dinheiro"}</option>
              <option value="TRANSFER">{es ? "Transferencia Bancaria" : "Transferência Bancária"}</option>
              <option value="OTHER">{es ? "Otros" : "Outros"}</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-ink-secondary block mb-1">
              {es ? "Observaciones / Comprobante" : "Observações / Comprovante"}
            </label>
            <textarea
              placeholder={es ? "Ej: Pago por transferencia..." : "Ex: Pago via chave PIX..."}
              value={settleNotes}
              onChange={(e) => setSettleNotes(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-ink min-h-16"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSettlementModalOpen(false)}
            >
              {es ? "Cancelar" : "Cancelar"}
            </Button>
            <Button type="submit" disabled={settling}>
              {settling
                ? es ? "Procesando..." : "Processando..."
                : es ? "Confirmar Liquidación" : "Confirmar Liquidação"}
            </Button>
          </div>
        </form>
      </Modal>
      {/* Drawer de Relatório Detalhado e Liquidação por Profissional */}
      {detailCollaboratorId && (
        <CommissionDetailDrawer
          collaboratorId={detailCollaboratorId}
          fromDate={fromDate}
          toDate={toDate}
          todayIso={todayIso}
          timezone={timezone}
          currency={currency}
          onClose={() => setDetailCollaboratorId(null)}
          onSettled={() => void loadData()}
        />
      )}
    </div>
  );
}
