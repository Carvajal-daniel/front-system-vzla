"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  CheckCircle2,
  ExternalLink,
  Gift,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { useClients } from "@/lib/use-clients";
import { useLoyalty, type LoyaltyProgram } from "@/lib/use-loyalty";

export default function LoyaltyProgramPage() {
  const { session } = useSession();
  const { locale } = useLocale();
  const timezone = session.company.timezone;
  const companyId = session.company.id;

  const { clients, loading: clientsLoading, refresh } = useClients(companyId);
  const { program, updateProgram, getClientLoyalty, addPoints, redeemReward, redemptions } =
    useLoyalty(companyId);

  const [activeTab, setActiveTab] = useState<"members" | "redemptions">("members");
  const [search, setSearch] = useState("");
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Formulário de configuração do programa
  const [programForm, setProgramForm] = useState<LoyaltyProgram>(program);

  // Sincroniza formulário com o programa atual
  const handleOpenSettings = () => {
    setProgramForm(program);
    setSettingsModalOpen(true);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateProgram(programForm);
    setSettingsModalOpen(false);
    toast.success("Regras do Programa de Fidelidade atualizadas com sucesso!");
  };

  // Clientes com progresso da cartela
  const clientProgressList = useMemo(() => {
    const q = search.trim().toLowerCase();

    return clients
      .map((c) => {
        const loyalty = getClientLoyalty(c.id);
        const progress = Math.min(100, Math.round((loyalty.points / program.pointsRequired) * 100));
        const canRedeem = loyalty.points >= program.pointsRequired;

        return {
          ...c,
          points: loyalty.points,
          totalEarned: loyalty.totalEarned,
          totalRedeemed: loyalty.totalRedeemed,
          progress,
          canRedeem,
        };
      })
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
        );
      })
      .sort((a, b) => b.points - a.points);
  }, [clients, getClientLoyalty, program.pointsRequired, search]);

  // KPIs da fidelidade
  const kpis = useMemo(() => {
    let accumulatingCount = 0;
    for (const c of clientProgressList) {
      if (c.points > 0) accumulatingCount += 1;
    }
    return {
      accumulatingCount,
      totalRedeemedCount: redemptions.length,
    };
  }, [clientProgressList, redemptions]);

  // Mapa de clientes para tabela de resgates
  const clientsMap = useMemo(() => {
    const map = new Map<string, (typeof clients)[0]>();
    for (const c of clients) map.set(c.id, c);
    return map;
  }, [clients]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Gift className="size-6 text-accent" />
            Programa de Fidelidade (Cartela de Pontos)
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Incentive a recorrência dos clientes pontuando automaticamente a cada comanda e premiando
            os mais fiéis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenSettings}
            className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-xs font-semibold text-ink hover:border-accent transition-colors cursor-pointer shadow-xs"
          >
            <Settings size={14} />
            Configurar Programa
          </button>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={clientsLoading}
            className="grid size-9 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink disabled:opacity-50 transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={clientsLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* 3 KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5 shadow-xs">
          <span className="text-xs font-semibold text-accent uppercase tracking-wide">
            Programa Ativo
          </span>
          <div className="mt-2 text-xl font-bold text-ink truncate">{program.name}</div>
          <p className="mt-1 text-xs text-ink-muted">
            Meta: {program.pointsRequired} pontos = {program.rewardDescription}
          </p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            Clientes Pontuando
          </span>
          <div className="mt-2 text-3xl font-bold text-ink">{kpis.accumulatingCount}</div>
          <p className="mt-1 text-xs text-ink-muted">Clientes com saldo positivo na cartela</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
            Prêmios Resgatados
          </span>
          <div className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {kpis.totalRedeemedCount}
          </div>
          <p className="mt-1 text-xs text-ink-muted">Recompensas entregues no histórico</p>
        </div>
      </div>

      {/* Abas */}
      <div className="space-y-4">
        <div className="flex border-b border-border-subtle gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`pb-3 px-1 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "members"
                ? "border-b-2 border-accent text-accent"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Users size={14} />
            Clientes na Cartela ({clientProgressList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("redemptions")}
            className={`pb-3 px-1 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "redemptions"
                ? "border-b-2 border-accent text-accent"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <History size={14} />
            Histórico de Resgates ({redemptions.length})
          </button>
        </div>

        {/* Aba 1: Clientes na Cartela */}
        {activeTab === "members" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
              <div className="relative w-64 sm:w-80">
                <Search className="absolute left-3 top-2.5 size-4 text-ink-muted" />
                <input
                  type="text"
                  placeholder="Buscar cliente na cartela..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
                />
              </div>

              <span className="text-xs text-ink-muted">
                {clientProgressList.length} cliente(s)
              </span>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
              {clientsLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="size-8 animate-spin text-accent" />
                  <p className="mt-3 text-xs text-ink-muted">Carregando cartelas...</p>
                </div>
              ) : clientProgressList.length === 0 ? (
                <div className="py-16 text-center text-xs text-ink-muted">
                  Nenhum cliente encontrado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                      <tr>
                        <th className="py-3 px-4">Cliente</th>
                        <th className="py-3 px-4">Progresso na Cartela</th>
                        <th className="py-3 px-4">Pontos Atuais</th>
                        <th className="py-3 px-4">Resgates Feitos</th>
                        <th className="py-3 px-4 text-right">Ações Rápidas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle/50">
                      {clientProgressList.map((client) => (
                        <tr key={client.id} className="hover:bg-canvas/30 transition-colors">
                          <td className="py-3 px-4">
                            <Link
                              href={`/owner/clients/${client.id}`}
                              className="font-semibold text-ink hover:text-accent hover:underline block truncate"
                            >
                              {client.name}
                            </Link>
                            <span className="text-[11px] text-ink-muted font-mono">
                              {client.phone}
                            </span>
                          </td>

                          <td className="py-3 px-4 min-w-[180px]">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-ink">
                                  {client.points} / {program.pointsRequired} pts
                                </span>
                                <span className="text-ink-muted">{client.progress}%</span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-border-subtle overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    client.canRedeem ? "bg-emerald-500" : "bg-accent"
                                  }`}
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      Math.max(5, (client.points / program.pointsRequired) * 100),
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-bold text-sm text-ink">{client.points} pts</span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-ink-secondary">
                            {client.totalRedeemed} resgate(s)
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                addPoints(client.id, 1);
                                toast.success(`+1 Ponto para ${client.name}!`);
                              }}
                              className="rounded-lg border border-border-subtle bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:border-accent transition-colors"
                              title="Adicionar 1 Ponto"
                            >
                              +1 Ponto
                            </button>

                            <button
                              type="button"
                              disabled={!client.canRedeem}
                              onClick={() => {
                                redeemReward(client.id);
                                toast.success(
                                  `Prêmio resgatado para ${client.name}: ${program.rewardDescription}!`,
                                );
                              }}
                              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-xs"
                              title={
                                client.canRedeem
                                  ? "Resgatar Recompensa"
                                  : `Necessário ${program.pointsRequired} pontos`
                              }
                            >
                              Resgatar Prêmio
                            </button>

                            <Link
                              href={`/owner/clients/${client.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface px-2 py-1 text-xs font-semibold text-ink hover:border-accent transition-colors"
                            >
                              <ExternalLink size={12} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Aba 2: Resgatados */}
        {activeTab === "redemptions" && (
          <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
            {redemptions.length === 0 ? (
              <div className="py-16 text-center text-xs text-ink-muted">
                Nenhum prêmio foi resgatado ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                    <tr>
                      <th className="py-3 px-4">Data do Resgate</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Prêmio Entregue</th>
                      <th className="py-3 px-4">Pontos Baixados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {redemptions.map((red) => {
                      const client = clientsMap.get(red.clientId);
                      const dt = formatDateTimeInTimezone(red.date, timezone, locale);

                      return (
                        <tr key={red.id} className="hover:bg-canvas/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-ink whitespace-nowrap">
                            {dt}
                          </td>
                          <td className="py-3 px-4">
                            {client ? (
                              <Link
                                href={`/owner/clients/${client.id}`}
                                className="font-semibold text-ink hover:text-accent hover:underline"
                              >
                                {client.name}
                              </Link>
                            ) : (
                              <span className="font-semibold text-ink">Cliente #{red.clientId}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                            {red.reward}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-rose-500 font-semibold">
                            -{red.pointsDeducted} pontos
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Configuração do Programa */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <Settings size={18} className="text-accent" />
                Configurar Cartela de Fidelidade
              </h3>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="text-ink-muted hover:text-ink transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-ink-secondary mb-1">
                  Nome do Programa
                </label>
                <input
                  type="text"
                  required
                  value={programForm.name}
                  onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-secondary mb-1">
                    Pontos para Resgate
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={programForm.pointsRequired}
                    onChange={(e) =>
                      setProgramForm({ ...programForm, pointsRequired: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-ink-secondary mb-1">
                    Validade em Dias
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={730}
                    required
                    value={programForm.validityDays}
                    onChange={(e) =>
                      setProgramForm({ ...programForm, validityDays: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink-secondary mb-1">
                  Descrição da Premiação / Recompensa
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 1 Corte de Cabelo ou Hidratação Grátis"
                  value={programForm.rewardDescription}
                  onChange={(e) =>
                    setProgramForm({ ...programForm, rewardDescription: e.target.value })
                  }
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={programForm.autoPointOnCompletion}
                    onChange={(e) =>
                      setProgramForm({ ...programForm, autoPointOnCompletion: e.target.checked })
                    }
                    className="rounded border-border-subtle accent-accent size-4"
                  />
                  <span className="font-medium text-ink">
                    Pontuar automaticamente (+1 ponto) ao concluir atendimento
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setSettingsModalOpen(false)}
                  className="rounded-xl border border-border-subtle px-4 py-2 text-xs font-semibold text-ink hover:bg-canvas transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors"
                >
                  Salvar Regras
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
