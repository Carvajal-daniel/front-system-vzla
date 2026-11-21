"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, Percent, UserCircle2, Wrench } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api-client";
import {
  formatDuration,
  formatPercentage,
  formatPriceFromCents,
} from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Button } from "@/components/ui/button";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CollaboratorServiceItem {
  id?: string;
  serviceId?: string;
  name?: string;
  serviceName?: string;
  durationMinutes?: number;
  priceInCents?: number;
  commissionPercentage: number;
}

function extractMyServices(raw: unknown): CollaboratorServiceItem[] {
  if (Array.isArray(raw)) return raw as CollaboratorServiceItem[];
  if (raw && typeof raw === "object" && "services" in raw) {
    const val = (raw as { services?: unknown }).services;
    if (Array.isArray(val)) return val as CollaboratorServiceItem[];
  }
  return [];
}

export function MyProfilePanel() {
  const { session, refreshSession } = useSession();
  const { locale, t } = useLocale();

  const [name, setName] = useState(session.name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    session.avatarUrl ?? null,
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const [services, setServices] = useState<CollaboratorServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await apiRequest<unknown>("/me/services", { auth: true });
      setServices(extractMyServices(raw));
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
        const raw = await apiRequest<unknown>("/me/services", { auth: true });
        if (!active) return;
        setServices(extractMyServices(raw));
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

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileSaving(true);
    setProfileSaved(false);
    setProfileError(null);
    try {
      await apiRequest("/me/profile", {
        method: "PATCH",
        auth: true,
        body: { name: name.trim(), avatarUrl },
      });
      await refreshSession();
      setProfileSaved(true);
    } catch (err) {
      setProfileError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSavePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPwSaving(true);
    setPwSaved(false);
    setPwError(null);
    try {
      await apiRequest<void>("/me/password", {
        method: "PATCH",
        auth: true,
        body: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setPwSaved(true);
    } catch (err) {
      setPwError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Perfil (Nome e Foto) */}
        <section className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <UserCircle2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-title-sm font-bold text-ink truncate">
                {session.name}
              </h2>
              <p className="text-xs text-ink-secondary truncate">
                {session.email}
                {session.specialty ? ` · ${session.specialty}` : ""}
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <AvatarPicker
              id="collab-avatar"
              value={avatarUrl}
              onChange={(next) => {
                setAvatarUrl(next);
                setProfileSaved(false);
              }}
            />

            <div className="space-y-1.5">
              <Label htmlFor="collab-profile-name">{t.auth.nameLabel}</Label>
              <Input
                id="collab-profile-name"
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setProfileSaved(false);
                }}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5"
              />
            </div>

            {profileError && (
              <p
                role="alert"
                className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger-ink)]"
              >
                {profileError}
              </p>
            )}

            {profileSaved && (
              <p
                role="status"
                className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-success-ink)]"
              >
                {t.common.profileUpdated}
              </p>
            )}

            <Button
              type="submit"
              disabled={profileSaving}
              className="min-h-11 rounded-full bg-accent px-6 text-accent-ink hover:bg-accent-hover cursor-pointer"
            >
              {profileSaving && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {t.common.save}
            </Button>
          </form>
        </section>

        {/* Segurança e Senha */}
        <section className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-title-sm font-bold text-ink">
                {t.collaborator.securityTitle}
              </h2>
              <p className="text-xs text-ink-secondary">{t.auth.passwordHint}</p>
            </div>
          </div>

          <form onSubmit={handleSavePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="collab-current-pw">
                {t.common.currentPassword}
              </Label>
              <Input
                id="collab-current-pw"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setPwSaved(false);
                }}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="collab-new-pw">{t.common.newPassword}</Label>
              <Input
                id="collab-new-pw"
                type="password"
                required
                minLength={6}
                maxLength={15}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPwSaved(false);
                }}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5"
              />
            </div>

            {pwError && (
              <p
                role="alert"
                className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger-ink)]"
              >
                {pwError}
              </p>
            )}

            {pwSaved && (
              <p
                role="status"
                className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-success-ink)]"
              >
                {t.common.passwordUpdated}
              </p>
            )}

            <Button
              type="submit"
              disabled={pwSaving}
              className="min-h-11 rounded-full bg-accent px-6 text-accent-ink hover:bg-accent-hover cursor-pointer"
            >
              {pwSaving && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {t.common.save}
            </Button>
          </form>
        </section>
      </div>

      {/* Meus serviços e comissões */}
      <section className="space-y-4">
        <div>
          <h3 className="text-title-sm font-bold text-ink">
            {t.collaborator.servicesTitle}
          </h3>
          <p className="mt-1 text-xs text-ink-secondary">
            {t.collaborator.readOnlyHint}
          </p>
        </div>

        {loading ? (
          <CardListSkeleton count={3} />
        ) : error ? (
          <ErrorState
            title={t.errors.networkTitle}
            description={error}
            retryLabel={t.common.retry}
            onRetry={() => void loadServices()}
          />
        ) : services.length === 0 ? (
          <EmptyState
            title={t.common.noData}
            description={t.collaborator.readOnlyHint}
            icon={<Wrench className="h-6 w-6" aria-hidden="true" />}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((svc, idx) => (
              <article
                key={svc.id ?? svc.serviceId ?? idx}
                className="card-interactive flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-5"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-base font-bold text-ink truncate">
                    {svc.name ?? svc.serviceName ?? "—"}
                  </p>
                  <p className="text-xs text-ink-secondary tabular-nums">
                    {typeof svc.durationMinutes === "number"
                      ? formatDuration(svc.durationMinutes, locale)
                      : ""}
                    {typeof svc.priceInCents === "number"
                      ? ` · ${formatPriceFromCents(svc.priceInCents, locale, session.company.currency)}`
                      : ""}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 font-mono text-xs font-bold text-accent tabular-nums">
                  <Percent className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatPercentage(svc.commissionPercentage, locale)}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
