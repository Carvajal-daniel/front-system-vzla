"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Power,
  Trash2,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api-client";
import {
  formatPercentage,
  formatPhoneToE164,
  isValidInternationalPhone,
  stripNonDigits,
} from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type { PhoneCountryCode } from "@/lib/types/public-booking";
import type {
  Service,
  ServiceCollaboratorsResponse,
} from "@/lib/types/service";
import type {
  Collaborator,
  CollaboratorsListResponse,
  CreateCollaboratorPayload,
} from "@/lib/types/team";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { PhoneInput } from "@/components/ui/phone-input";
import { StatusBadge } from "@/components/ui/status-badge";

interface GeneratedInvite {
  name: string;
  email: string;
  phoneE164: string;
  tempPassword: string;
  loginUrl: string;
}

/**
 * Gera senha temporária forte (12 caracteres, garantindo maiúscula, minúscula,
 * dígito e caractere especial) compatível com a validação 6..15 chars do backend.
 */
function generateStrongTemporaryPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;

  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);

  const chars = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    special[bytes[3] % special.length],
  ];

  for (let i = 4; i < 12; i++) {
    chars.push(all[bytes[i] % all.length]);
  }

  return chars.join("");
}

export function TeamPanel() {
  const { session } = useSession();
  const { locale, t } = useLocale();

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState<PhoneCountryCode>("+55");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [commissionPercentage, setCommissionPercentage] = useState("40");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal de Convite Gerado
  const [invite, setInvite] = useState<GeneratedInvite | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Modal de Confirmação de Exclusão com Transferência
  const [deleteTarget, setDeleteTarget] = useState<Collaborator | null>(null);
  const [transferToId, setTransferToId] = useState<string>("");
  const [hasAppointmentConflict, setHasAppointmentConflict] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Novo Colaborador: serviços selecionados na criação
  const [createServices, setCreateServices] = useState<Service[]>([]);
  const [selectedServiceIdsForNew, setSelectedServiceIdsForNew] = useState<Set<string>>(
    () => new Set(),
  );

  // Drawer de Edição de Colaborador (nome, especialidade, comissão e serviços vinculados)
  const [editTarget, setEditTarget] = useState<Collaborator | null>(null);
  const [editName, setEditName] = useState("");
  const [editSpecialty, setEditSpecialty] = useState("");
  const [editCommission, setEditCommission] = useState("40");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [linkedServiceIds, setLinkedServiceIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [servicesLoading, setServicesLoading] = useState(false);
  const [togglingServiceId, setTogglingServiceId] = useState<string | null>(
    null,
  );

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<CollaboratorsListResponse>("/collaborators", {
        auth: true,
      });
      setCollaborators(res.collaborators ?? []);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t.errors.networkDescription,
      );
    } finally {
      setLoading(false);
    }
  }, [t.errors.networkDescription]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await apiRequest<CollaboratorsListResponse>(
          "/collaborators",
          { auth: true },
        );
        if (!active) return;
        setCollaborators(res.collaborators ?? []);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof ApiError ? err.message : t.errors.networkDescription,
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [t.errors.networkDescription]);

  const openNewCollaboratorModal = async () => {
    setDrawerOpen(true);
    setFormError(null);
    try {
      const res = await apiRequest<Service[] | { services?: Service[] }>("/services", {
        auth: true,
      });
      const list = Array.isArray(res) ? res : (res.services ?? []);
      setCreateServices(list.filter((s) => s.active));
      // Por padrão seleciona todos os serviços ativos da barbearia
      setSelectedServiceIdsForNew(new Set(list.filter((s) => s.active).map((s) => s.id)));
    } catch {
      // Ignora erro de serviços na abertura
    }
  };

  const kpis = useMemo(() => {
    const total = collaborators.length;
    const activeCount = collaborators.filter((c) => c.isActive).length;
    return { total, activeCount, inactiveCount: total - activeCount };
  }, [collaborators]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!isValidInternationalPhone(countryCode, phoneDigits)) {
      setFormError(t.errors.invalidPhone);
      return;
    }

    setSubmitting(true);
    const tempPassword = generateStrongTemporaryPassword();
    const phoneE164 = formatPhoneToE164(countryCode, phoneDigits);

    const payload: CreateCollaboratorPayload = {
      name: name.trim(),
      email: email.trim(),
      password: tempPassword,
      phone: phoneE164,
      specialty: specialty.trim(),
      commissionPercentage: Number(commissionPercentage) || 0,
    };

    try {
      const created = await apiRequest<Collaborator>("/collaborators", {
        method: "POST",
        auth: true,
        body: payload,
      });

      // Vincula os serviços selecionados na criação
      if (created?.id && selectedServiceIdsForNew.size > 0) {
        await Promise.allSettled(
          Array.from(selectedServiceIdsForNew).map((svcId) =>
            apiRequest(`/services/${encodeURIComponent(svcId)}/collaborators`, {
              method: "POST",
              auth: true,
              body: {
                collaboratorId: created.id,
                commissionPercentage: payload.commissionPercentage,
              },
            }),
          ),
        );
      }

      const loginUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : "/login";

      setInvite({
        name: payload.name,
        email: payload.email,
        phoneE164,
        tempPassword,
        loginUrl,
      });
      setInviteCopied(false);
      setDrawerOpen(false);
      setName("");
      setEmail("");
      setPhoneDigits("");
      setSpecialty("");
      setCommissionPercentage("40");
      void loadTeam();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const buildInviteText = (data: GeneratedInvite) => {
    if (locale === "es") {
      return `¡Hola ${data.name}! Te invitamos al portal de ${session.company.companyName}.\nAcceso: ${data.loginUrl}\nCorreo: ${data.email}\nContraseña temporal: ${data.tempPassword}`;
    }
    return `Olá ${data.name}! Você foi convidado(a) para o portal de ${session.company.companyName}.\nAcesso: ${data.loginUrl}\nE-mail: ${data.email}\nSenha temporária: ${data.tempPassword}`;
  };

  const handleCopyInvite = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(buildInviteText(invite));
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2500);
    } catch {
      // Fallback silencioso
    }
  };

  const handleToggleStatus = async (collab: Collaborator) => {
    setTogglingId(collab.id);
    try {
      const updated = await apiRequest<Collaborator>(
        `/collaborators/${encodeURIComponent(collab.id)}/status`,
        {
          method: "PATCH",
          auth: true,
          body: { isActive: !collab.isActive },
        },
      );
      setCollaborators((prev) =>
        prev.map((item) => (item.id === collab.id ? updated : item)),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setTogglingId(null);
    }
  };

  const openEditDrawer = (collab: Collaborator) => {
    setEditTarget(collab);
    setEditName(collab.name);
    setEditSpecialty(collab.specialty);
    setEditCommission(String(collab.commissionPercentage));
    setEditError(null);
    setServicesLoading(true);
    setLinkedServiceIds(new Set());

    // Carrega os serviços da empresa e identifica quais estão vinculados a este colaborador
    void (async () => {
      try {
        const res = await apiRequest<Service[] | { services?: Service[] }>(
          "/services",
          { auth: true },
        );
        const list = Array.isArray(res) ? res : (res.services ?? []);
        setAllServices(list);
        const linked = new Set<string>();
        await Promise.all(
          list.map(async (svc) => {
            try {
              const sc = await apiRequest<ServiceCollaboratorsResponse>(
                `/services/${encodeURIComponent(svc.id)}/collaborators`,
                { auth: true },
              );
              if (
                (sc.collaborators ?? []).some(
                  (item) => item.collaboratorId === collab.id,
                )
              ) {
                linked.add(svc.id);
              }
            } catch {
              // Ignora erro individual de vínculo
            }
          }),
        );
        setLinkedServiceIds(linked);
      } catch {
        // Mantém a edição de dados básicos funcional mesmo se falhar o carregamento dos serviços
      } finally {
        setServicesLoading(false);
      }
    })();
  };

  const handleToggleCollaboratorService = async (serviceId: string) => {
    if (!editTarget) return;
    setTogglingServiceId(serviceId);
    setEditError(null);
    const isLinked = linkedServiceIds.has(serviceId);
    try {
      if (isLinked) {
        await apiRequest(
          `/services/${encodeURIComponent(serviceId)}/collaborators/${encodeURIComponent(editTarget.id)}`,
          { method: "DELETE", auth: true },
        );
        setLinkedServiceIds((prev) => {
          const next = new Set(prev);
          next.delete(serviceId);
          return next;
        });
      } else {
        await apiRequest(
          `/services/${encodeURIComponent(serviceId)}/collaborators`,
          {
            method: "POST",
            auth: true,
            body: {
              collaboratorId: editTarget.id,
              commissionPercentage:
                Number(editCommission) || editTarget.commissionPercentage || 0,
            },
          },
        );
        setLinkedServiceIds((prev) => new Set(prev).add(serviceId));
      }
    } catch (err) {
      setEditError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setTogglingServiceId(null);
    }
  };

  const handleSaveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await apiRequest<Collaborator>(
        `/collaborators/${encodeURIComponent(editTarget.id)}`,
        {
          method: "PATCH",
          auth: true,
          body: {
            name: editName.trim(),
            specialty: editSpecialty.trim(),
            commissionPercentage: Number(editCommission) || 0,
          },
        },
      );
      setCollaborators((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      setEditTarget(null);
    } catch (err) {
      setEditError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setEditSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const url = transferToId
        ? `/collaborators/${encodeURIComponent(deleteTarget.id)}?transferToCollaboratorId=${encodeURIComponent(transferToId)}`
        : `/collaborators/${encodeURIComponent(deleteTarget.id)}`;

      await apiRequest<void>(url, { method: "DELETE", auth: true });
      setCollaborators((prev) =>
        prev.filter((item) => item.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
      setTransferToId("");
      setHasAppointmentConflict(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setHasAppointmentConflict(true);
        setDeleteError(t.common.transferAppointmentsNotice);
      } else {
        setDeleteError(
          err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
        );
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card-interactive rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">
              {t.owner.teamTitle}
            </span>
            <Users className="h-4 w-4 text-accent" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-ink tabular-nums">
            {kpis.total}
          </p>
        </div>

        <div className="card-interactive rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">
              {t.common.active}
            </span>
            <UserCheck
              className="h-4 w-4 text-[var(--status-success-ink)]"
              aria-hidden="true"
            />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-ink tabular-nums">
            {kpis.activeCount}
          </p>
        </div>

        <div className="card-interactive rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">
              {t.common.inactive}
            </span>
            <UserX className="h-4 w-4 text-ink-muted" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-ink tabular-nums">
            {kpis.inactiveCount}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title-sm font-bold text-ink">
          {t.owner.teamTitle}
        </h2>
        <Button
          type="button"
          onClick={() => void openNewCollaboratorModal()}
          className="min-h-11 rounded-full bg-accent px-5 text-accent-ink hover:bg-accent-hover cursor-pointer"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t.owner.newCollaborator}
        </Button>
      </div>

      {loading ? (
        <CardListSkeleton count={3} />
      ) : error ? (
        <ErrorState
          title={t.errors.networkTitle}
          description={error}
          retryLabel={t.common.retry}
          onRetry={() => void loadTeam()}
        />
      ) : collaborators.length === 0 ? (
        <EmptyState
          title={t.common.noData}
          description={t.owner.teamTitle}
          icon={<Users className="h-6 w-6" aria-hidden="true" />}
          action={
            <Button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="min-h-11 rounded-full bg-accent px-5 text-accent-ink hover:bg-accent-hover cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t.owner.newCollaborator}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {collaborators.map((collab) => (
            <article
              key={collab.id}
              className="card-interactive flex flex-col justify-between gap-4 rounded-2xl border border-border-subtle bg-surface p-5"
            >
              <div className="space-y-2.5 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {collab.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={collab.avatarUrl}
                        alt={collab.name}
                        className="h-11 w-11 shrink-0 rounded-full object-cover border border-border-subtle shadow-xs"
                      />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                        {collab.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-ink truncate">
                        {collab.name}
                      </h3>
                      <p className="text-xs text-ink-secondary truncate">
                        {collab.specialty}
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    tone={collab.isActive ? "success" : "neutral"}
                    label={collab.isActive ? t.common.active : t.common.inactive}
                  />
                </div>
                <p className="text-xs text-ink-muted truncate">{collab.email}</p>
                <p className="font-mono text-xs text-ink-secondary tabular-nums">
                  {collab.phone} ·{" "}
                  <strong className="text-ink">
                    {formatPercentage(collab.commissionPercentage, locale)}
                  </strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openEditDrawer(collab)}
                  className="min-h-11 rounded-xl px-3.5 text-xs cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.common.edit}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={togglingId === collab.id}
                  onClick={() => void handleToggleStatus(collab)}
                  className="min-h-11 flex-1 rounded-xl text-xs cursor-pointer"
                >
                  {togglingId === collab.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Power className="h-4 w-4" aria-hidden="true" />
                  )}
                  {collab.isActive ? t.common.inactive : t.common.active}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={t.common.delete}
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteTarget(collab);
                  }}
                  className="min-h-11 rounded-xl border-[var(--status-danger-border)] px-3 text-[var(--status-danger-ink)] hover:bg-[var(--status-danger-bg)] cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal: Novo Colaborador */}
      <Modal
        open={drawerOpen}
        title={t.owner.newCollaborator}
        maxWidth="max-w-xl"
        onClose={() => setDrawerOpen(false)}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="collab-name">{t.auth.nameLabel}</Label>
            <Input
              id="collab-name"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="collab-email">{t.auth.emailLabel}</Label>
            <Input
              id="collab-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5"
            />
          </div>

          <PhoneInput
            id="collab-phone"
            label={t.auth.phoneLabel}
            countryCode={countryCode}
            value={phoneDigits}
            onCountryCodeChange={setCountryCode}
            onChange={setPhoneDigits}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="collab-specialty">{t.common.specialty}</Label>
              <Input
                id="collab-specialty"
                required
                minLength={1}
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="collab-commission">
                {t.owner.commissions} (%)
              </Label>
              <Input
                id="collab-commission"
                type="number"
                min={0}
                max={100}
                step="0.5"
                required
                value={commissionPercentage}
                onChange={(e) => setCommissionPercentage(e.target.value)}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5 tabular-nums"
              />
            </div>
          </div>

          {/* Vínculo de Serviços na Criação */}
          {createServices.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border-subtle bg-subtle/50 p-3.5">
              <Label className="text-xs font-bold text-ink">
                {t.common.manageServices} ({t.common.all})
              </Label>
              <div className="grid gap-2 max-h-40 overflow-y-auto pr-1">
                {createServices.map((svc) => {
                  const isChecked = selectedServiceIdsForNew.has(svc.id);
                  return (
                    <label
                      key={svc.id}
                      className="flex items-center gap-2.5 rounded-lg bg-surface px-3 py-2 text-xs font-medium text-ink cursor-pointer border border-border-subtle hover:border-border-strong transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = new Set(selectedServiceIdsForNew);
                          if (e.target.checked) next.add(svc.id);
                          else next.delete(svc.id);
                          setSelectedServiceIdsForNew(next);
                        }}
                        className="h-4 w-4 rounded border-border-strong accent-[var(--accent)]"
                      />
                      <span className="truncate flex-1">{svc.name}</span>
                      <span className="text-[11px] text-ink-muted tabular-nums">
                        {svc.durationMinutes} min
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {formError && (
            <p
              role="alert"
              className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger-ink)]"
            >
              {formError}
            </p>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="min-h-11 w-full rounded-full bg-accent text-accent-ink hover:bg-accent-hover cursor-pointer"
          >
            {submitting && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {t.common.save}
          </Button>
        </form>
      </Modal>

      {/* Modal: Convite Gerado */}
      <Modal
        open={Boolean(invite)}
        title={t.owner.inviteTitle}
        onClose={() => setInvite(null)}
      >
        {invite && (
          <div className="space-y-4">
            <p className="text-sm text-ink-secondary">
              {t.owner.inviteSubtitle}
            </p>

            <div className="rounded-xl border border-border-subtle bg-subtle p-4 space-y-2 text-xs">
              <div>
                <p className="text-ink-muted">{t.auth.emailLabel}</p>
                <p className="font-mono font-semibold text-ink break-all">
                  {invite.email}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">{t.owner.tempPasswordLabel}</p>
                <p className="font-mono text-sm font-bold text-accent select-all">
                  {invite.tempPassword}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">{t.owner.loginLinkLabel}</p>
                <p className="font-mono text-ink break-all">{invite.loginUrl}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <Button
                type="button"
                onClick={() => void handleCopyInvite()}
                className="min-h-11 flex-1 rounded-full bg-accent text-accent-ink hover:bg-accent-hover cursor-pointer"
              >
                {inviteCopied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {inviteCopied ? t.common.copied : t.owner.copyInvite}
              </Button>

              <a
                href={`https://wa.me/${stripNonDigits(invite.phoneE164)}?text=${encodeURIComponent(buildInviteText(invite))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-subtle"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {t.owner.sendWhatsApp}
              </a>
            </div>
          </div>
        )}
      </Modal>
      {/* Modal: Editar Colaborador */}
      <Modal
        open={Boolean(editTarget)}
        title={t.common.editCollaborator}
        maxWidth="max-w-xl"
        onClose={() => setEditTarget(null)}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-collab-name">{t.auth.nameLabel}</Label>
            <Input
              id="edit-collab-name"
              required
              minLength={2}
              maxLength={80}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-collab-specialty">{t.common.specialty}</Label>
              <Input
                id="edit-collab-specialty"
                required
                minLength={1}
                value={editSpecialty}
                onChange={(e) => setEditSpecialty(e.target.value)}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-collab-commission">
                {t.owner.commissions} (%)
              </Label>
              <Input
                id="edit-collab-commission"
                type="number"
                min={0}
                max={100}
                step="0.5"
                required
                value={editCommission}
                onChange={(e) => setEditCommission(e.target.value)}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5 tabular-nums"
              />
            </div>
          </div>

          {editError && (
            <p
              role="alert"
              className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger-ink)]"
            >
              {editError}
            </p>
          )}

          <Button
            type="submit"
            disabled={editSaving}
            className="min-h-11 w-full rounded-full bg-accent text-accent-ink hover:bg-accent-hover cursor-pointer"
          >
            {editSaving && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {t.common.save}
          </Button>
        </form>

        {/* Serviços habilitados para este colaborador */}
        <div className="mt-6 border-t border-border-subtle pt-5 space-y-3">
          <h3 className="text-sm font-bold text-ink">
            {t.common.manageServices}
          </h3>
          {servicesLoading ? (
            <div className="flex items-center gap-2 text-xs text-ink-muted py-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t.common.loading}
            </div>
          ) : allServices.length === 0 ? (
            <p className="text-xs text-ink-muted">{t.common.noData}</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {allServices.map((svc) => {
                const checked = linkedServiceIds.has(svc.id);
                const busy = togglingServiceId === svc.id;
                return (
                  <li
                    key={svc.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-subtle px-3.5 py-2.5"
                  >
                    <label
                      htmlFor={`edit-svc-${svc.id}`}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm font-medium text-ink"
                    >
                      <input
                        id={`edit-svc-${svc.id}`}
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={() =>
                          void handleToggleCollaboratorService(svc.id)
                        }
                        className="h-4 w-4 rounded border-border-strong accent-[var(--accent)]"
                      />
                      <span className="truncate">{svc.name}</span>
                    </label>
                    {busy && (
                      <Loader2
                        className="h-3.5 w-3.5 shrink-0 animate-spin text-accent"
                        aria-hidden="true"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>

      {/* Modal: Confirmar Exclusão de Colaborador */}
      <Modal
        open={Boolean(deleteTarget)}
        title={t.common.confirmDeleteTitle}
        onClose={() => {
          setDeleteTarget(null);
          setTransferToId("");
          setHasAppointmentConflict(false);
          setDeleteError(null);
        }}
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-ink-secondary">
              {t.common.confirmDeleteCollaborator}
            </p>
            <p className="rounded-xl bg-subtle px-3.5 py-2.5 text-sm font-semibold text-ink">
              {deleteTarget.name} ({deleteTarget.specialty})
            </p>

            {/* Seletor de transferência de agendamentos */}
            {collaborators.filter((c) => c.id !== deleteTarget.id && c.isActive).length > 0 && (
              <div
                className={[
                  "space-y-2 rounded-xl border bg-subtle/60 p-3.5 transition-all",
                  hasAppointmentConflict
                    ? "border-amber-500/60 ring-2 ring-amber-500/20"
                    : "border-border-subtle",
                ].join(" ")}
              >
                <Label htmlFor="transfer-collab-select" className="text-xs font-bold text-ink">
                  {t.common.transferToSelectLabel}
                </Label>
                <select
                  id="transfer-collab-select"
                  value={transferToId}
                  onChange={(e) => {
                    setTransferToId(e.target.value);
                    setDeleteError(null);
                  }}
                  className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-xs text-ink cursor-pointer"
                >
                  <option value="">{t.common.all} ({t.common.delete})</option>
                  {collaborators
                    .filter((c) => c.id !== deleteTarget.id && c.isActive)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.specialty})
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-ink-muted">
                  {t.common.transferAppointmentsNotice}
                </p>
              </div>
            )}

            {deleteError && (
              <p
                role="alert"
                className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger-ink)]"
              >
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteTarget(null);
                  setTransferToId("");
                  setHasAppointmentConflict(false);
                  setDeleteError(null);
                }}
                className="min-h-11 rounded-full px-5 cursor-pointer"
              >
                {t.common.cancel}
              </Button>
              <Button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDelete()}
                className="min-h-11 rounded-full bg-[var(--status-danger-ink)] px-5 text-white hover:opacity-90 cursor-pointer"
              >
                {deleting && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                {transferToId
                  ? t.common.transferAndDeleteAction
                  : t.common.delete}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
