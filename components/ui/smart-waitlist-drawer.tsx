"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Timer,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import {
  operationsApi,
  type BackendClientOption,
  type SmartWaitlistEntry,
  type WaitlistShift,
  type WaitlistStatus,
} from "@/lib/operations-api";
import type { AgendaPerson } from "./agenda-controls";
import { SlideOverDrawer } from "./slide-over-drawer";

const SHIFT_OPTIONS: Array<{ value: WaitlistShift; label: string }> = [
  { value: "ANY", label: "Qualquer turno" },
  { value: "MORNING", label: "Manhã" },
  { value: "AFTERNOON", label: "Tarde" },
  { value: "EVENING", label: "Noite" },
];

const STATUS_FILTER_OPTIONS: Array<{ value: WaitlistStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "WAITING", label: "Aguardando" },
  { value: "NOTIFIED", label: "Notificados" },
  { value: "CONVERTED", label: "Convertidos" },
  { value: "EXPIRED", label: "Expirados" },
];

function shiftLabel(shift: WaitlistShift): string {
  return SHIFT_OPTIONS.find((item) => item.value === shift)?.label ?? shift;
}

function formatCountdown(expiresAtIso: string | null, nowMs: number): string | null {
  if (!expiresAtIso) return null;
  const remainingMs = Date.parse(expiresAtIso) - nowMs;
  if (!Number.isFinite(remainingMs)) return null;
  if (remainingMs <= 0) return "00:00";
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export interface SmartWaitlistDrawerProps {
  open: boolean;
  date: string;
  collaborators: AgendaPerson[];
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

/**
 * Drawer lateral da Fila de Espera Inteligente conectada ao backend (GET/POST /waitlist).
 * Exibe status em tempo real com contador da janela de 20 minutos para clientes notificados.
 */
export function SmartWaitlistDrawer({
  open,
  date,
  collaborators,
  onClose,
  onCountChange,
}: SmartWaitlistDrawerProps) {
  const [entries, setEntries] = useState<SmartWaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<WaitlistStatus | "ALL">("ALL");

  // Formulário de cadastro
  const [showForm, setShowForm] = useState(false);
  const [clients, setClients] = useState<BackendClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState("");
  const [preferredShift, setPreferredShift] = useState<WaitlistShift>("ANY");
  const [desiredDate, setDesiredDate] = useState(date);
  const [submitting, setSubmitting] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setDesiredDate(date);
  }, [date]);

  const loadEntries = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const result = await operationsApi.listWaitlist({ date }, signal);
        if (signal?.aborted) return;
        setEntries(result.entries);
        const activeCount = result.entries.filter(
          (item) => item.status === "WAITING" || item.status === "NOTIFIED",
        ).length;
        onCountChange?.(activeCount);
      } catch (err) {
        if (signal?.aborted) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar a fila de espera.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [date, onCountChange],
  );

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void loadEntries(controller.signal);
    return () => controller.abort();
  }, [open, loadEntries]);

  useEffect(() => {
    if (!open || !showForm) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setClientsLoading(true);
      void operationsApi
        .listClients(clientSearch, controller.signal)
        .then(({ clients: rows }) => {
          if (!controller.signal.aborted) setClients(rows);
        })
        .catch(() => {
          // Mantém lista atual se a busca falhar
        })
        .finally(() => {
          if (!controller.signal.aborted) setClientsLoading(false);
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, showForm, clientSearch]);

  // Atualiza contador regressivo da janela de 20 min enquanto houver itens NOTIFIED
  const hasNotified = useMemo(
    () => entries.some((item) => item.status === "NOTIFIED" && item.expiresAt),
    [entries],
  );

  useEffect(() => {
    if (!open || !hasNotified) return;
    setNowMs(Date.now());
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [open, hasNotified]);

  const visibleEntries = useMemo(() => {
    if (statusFilter === "ALL") return entries;
    return entries.filter((item) => item.status === statusFilter);
  }, [entries, statusFilter]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClientId || submitting) return;
    setSubmitting(true);
    try {
      await operationsApi.addWaitlistEntry({
        clientId: selectedClientId,
        collaboratorId: selectedCollaboratorId || null,
        desiredDate,
        preferredShift,
      });
      toast.success("Cliente adicionado à Fila de Espera Inteligente.");
      setSelectedClientId("");
      setSelectedCollaboratorId("");
      setPreferredShift("ANY");
      setShowForm(false);
      await loadEntries();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Não foi possível cadastrar na fila de espera.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SlideOverDrawer
      open={open}
      title="Fila de Espera Inteligente"
      description={`Encaixes automáticos para ${date}. Quando um horário abre, o cliente compatível recebe oferta via WhatsApp com janela de 20 min.`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-ink shadow-xs transition-colors hover:bg-accent-hover"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {showForm ? "Fechar cadastro" : "Adicionar cliente"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => void loadEntries()}
            aria-label="Atualizar fila de espera"
            className="grid size-9 cursor-pointer place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary transition-colors hover:border-accent hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl border border-accent/30 bg-accent/5 p-3.5"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
              <UserPlus className="size-3.5 text-accent" aria-hidden="true" />
              <span>Novo cliente na fila</span>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="waitlist-client-search"
                className="block text-[11px] font-semibold text-ink-secondary"
              >
                Buscar cliente cadastrado
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  id="waitlist-client-search"
                  type="text"
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                  placeholder="Nome ou telefone…"
                  className="min-h-9 w-full rounded-xl border border-border-subtle bg-surface pl-8 pr-3 text-xs text-ink outline-none focus-visible:border-accent"
                />
              </div>

              <select
                required
                aria-label="Selecionar cliente"
                value={selectedClientId}
                onChange={(event) => setSelectedClientId(event.target.value)}
                className="min-h-10 w-full cursor-pointer rounded-xl border border-border-subtle bg-surface px-3 text-xs text-ink outline-none focus-visible:border-accent"
              >
                <option value="">
                  {clientsLoading
                    ? "Carregando clientes…"
                    : clients.length === 0
                      ? "Nenhum cliente encontrado"
                      : "Selecione o cliente"}
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} · {client.phone}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="space-y-1 text-[11px] font-semibold text-ink-secondary">
                <span>Profissional</span>
                <select
                  value={selectedCollaboratorId}
                  onChange={(event) => setSelectedCollaboratorId(event.target.value)}
                  className="min-h-10 w-full cursor-pointer rounded-xl border border-border-subtle bg-surface px-3 text-xs font-normal text-ink outline-none focus-visible:border-accent"
                >
                  <option value="">Qualquer profissional</option>
                  {collaborators.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-[11px] font-semibold text-ink-secondary">
                <span>Data desejada</span>
                <input
                  type="date"
                  required
                  value={desiredDate}
                  onChange={(event) => setDesiredDate(event.target.value)}
                  className="min-h-10 w-full cursor-pointer rounded-xl border border-border-subtle bg-surface px-3 text-xs font-normal text-ink outline-none focus-visible:border-accent"
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <span className="block text-[11px] font-semibold text-ink-secondary">
                Turno preferencial
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {SHIFT_OPTIONS.map((option) => {
                  const active = preferredShift === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPreferredShift(option.value)}
                      className={`min-h-8 cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? "border-accent bg-accent text-accent-ink"
                          : "border-border-subtle bg-surface text-ink-secondary hover:border-accent hover:text-ink"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowForm(false)}
                className="min-h-9 cursor-pointer rounded-xl border border-border-subtle bg-surface px-3 text-xs font-semibold text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedClientId}
                className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-3.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 className="size-3.5 animate-spin" />}
                Salvar na fila
              </button>
            </div>
          </form>
        )}

        {/* Filtros de status */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTER_OPTIONS.map((option) => {
            const active = statusFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-border-subtle bg-surface text-ink-secondary hover:border-accent hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-medium text-rose-600 dark:text-rose-400"
          >
            {error}
          </p>
        )}

        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-xs text-ink-muted">
            <Loader2 className="size-5 animate-spin text-accent" />
          </div>
        ) : visibleEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-subtle py-10 text-center">
            <Users className="size-6 text-ink-muted" aria-hidden="true" />
            <p className="text-xs font-medium text-ink-secondary">
              Nenhum cliente nesta fila para {date}.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {visibleEntries.map((entry) => {
              const countdown =
                entry.status === "NOTIFIED"
                  ? formatCountdown(entry.expiresAt, nowMs)
                  : null;

              const statusBadge =
                entry.status === "WAITING"
                  ? {
                      label: "Aguardando",
                      className:
                        "border-amber-500/35 bg-amber-500/12 text-amber-700 dark:text-amber-300",
                      Icon: Clock3,
                    }
                  : entry.status === "NOTIFIED"
                    ? {
                        label: countdown
                          ? `Notificado · ${countdown}`
                          : "Notificado (20m)",
                        className:
                          "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                        Icon: Timer,
                      }
                    : entry.status === "CONVERTED"
                      ? {
                          label: "Convertido",
                          className:
                            "border-sky-500/35 bg-sky-500/12 text-sky-700 dark:text-sky-300",
                          Icon: CheckCircle2,
                        }
                      : {
                          label: "Expirado",
                          className:
                            "border-border-subtle bg-subtle text-ink-muted",
                          Icon: XCircle,
                        };

              const StatusIcon = statusBadge.Icon;

              return (
                <li
                  key={entry.id}
                  className="space-y-2 rounded-xl border border-border-subtle bg-canvas/45 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink">
                        {entry.clientName}
                      </p>
                      <p className="font-mono text-[11px] text-ink-muted">
                        {entry.clientPhone}
                      </p>
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums ${statusBadge.className}`}
                    >
                      <StatusIcon
                        className={`size-3 ${entry.status === "NOTIFIED" ? "motion-safe:animate-pulse" : ""}`}
                        aria-hidden="true"
                      />
                      {statusBadge.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-secondary">
                    <span className="rounded-md bg-surface px-2 py-0.5 border border-border-subtle/70">
                      {entry.collaboratorName || "Qualquer profissional"}
                    </span>
                    <span className="rounded-md bg-surface px-2 py-0.5 border border-border-subtle/70">
                      Turno: {shiftLabel(entry.preferredShift)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SlideOverDrawer>
  );
}
