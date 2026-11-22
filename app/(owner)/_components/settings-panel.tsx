"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  ExternalLink,
  Globe2,
  KeyRound,
  Loader2,
  Moon,
  Palette,
  Sun,
  UserCircle2,
} from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api-client";
import { companyWeekday } from "@/lib/agenda";
import { useLocale } from "@/lib/i18n/locale-context";
import { THEME_PALETTES, useTheme } from "@/lib/theme-context";
import { IANA_TIMEZONES } from "@/lib/timezones";
import type { UpdateCompanyTimezoneResponse, CompanyOperatingDaySchedule } from "@/lib/types/auth";
import type { Currency } from "@/lib/types/finance";
import { useSession } from "@/components/ui/auth-guard";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";

function subscribeNoop() {
  return () => undefined;
}

interface CompanyDayScheduleState {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

function buildInitialCompanySchedule(
  savedSchedule?: CompanyOperatingDaySchedule[] | null,
  operatingDaysStr?: string | null,
): CompanyDayScheduleState[] {
  const defaultHours = [
    { day: 0, open: "09:00", close: "15:00" }, // Domingo
    { day: 1, open: "08:00", close: "19:00" }, // Segunda
    { day: 2, open: "08:00", close: "19:00" }, // Terça
    { day: 3, open: "08:00", close: "19:00" }, // Quarta
    { day: 4, open: "08:00", close: "19:00" }, // Quinta
    { day: 5, open: "08:00", close: "17:00" }, // Sexta (ex: fecha mais cedo)
    { day: 6, open: "08:00", close: "18:00" }, // Sábado
  ];

  return defaultHours.map(({ day, open, close }) => {
    const { isOpen, hours } = companyWeekday({ operatingSchedule: savedSchedule, operatingDays: operatingDaysStr }, day);
    return {
      dayOfWeek: day,
      isOpen,
      openTime: hours?.openTime?.slice(0, 5) || open,
      closeTime: hours?.closeTime?.slice(0, 5) || close,
    };
  });
}

export function SettingsPanel() {
  const { session, refreshSession } = useSession();
  const { t } = useLocale();
  const { mode, palette, setMode, setPalette } = useTheme();

  // Perfil & Barbearia
  const [companyName, setCompanyName] = useState(session.company.companyName);
  const [ownerName, setOwnerName] = useState(session.name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    session.avatarUrl ?? null,
  );
  const [scheduleState, setScheduleState] = useState<CompanyDayScheduleState[]>(
    () =>
      buildInitialCompanySchedule(
        session.company.operatingSchedule,
        session.company.operatingDays,
      ),
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Fuso horário
  const [timezone, setTimezone] = useState(session.company.timezone);
  const [tzSaving, setTzSaving] = useState(false);
  const [tzSaved, setTzSaved] = useState(false);
  const [tzError, setTzError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>(session.company.currency ?? "BRL");
  const [currencySaving, setCurrencySaving] = useState(false);
  const [currencySaved, setCurrencySaved] = useState(false);
  const [currencyError, setCurrencyError] = useState<string | null>(null);

  // Senha
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Link público
  const [copied, setCopied] = useState(false);

  const origin = useSyncExternalStore(
    subscribeNoop,
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    () => "",
  );

  const relativePath = `/book/${session.company.id}`;
  const fullBookingUrl = origin ? `${origin}${relativePath}` : relativePath;

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileSaving(true);
    setProfileSaved(false);
    setProfileError(null);
    try {
      const openDaysList = scheduleState
        .filter((s) => s.isOpen)
        .map((s) => s.dayOfWeek)
        .sort((a, b) => a - b);

      const operatingSchedulePayload = scheduleState.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        isOpen: s.isOpen,
        openTime: s.isOpen ? s.openTime : null,
        closeTime: s.isOpen ? s.closeTime : null,
      }));

      await apiRequest("/me/profile", {
        method: "PATCH",
        auth: true,
        body: {
          companyName: companyName.trim(),
          name: ownerName.trim(),
          avatarUrl,
          operatingDays: openDaysList.join(","),
          operatingSchedule: operatingSchedulePayload,
        },
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

  const handleSaveTimezone = async (event: React.FormEvent) => {
    event.preventDefault();
    setTzSaving(true);
    setTzSaved(false);
    setTzError(null);

    try {
      await apiRequest<UpdateCompanyTimezoneResponse>(
        "/companies/me/timezone",
        {
          method: "PATCH",
          auth: true,
          body: { timezone },
        },
      );
      await refreshSession();
      setTzSaved(true);
    } catch (err) {
      setTzError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setTzSaving(false);
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
        body: {
          currentPassword,
          newPassword,
        },
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

  const handleSaveCurrency = async (event: React.FormEvent) => {
    event.preventDefault();
    setCurrencySaving(true);
    setCurrencySaved(false);
    setCurrencyError(null);
    try {
      await apiRequest("/companies/me/currency", { method: "PATCH", body: { currency } });
      await refreshSession();
      setCurrencySaved(true);
    } catch (error) {
      setCurrencyError(error instanceof ApiError && error.message === "FINANCE_CURRENCY_LOCKED"
        ? t.finance.FINANCE_CURRENCY_LOCKED : t.errors.unexpectedDescription);
    } finally {
      setCurrencySaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullBookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback silencioso
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Perfil do Dono & Nome da Barbearia */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <UserCircle2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-title-sm font-bold text-ink">
              {t.owner.settingsTitle}
            </h2>
            <p className="text-xs text-ink-secondary">{session.email}</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <AvatarPicker
            id="owner-avatar"
            value={avatarUrl}
            onChange={(next) => {
              setAvatarUrl(next);
              setProfileSaved(false);
            }}
          />

          {/* Grade Semanal de Funcionamento da Barbearia */}
          <div className="space-y-3 rounded-2xl border border-border-subtle bg-subtle/30 p-4">
            <div>
              <Label className="text-xs font-bold text-ink">
                {t.common.operatingDaysLabel}
              </Label>
              <p className="mt-0.5 text-xs text-ink-muted">
                {t.common.operatingDaysHint}
              </p>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {scheduleState.map((row) => {
                const dayKey = row.dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6;
                return (
                  <div
                    key={row.dayOfWeek}
                    className={[
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border p-3 transition-colors",
                      row.isOpen
                        ? "border-border-strong bg-surface shadow-xs"
                        : "border-border-subtle bg-subtle/40 opacity-70",
                    ].join(" ")}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer min-w-[130px]">
                      <input
                        type="checkbox"
                        checked={row.isOpen}
                        onChange={(e) => {
                          setProfileSaved(false);
                          setScheduleState((prev) =>
                            prev.map((item) =>
                              item.dayOfWeek === row.dayOfWeek
                                ? { ...item, isOpen: e.target.checked }
                                : item,
                            ),
                          );
                        }}
                        className="h-4 w-4 rounded accent-accent cursor-pointer"
                      />
                      <span className="text-xs font-bold text-ink">
                        {t.days[dayKey]}
                      </span>
                    </label>

                    {row.isOpen ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={row.openTime}
                          onChange={(e) => {
                            setProfileSaved(false);
                            setScheduleState((prev) =>
                              prev.map((item) =>
                                item.dayOfWeek === row.dayOfWeek
                                  ? { ...item, openTime: e.target.value }
                                  : item,
                              ),
                            );
                          }}
                          className="min-h-9 w-24 rounded-lg border-border-strong bg-surface px-2 font-mono text-xs tabular-nums text-center"
                        />
                        <span className="text-xs text-ink-muted">–</span>
                        <Input
                          type="time"
                          value={row.closeTime}
                          onChange={(e) => {
                            setProfileSaved(false);
                            setScheduleState((prev) =>
                              prev.map((item) =>
                                item.dayOfWeek === row.dayOfWeek
                                  ? { ...item, closeTime: e.target.value }
                                  : item,
                              ),
                            );
                          }}
                          className="min-h-9 w-24 rounded-lg border-border-strong bg-surface px-2 font-mono text-xs tabular-nums text-center"
                        />
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-ink-muted italic">
                        {t.common.inactive}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settings-company-name">
              {t.auth.companyNameLabel}
            </Label>
            <Input
              id="settings-company-name"
              required
              minLength={3}
              maxLength={100}
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                setProfileSaved(false);
              }}
              className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settings-owner-name">{t.auth.nameLabel}</Label>
            <Input
              id="settings-owner-name"
              required
              minLength={2}
              maxLength={80}
              value={ownerName}
              onChange={(e) => {
                setOwnerName(e.target.value);
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
            <Label htmlFor="owner-current-pw">{t.common.currentPassword}</Label>
            <Input
              id="owner-current-pw"
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
            <Label htmlFor="owner-new-pw">{t.common.newPassword}</Label>
            <Input
              id="owner-new-pw"
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

      {/* Fuso horário da empresa */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Globe2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-title-sm font-bold text-ink">
              {t.auth.timezoneLabel}
            </h2>
            <p className="text-xs text-ink-secondary">
              {session.company.companyName}
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveTimezone} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="settings-timezone">{t.common.timezone}</Label>
            <select
              id="settings-timezone"
              value={timezone}
              onChange={(e) => {
                setTimezone(e.target.value);
                setTzSaved(false);
              }}
              className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink"
            >
              {IANA_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {tzError && (
            <p
              role="alert"
              className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger-ink)]"
            >
              {tzError}
            </p>
          )}

          {tzSaved && (
            <p
              role="status"
              className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-success-ink)]"
            >
              {t.owner.timezoneUpdated}
            </p>
          )}

          <Button
            type="submit"
            disabled={tzSaving}
            className="min-h-11 rounded-full bg-accent px-6 text-accent-ink hover:bg-accent-hover cursor-pointer"
          >
            {tzSaving && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {t.common.save}
          </Button>
        </form>
      </section>

      <section className="space-y-3 rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6">
        <h2 className="text-title-sm font-bold text-ink">{t.finance.baseCurrency}</h2>
        <p id="settings-currency-hint" className="text-xs text-ink-secondary">{t.finance.baseCurrencyHelp}</p>
        <form onSubmit={handleSaveCurrency} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="settings-currency">{t.dashboard.currency}</Label>
            <select id="settings-currency" aria-describedby="settings-currency-hint"
              className="block min-h-11 rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink"
              value={currency} onChange={(event) => {
                setCurrency(event.target.value as Currency); setCurrencySaved(false); setCurrencyError(null);
              }}>
              <option value="BRL">BRL · R$</option>
              <option value="USD">USD · US$</option>
            </select>
          </div>
          <Button type="submit" className="min-h-11"
            disabled={currencySaving || currency === (session.company.currency ?? "BRL")}>
            {currencySaving ? t.common.saving : t.common.save}
          </Button>
        </form>
        {currencyError && <p role="alert" className="text-xs text-[var(--status-danger-ink)]">{currencyError}</p>}
        {currencySaved && <p role="status" className="text-xs text-accent">{t.finance.currencySaved}</p>}
      </section>

      {/* Link público de reserva */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-title-sm font-bold text-ink">
            {t.owner.publicLinkLabel}
          </h2>
          <p className="mt-1 text-xs text-ink-secondary">
            {t.booking.timezoneNotice}:{" "}
            <strong className="font-mono text-ink">
              {session.company.timezone}
            </strong>
          </p>
        </div>

        <div className="rounded-xl border border-border-subtle bg-subtle p-3.5 font-mono text-xs text-ink break-all">
          {fullBookingUrl}
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button
            type="button"
            onClick={() => void handleCopy()}
            className="min-h-11 rounded-full bg-accent px-5 text-accent-ink hover:bg-accent-hover cursor-pointer"
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied ? t.common.copied : t.owner.copyPublicLink}
          </Button>

          <Link
            href={relativePath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:bg-subtle"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {relativePath}
          </Link>
        </div>
      </section>

      {/* Aparência & Idioma (Tema, Paleta de Cores e Idioma PT/ES) */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 space-y-5 lg:col-span-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Palette className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-title-sm font-bold text-ink">
              Aparência &amp; Idioma
            </h2>
            <p className="text-xs text-ink-secondary">
              Personalize o tema claro/escuro, a paleta de cores e o idioma do painel.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Tema Claro / Escuro */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              Tema do Sistema
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("light")}
                aria-pressed={mode === "light"}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors cursor-pointer ${
                  mode === "light"
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border-subtle bg-canvas/50 text-ink-secondary hover:border-border-strong hover:text-ink"
                }`}
              >
                <Sun className="h-4 w-4" aria-hidden="true" />
                <span>Claro</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("dark")}
                aria-pressed={mode === "dark"}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors cursor-pointer ${
                  mode === "dark"
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border-subtle bg-canvas/50 text-ink-secondary hover:border-border-strong hover:text-ink"
                }`}
              >
                <Moon className="h-4 w-4" aria-hidden="true" />
                <span>Escuro</span>
              </button>
            </div>
          </div>

          {/* Paleta de Cores */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              {t.theme.paletteLabel}
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              {THEME_PALETTES.map((item) => {
                const selected = palette === item.id;
                const swatch = mode === "dark" ? item.swatchDark : item.swatchLight;
                const label = t.theme.palettes[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    aria-label={label}
                    title={label}
                    onClick={() => setPalette(item.id)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 cursor-pointer ${
                      selected ? "border-ink scale-105 ring-2 ring-accent/30" : "border-transparent"
                    }`}
                    style={{ backgroundColor: swatch }}
                  >
                    {selected && (
                      <Check
                        className="h-4 w-4"
                        style={{ color: mode === "dark" ? "#09090B" : "#FFFFFF" }}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Idioma PT / ES */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              {t.common.languageLabel}
            </p>
            <LocaleSwitcher />
          </div>
        </div>
      </section>
    </div>
  );
}
