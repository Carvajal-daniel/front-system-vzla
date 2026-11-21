"use client";

import { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import {
  getCollaboratorFutureAppointmentsCount,
  updateCollaboratorCredentials,
  updateCollaboratorStatus,
  type CollaboratorProfileDossier,
} from "@/lib/types/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeactivationModal } from "./deactivation-modal";

function generateStrongPassword(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const specials = "!@#$";
  const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
  return `${pick(letters)}${pick(letters)}${pick(digits)}${pick(letters)}${pick(digits)}${pick(specials)}${pick(letters)}${pick(digits)}`;
}

interface AccessDeactivationTabProps {
  dossier: CollaboratorProfileDossier;
  onRefresh: () => Promise<void>;
}

export function AccessDeactivationTab({
  dossier,
  onRefresh,
}: AccessDeactivationTabProps) {
  const { locale, t } = useLocale();
  const cp = t.owner.collaboratorProfile;
  const td = t.owner.teamDirectory;

  const { collaborator } = dossier;
  const isActive = collaborator.status
    ? collaborator.status === "ACTIVE"
    : collaborator.isActive;

  // Formulário de Credenciais
  const [email, setEmail] = useState(collaborator.email);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [credSaving, setCredSaving] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);

  // Fluxo de Desligamento / Afastamento Inteligente
  const [checkingFuture, setCheckingFuture] = useState(false);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [futureCount, setFutureCount] = useState(0);

  // Reativação
  const [reactivating, setReactivating] = useState(false);

  useEffect(() => {
    setEmail(collaborator.email);
  }, [collaborator.email]);

  const handleSaveCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    setCredError(null);

    const normalizedEmail = email.trim().toLowerCase();
    const emailChanged = normalizedEmail !== collaborator.email.trim().toLowerCase();
    const hasNewPassword = password.trim().length > 0;

    if (!emailChanged && !hasNewPassword) {
      setCredError(cp.credentialsNothingChanged);
      return;
    }

    if (emailChanged && !normalizedEmail.includes("@")) {
      setCredError(t.errors.requiredField);
      return;
    }

    if (hasNewPassword && (password.length < 6 || password.length > 30)) {
      setCredError(cp.newPasswordHint);
      return;
    }

    setCredSaving(true);
    try {
      await updateCollaboratorCredentials(collaborator.id, {
        ...(emailChanged ? { email: normalizedEmail } : {}),
        ...(hasNewPassword ? { password } : {}),
      });
      setPassword("");
      setShowPassword(false);
      toast.success(cp.credentialsSavedToast);
      await onRefresh();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription;
      setCredError(msg);
      toast.error(msg);
    } finally {
      setCredSaving(false);
    }
  };

  const handleOpenDeactivateModal = async () => {
    setCheckingFuture(true);
    try {
      const res = await getCollaboratorFutureAppointmentsCount(collaborator.id);
      setFutureCount(res.futureAppointmentsCount ?? 0);
      setDeactivateModalOpen(true);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setCheckingFuture(false);
    }
  };

  const handleReactivate = async () => {
    setReactivating(true);
    try {
      await updateCollaboratorStatus(collaborator.id, true);
      toast.success(cp.reactivatedToast);
      await onRefresh();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setReactivating(false);
    }
  };

  const formattedDeactivatedAt = collaborator.deactivatedAt
    ? new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(collaborator.deactivatedAt))
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* 1. Gestão de Credenciais (PATCH /collaborators/:id/credentials) */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-start gap-3 border-b border-border-subtle pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink">
              {cp.credentialsTitle}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {cp.credentialsSubtitle}
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveCredentials} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cred-email">{cp.loginEmailLabel}</Label>
            <Input
              id="cred-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setCredError(null);
              }}
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="cred-password">{cp.newPasswordLabel}</Label>
              <button
                type="button"
                onClick={() => {
                  setPassword(generateStrongPassword());
                  setShowPassword(true);
                  setCredError(null);
                }}
                className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                {td.generatePassword}
              </button>
            </div>

            <div className="relative">
              <Input
                id="cred-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setCredError(null);
                }}
                placeholder={cp.newPasswordPlaceholder}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword ? t.auth.hidePassword : t.auth.showPassword
                }
                className="cursor-pointer absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink p-1"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-ink-muted">{cp.newPasswordHint}</p>
          </div>

          {credError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">
              {credError}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={credSaving}
              className="cursor-pointer"
            >
              {credSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {credSaving ? t.common.saving : cp.saveCredentialsBtn}
            </Button>
          </div>
        </form>
      </section>

      {/* 2. Zona de Encerramento de Vínculo / Reativação */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-start gap-3 border-b border-border-subtle pb-4">
          <div
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              isActive
                ? "bg-red-500/12 text-red-600 dark:text-red-400"
                : "bg-slate-500/15 text-ink-secondary",
            ].join(" ")}
          >
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink">
              {cp.dangerZoneTitle}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {cp.dangerZoneSubtitle}
            </p>
          </div>
        </div>

        {isActive ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl border border-border-subtle bg-subtle/50 p-3.5 text-xs text-ink-secondary">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <span>{cp.deactivatePreserveNotice}</span>
            </div>

            <Button
              type="button"
              variant="destructive"
              disabled={checkingFuture}
              onClick={() => void handleOpenDeactivateModal()}
              className="cursor-pointer w-full sm:w-auto"
            >
              {checkingFuture ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <UserX className="h-4 w-4 mr-1.5" />
              )}
              {checkingFuture ? cp.deactivateChecking : cp.deactivateBtn}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border-strong bg-subtle/60 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                {cp.inactiveBannerTitle}
              </div>

              {formattedDeactivatedAt && (
                <p className="text-xs text-ink-secondary">
                  {cp.inactiveBannerDatePrefix}{" "}
                  <strong className="font-semibold text-ink">
                    {formattedDeactivatedAt}
                  </strong>
                </p>
              )}

              {collaborator.deactivationReason && (
                <p className="text-xs text-ink-secondary">
                  {cp.inactiveBannerReasonPrefix}{" "}
                  <span className="italic text-ink">
                    “{collaborator.deactivationReason}”
                  </span>
                </p>
              )}
            </div>

            <Button
              type="button"
              disabled={reactivating}
              onClick={() => void handleReactivate()}
              className="cursor-pointer w-full sm:w-auto"
            >
              {reactivating ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4 mr-1.5" />
              )}
              {cp.reactivateBtn}
            </Button>
          </div>
        )}
      </section>

      {/* Modal de Confirmação Inteligente com Motivos Estruturados + Fila IA */}
      <DeactivationModal
        open={deactivateModalOpen}
        collaboratorId={collaborator.id}
        futureCount={futureCount}
        onClose={() => setDeactivateModalOpen(false)}
        onDeactivated={onRefresh}
      />
    </div>
  );
}
