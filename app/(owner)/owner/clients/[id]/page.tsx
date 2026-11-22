"use client";

import { ClientProfileFields } from "../../../_components/client-profile-fields";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  ExternalLink,
  Flame,
  Gift,
  History,
  Loader2,
  MessageCircle,
  Plus,
  Save,
  ShieldAlert,
  Sparkles,
  User,
  UserCheck,
  UserX,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeInTimezone, formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import { useClients } from "@/lib/use-clients";
import { useLoyalty } from "@/lib/use-loyalty";
import { AgendaStatusBadge } from "@/components/ui/agenda-status";

function getClientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const clientId = decodeURIComponent(rawId);

  const { session } = useSession();
  const { locale, t } = useLocale();
  const timezone = session.company.timezone;
  const currency = session.company.currency ?? "BRL";
  const companyId = session.company.id;

  const { getClient, saveClientDetails, toggleBlockClient, updateAnamnesis, loading } =
    useClients(companyId);
  const { program, getClientLoyalty, addPoints, redeemReward } = useLoyalty(companyId);

  const client = getClient(clientId);
  const loyalty = getClientLoyalty(clientId);

  const [activeTab, setActiveTab] = useState<"history" | "anamnesis" | "loyalty">("history");
  const [anamnesisText, setAnamnesisText] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    email: "",
    birthDate: "",
    document: "",
  });

  // Atualiza campos quando o cliente é carregado
  useEffect(() => {
    if (client) {
      setAnamnesisText(client.notes || "");
      setEditForm({
        name: client.name,
        phone: client.phone,
        email: client.email || "",
        birthDate: client.birthDate || "",
        document: client.document || "",
      });
    }
  }, [client]);

  // Salvar ficha / anamnese
  const handleSaveAnamnesis = () => {
    updateAnamnesis(clientId, anamnesisText);
    toast.success("Ficha de anamnese salva com sucesso!");
  };

  // Salvar dados cadastrais
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    saveClientDetails(clientId, {
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      email: editForm.email.trim() || undefined,
      birthDate: editForm.birthDate || undefined,
      document: editForm.document.trim() || undefined,
    });
    setEditModalOpen(false);
    toast.success("Dados do cliente atualizados com sucesso!");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-accent" />
        <p className="mt-3 text-xs text-ink-muted">Carregando ficha do cliente...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4 py-12 text-center">
        <h3 className="text-base font-bold text-ink">Cliente não encontrado</h3>
        <p className="text-xs text-ink-muted">
          O cliente solicitado não foi localizado na base da empresa.
        </p>
        <Link
          href="/owner/clients"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors"
        >
          <ArrowLeft size={14} />
          Voltar para Base de Clientes
        </Link>
      </div>
    );
  }

  const phoneDigits = client.phone.replace(/\D/g, "");
  const waLink = phoneDigits ? `https://wa.me/55${phoneDigits}` : null;
  const waDebtMessage = phoneDigits
    ? `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(
        `Olá ${client.name}! Notamos um saldo pendente de R$ ${(client.pendingDebtCents / 100).toFixed(2)} referente aos seus atendimentos no ${session.company.companyName}. Gostaria de acertar via PIX?`,
      )}`
    : null;

  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <div className="flex items-center justify-between">
        <Link
          href="/owner/clients"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink transition-colors"
        >
          <ArrowLeft size={14} />
          Voltar para Clientes
        </Link>
      </div>

      {/* Cartão de Identificação do Cliente */}
      <div className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-accent/15 text-xl font-bold text-accent shrink-0 shadow-inner">
              {getClientInitials(client.name)}
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-ink truncate">{client.name}</h1>
                {client.isBlocked ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-500">
                    <ShieldAlert size={12} />
                    Bloqueado para Agendamento
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <UserCheck size={12} />
                    Cliente Ativo
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                <span className="font-mono">{client.phone}</span>
                {client.email && <span>· {client.email}</span>}
                {client.birthDate && <span>· Nasc: {client.birthDate}</span>}
                {client.document && <span>· CPF / C.I.: {client.document}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-xs font-semibold text-ink hover:border-accent transition-colors cursor-pointer"
            >
              <Edit2 size={13} />
              Editar Dados
            </button>

            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                <MessageCircle size={14} />
                WhatsApp
              </a>
            )}

            <button
              type="button"
              onClick={() => {
                toggleBlockClient(clientId);
                toast.info(
                  client.isBlocked
                    ? "Cliente desbloqueado com sucesso!"
                    : "Cliente bloqueado para agendamentos online.",
                );
              }}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                client.isBlocked
                  ? "bg-slate-700 text-white hover:bg-slate-800"
                  : "border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
              }`}
            >
              <ShieldAlert size={14} />
              {client.isBlocked ? "Desbloquear Agendamento" : "Bloquear Agendamento"}
            </button>
          </div>
        </div>
      </div>

      {/* 5 KPIs de Resumo Financeiro e Visitas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
            Visitas Realizadas
          </span>
          <div className="mt-1 text-2xl font-bold text-ink">{client.totalVisits}</div>
          <p className="mt-0.5 text-[10px] text-ink-muted">Atendimentos concluídos</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
            Faltas / No-Show
          </span>
          <div className="mt-1 text-2xl font-bold text-ink">
            <span className={client.noShows > 0 ? "text-rose-500" : ""}>{client.noShows}</span>
          </div>
          <p className="mt-0.5 text-[10px] text-ink-muted">Ausências registradas</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
            Última Visita
          </span>
          <div className="mt-1 text-sm font-bold text-ink">
            {client.lastVisitAt
              ? formatDateTimeInTimezone(client.lastVisitAt, timezone, locale).split(" ")[0]
              : "Nunca visitou"}
          </div>
          <p className="mt-0.5 text-[10px] text-ink-muted">Data do último serviço</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
            Total Gasto
          </span>
          <div className="mt-1 text-xl font-bold text-accent">
            <SensitiveValue>
              {formatPriceFromCents(client.totalSpentCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-0.5 text-[10px] text-ink-muted">Faturamento histórico</p>
        </div>

        <div
          className={`rounded-2xl p-4 shadow-xs col-span-2 sm:col-span-1 border ${
            client.pendingDebtCents > 0
              ? "border-rose-500/30 bg-rose-500/5"
              : "border-border-subtle bg-surface"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wide ${
                client.pendingDebtCents > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-ink-muted"
              }`}
            >
              Saldo Devedor (Fiado)
            </span>
          </div>

          <div
            className={`mt-1 text-xl font-bold ${
              client.pendingDebtCents > 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-ink-muted"
            }`}
          >
            <SensitiveValue>
              {formatPriceFromCents(client.pendingDebtCents, locale, currency)}
            </SensitiveValue>
          </div>

          {client.pendingDebtCents > 0 && waDebtMessage && (
            <a
              href={waDebtMessage}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:underline"
            >
              <MessageCircle size={12} />
              Cobrar no WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* Abas Inferiores */}
      <div className="space-y-4">
        <div className="flex border-b border-border-subtle gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`pb-3 px-1 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "history"
                ? "border-b-2 border-accent text-accent"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <History size={14} />
            Histórico de Agendamentos ({client.appointments.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("anamnesis")}
            className={`pb-3 px-1 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "anamnesis"
                ? "border-b-2 border-accent text-accent"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Edit2 size={14} />
            Ficha Técnica / Anamnese
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("loyalty")}
            className={`pb-3 px-1 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "loyalty"
                ? "border-b-2 border-accent text-accent"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Gift size={14} />
            Programa de Fidelidade ({loyalty.points} pts)
          </button>
        </div>

        {/* Conteúdo Aba 1: Histórico de Agendamentos */}
        {activeTab === "history" && (
          <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
            {client.appointments.length === 0 ? (
              <div className="py-16 text-center text-xs text-ink-muted">
                Nenhum atendimento registrado para este cliente.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                    <tr>
                      <th className="py-3 px-4">Data e Hora</th>
                      <th className="py-3 px-4">Serviço</th>
                      <th className="py-3 px-4">Duração</th>
                      <th className="py-3 px-4">Valor</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Observações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {client.appointments.map((app) => (
                      <tr key={app.id} className="hover:bg-canvas/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-ink whitespace-nowrap">
                          {formatDateTimeInTimezone(app.startsAt, timezone, locale)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-ink">
                          {app.serviceNameSnapshot}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-ink-muted">
                          {app.serviceDurationMinutesSnapshot} min
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-bold text-ink">
                          <SensitiveValue>
                            {formatPriceFromCents(
                              app.servicePriceInCentsSnapshot,
                              locale,
                              currency,
                            )}
                          </SensitiveValue>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <AgendaStatusBadge
                            status={app.status}
                            label={t.status[app.status]}
                          />
                        </td>
                        <td className="py-3 px-4 text-ink-muted max-w-[200px] truncate">
                          {app.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Conteúdo Aba 2: Ficha Técnica / Anamnese */}
        {activeTab === "anamnesis" && (
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-ink">Anotações Técnicas e Anamnese</h3>
              <p className="text-xs text-ink-muted">
                Registre fórmulas de coloração, histórico de químicas, sensibilidades, alergias e
                preferências exclusivas deste cliente.
              </p>
            </div>

            <textarea
              rows={8}
              value={anamnesisText}
              onChange={(e) => setAnamnesisText(e.target.value)}
              placeholder="Ex: Utiliza tintura 6.1 com oxidante 20 volumes. Sensibilidade no couro cabeludo ao descolorante. Prefere café sem açúcar..."
              className="w-full rounded-xl border border-border-subtle bg-canvas/40 p-3.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveAnamnesis}
                className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors cursor-pointer shadow-xs"
              >
                <Save size={14} />
                Salvar Anamnese
              </button>
            </div>
          </div>
        )}

        {activeTab === "anamnesis" && <ClientProfileFields key={client.id} companyId={companyId} clientId={client.id} />}

        {/* Conteúdo Aba 3: Fidelidade */}
        {activeTab === "loyalty" && (
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-500" />
                  Cartela de Fidelidade — {program.name}
                </h3>
                <p className="text-xs text-ink-muted">
                  Meta para resgate: {program.pointsRequired} pontos · Prêmio:{" "}
                  <strong className="text-ink">{program.rewardDescription}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    addPoints(clientId, 1);
                    toast.success("+1 Ponto adicionado para o cliente!");
                  }}
                  className="flex items-center gap-1 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent transition-colors"
                >
                  <Plus size={13} />
                  +1 Ponto
                </button>

                <button
                  type="button"
                  disabled={loyalty.points < program.pointsRequired}
                  onClick={() => {
                    redeemReward(clientId);
                    toast.success("Prêmio resgatado com sucesso!");
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  <Gift size={13} />
                  Resgatar Prêmio
                </button>
              </div>
            </div>

            {/* Barra de Progresso da Cartela */}
            <div className="rounded-xl border border-border-subtle/80 bg-canvas/40 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">Progresso da Cartela</span>
                <span className="font-bold text-accent">
                  {loyalty.points} de {program.pointsRequired} pontos (
                  {Math.min(100, Math.round((loyalty.points / program.pointsRequired) * 100))}%)
                </span>
              </div>

              <div className="h-3 w-full rounded-full bg-border-subtle overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(5, (loyalty.points / program.pointsRequired) * 100),
                    )}%`,
                  }}
                />
              </div>

              {loyalty.points >= program.pointsRequired && (
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  🎉 Cartela completa! O cliente tem direito ao resgate de:{" "}
                  {program.rewardDescription}
                </p>
              )}
            </div>

            {/* Histórico de Pontuação do Cliente */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-ink-secondary">Histórico de Pontos e Resgates</h4>
              {loyalty.history.length === 0 ? (
                <p className="text-xs text-ink-muted">Nenhuma movimentação de pontos registrada.</p>
              ) : (
                <div className="space-y-1.5">
                  {loyalty.history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between rounded-xl border border-border-subtle/60 bg-canvas/30 px-3 py-2 text-xs"
                    >
                      <div>
                        <p className="font-medium text-ink">{h.note}</p>
                        <p className="text-[10px] text-ink-muted">
                          {formatDateTimeInTimezone(h.date, timezone, locale)}
                        </p>
                      </div>

                      <span
                        className={`font-bold ${
                          h.action === "REDEEMED"
                            ? "text-rose-500"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {h.action === "REDEEMED" ? `${h.amount} pts` : `+${h.amount} pts`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Edição de Dados */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <Edit2 size={16} className="text-accent" />
                Editar Dados do Cliente
              </h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-ink-muted hover:text-ink transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-ink-secondary mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink-secondary mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  required
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-secondary mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-secondary mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={editForm.birthDate}
                    onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink-secondary mb-1">CPF / C.I.</label>
                <input
                  type="text"
                  placeholder="000.000.000-00 ou V-12.345.678"
                  value={editForm.document}
                  onChange={(e) => setEditForm({ ...editForm, document: e.target.value })}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-xl border border-border-subtle px-4 py-2 text-xs font-semibold text-ink hover:bg-canvas transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
