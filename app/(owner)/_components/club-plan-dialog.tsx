"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Check, Clock, Crown, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";
import { formatDuration, formatPriceFromCents } from "@/lib/format";
import { clubLabel } from "@/lib/i18n/club";
import type { Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/locale-context";
import { paymentError, type ClubPlan } from "@/lib/online-payments";
import type { Service } from "@/lib/types/service";

export const clubField =
  "block min-h-10 w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-ink transition-colors placeholder:text-ink-muted focus:border-accent focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";
export const clubPrimary =
  "cursor-pointer bg-accent text-accent-ink hover:bg-accent-hover";

const allDays = [0, 1, 2, 3, 4, 5, 6];
const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const weekdayNames = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function dayLabels(locale: Locale) {
  return locale === "es"
    ? ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    : weekdays;
}

export function summarizeClubDays(days: number[] | null, locale: Locale) {
  const text = clubLabel(locale);
  const names = dayLabels(locale);
  if (days === null || days.length === 7) return text("Todos os dias");
  if (!days.length) return text("Nenhum dia permitido");
  const groups: number[][] = [];
  for (const day of [...days].sort((a, b) => a - b)) {
    const last = groups.at(-1);
    if (last && last.at(-1)! + 1 === day) last.push(day);
    else groups.push([day]);
  }
  return groups
    .map((group) =>
      group.length > 1
        ? `${names[group[0]!]} a ${names[group.at(-1)!]}`
        : names[group[0]!],
    )
    .join(", ");
}

function ModernSwitch({
  checked,
  disabled,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="cursor-pointer flex w-full items-center justify-between gap-3 rounded-xl border border-border-subtle bg-subtle/40 px-3.5 py-3 text-left transition-colors hover:border-border-strong hover:bg-subtle/70 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs text-ink-secondary">{description}</span>
      </div>
      <span
        aria-hidden="true"
        className={[
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors",
          checked
            ? "border-accent bg-accent"
            : "border-border-strong bg-surface",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block size-4 rounded-full shadow-xs transition-transform",
            checked
              ? "translate-x-5.5 bg-accent-ink"
              : "translate-x-0.5 bg-ink-muted",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

export function ClubPlanDialog({
  plan,
  services,
  currency = "BRL",
  onClose,
  onSaved,
}: {
  plan: ClubPlan | null;
  services: Service[];
  currency?: string;
  onClose: () => void;
  onSaved: (plan: ClubPlan) => void;
}) {
  const { locale } = useLocale();
  const text = clubLabel(locale);
  const names = dayLabels(locale);
  const accessibleDays =
    locale === "es"
      ? [
          "Domingo",
          "Lunes",
          "Martes",
          "Miércoles",
          "Jueves",
          "Viernes",
          "Sábado",
        ]
      : weekdayNames;

  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [price, setPrice] = useState(
    plan ? (plan.priceCents / 100).toFixed(2).replace(".", ",") : "",
  );
  const [included, setIncluded] = useState<string[]>(
    plan?.includedServiceIds ?? [],
  );
  const [days, setDays] = useState<number[] | null>(
    plan?.allowedDaysOfWeek ?? null,
  );
  const [grace, setGrace] = useState(String(plan?.gracePeriodDays ?? 3));
  const [limited, setLimited] = useState(plan?.maxMonthlyUses != null);
  const [limit, setLimit] = useState(String(plan?.maxMonthlyUses ?? 4));
  const [active, setActive] = useState(plan?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Exibe os serviços ativos da empresa e preserva eventuais serviços inativos já vinculados ao editar um plano.
  const selectableServices = useMemo(() => {
    const activeServices = services.filter((service) => service.active);
    const linkedInactive = services.filter(
      (service) => !service.active && included.includes(service.id),
    );
    const missingLegacy = included
      .filter((id) => !services.some((service) => service.id === id))
      .map((id) => ({
        id,
        name: text("Serviço indisponível"),
        description: null,
        durationMinutes: 0,
        priceInCents: 0,
        active: false,
      }));
    return [...activeServices, ...linkedInactive, ...missingLegacy];
  }, [services, included, text]);

  function toggleService(serviceId: string) {
    setIncluded((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const value = price.trim();
    const cents = Math.round(Number(value.replace(",", ".")) * 100);
    if (!name.trim()) {
      setError(text("Informe o nome do plano."));
      return;
    }
    const unchangedLegacyPrice = plan?.priceCents === 0 && cents === 0;
    if (
      !/^\d+(?:[,.]\d{1,2})?$/.test(value) ||
      (!unchangedLegacyPrice && cents < 1) ||
      cents > 2_147_483_647
    ) {
      setError(text("Informe um valor mensal válido e maior que zero."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<ClubPlan>(
        plan ? `/subscription-plans/${plan.id}` : "/subscription-plans",
        {
          method: plan ? "PATCH" : "POST",
          body: {
            name: name.trim(),
            description: description.trim() || null,
            ...(unchangedLegacyPrice ? {} : { priceCents: cents }),
            billingCycle: "MONTHLY",
            ...(included === plan?.includedServiceIds
              ? {}
              : { includedServiceIds: included }),
            allowedDaysOfWeek: days?.length === 7 ? null : days,
            gracePeriodDays: Number(grace),
            maxMonthlyUses: limited ? Number(limit) : null,
            active,
          },
        },
      );
      onSaved(result);
    } catch (failure) {
      setError(paymentError(failure, text("Não foi possível salvar o plano.")));
    } finally {
      setBusy(false);
    }
  }

  const currentDays = days ?? allDays;
  const isAllDaysSelected = currentDays.length === 7;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!busy}
      >
        <DialogHeader className="space-y-2 border-b border-border-subtle pb-4">
          <div className="flex items-start gap-3 pr-7">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/15 text-amber-600 dark:text-amber-300">
              <Crown className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-lg font-bold tracking-tight text-ink">
                  {plan ? text("Editar plano") : text("Novo plano")}
                </DialogTitle>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  {text("Clube VIP")}
                </span>
              </div>
              <DialogDescription className="text-xs sm:text-sm text-ink-secondary">
                {text("Defina o valor mensal e as regras dos benefícios.")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={save} className="space-y-5 pt-1">
          <fieldset disabled={busy} className="space-y-5">
            {/* Nome do plano */}
            <label className="block space-y-1.5 text-sm font-medium text-ink">
              <span>{text("Nome do plano")}</span>
              <input
                required
                maxLength={160}
                placeholder="Ex.: Clube Corte Ilimitado"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={clubField}
              />
            </label>

            {/* Valor mensal (com prefixo R$) e Tolerância de atraso */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-medium text-ink">
                <span>{text("Valor mensal")}</span>
                <div className="flex min-h-10 items-center overflow-hidden rounded-xl border border-border-subtle bg-surface transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
                  <span className="flex h-full items-center border-r border-border-subtle bg-subtle/70 px-3 text-sm font-semibold text-ink-secondary select-none">
                    R$
                  </span>
                  <input
                    required
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="99,90"
                    className="min-h-10 w-full bg-transparent px-3 py-2 text-sm font-semibold tabular-nums text-ink placeholder:font-normal placeholder:text-ink-muted focus:outline-none"
                  />
                </div>
              </label>

              <div className="space-y-1.5">
                <label className="block space-y-1.5 text-sm font-medium text-ink">
                  <span>{text("Tolerância de atraso (dias)")}</span>
                  <input
                    required
                    type="number"
                    min={0}
                    max={365}
                    value={grace}
                    onChange={(e) => setGrace(e.target.value)}
                    className={`${clubField} tabular-nums`}
                  />
                </label>
                <p className="text-[11px] leading-snug text-ink-muted">
                  {text(
                    "Dias após o vencimento antes de suspender os benefícios VIP.",
                  )}
                </p>
              </div>
            </div>

            {/* Descrição */}
            <label className="block space-y-1.5 text-sm font-medium text-ink">
              <span>{text("Descrição")}</span>
              <textarea
                rows={2}
                maxLength={2000}
                placeholder="Descreva os diferenciais e benefícios do plano para seus clientes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={clubField}
              />
            </label>

            {/* Serviços inclusos */}
            <fieldset className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <legend className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Scissors className="size-4 text-accent" aria-hidden="true" />
                  {text("Serviços inclusos")}
                </legend>
                {included.length > 0 && (
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold tabular-nums text-accent">
                    {included.length}{" "}
                    {included.length === 1
                      ? text("selecionado")
                      : text("selecionados")}
                  </span>
                )}
              </div>

              {selectableServices.length > 0 ? (
                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-xl border border-border-subtle bg-subtle/30 p-2.5 sm:grid-cols-2">
                  {selectableServices.map((service) => {
                    const selected = included.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleService(service.id)}
                        className={[
                          "cursor-pointer group flex items-start justify-between gap-2.5 rounded-xl border p-3 text-left transition-all",
                          selected
                            ? "border-accent bg-accent-soft/70 ring-1 ring-accent shadow-xs"
                            : "border-border-subtle bg-surface hover:border-border-strong hover:bg-subtle/60",
                        ].join(" ")}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="truncate text-sm font-semibold text-ink">
                            {service.name}
                            {!service.active && (
                              <span className="ml-1.5 text-[11px] font-normal text-ink-muted">
                                · {text("Inativo")}
                              </span>
                            )}
                          </p>
                          {(service.durationMinutes > 0 ||
                            service.priceInCents > 0) && (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
                              {service.durationMinutes > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <Clock
                                    className="size-3 text-ink-muted"
                                    aria-hidden="true"
                                  />
                                  {formatDuration(
                                    service.durationMinutes,
                                    locale,
                                  )}
                                </span>
                              )}
                              {service.priceInCents > 0 && (
                                <span className="font-semibold tabular-nums text-ink">
                                  {formatPriceFromCents(
                                    service.priceInCents,
                                    locale,
                                    currency,
                                  )}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <span
                          aria-hidden="true"
                          className={[
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                            selected
                              ? "border-accent bg-accent text-accent-ink"
                              : "border-border-strong bg-surface text-transparent group-hover:border-accent/60",
                          ].join(" ")}
                        >
                          <Check className="size-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border-strong bg-subtle/40 p-4 text-center text-sm text-ink-secondary">
                  {text("Nenhum serviço cadastrado.")}
                </p>
              )}
            </fieldset>

            {/* Dias permitidos */}
            <fieldset className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <legend className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <CalendarDays
                    className="size-4 text-accent"
                    aria-hidden="true"
                  />
                  {text("Dias permitidos")}
                </legend>
                <button
                  type="button"
                  onClick={() => setDays(isAllDaysSelected ? [] : null)}
                  className={[
                    "cursor-pointer inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    isAllDaysSelected
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-border-subtle bg-surface text-ink-secondary hover:border-border-strong hover:text-ink",
                  ].join(" ")}
                >
                  {isAllDaysSelected && (
                    <Check className="size-3" aria-hidden="true" />
                  )}
                  {text("Todos os dias")}
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {allDays.map((day) => {
                  const selected = currentDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-label={accessibleDays[day]}
                      aria-pressed={selected}
                      onClick={() =>
                        setDays(
                          selected
                            ? currentDays.filter((value) => value !== day)
                            : [...currentDays, day],
                        )
                      }
                      className={[
                        "cursor-pointer flex min-h-10 items-center justify-center rounded-xl border text-xs font-semibold transition-all",
                        selected
                          ? "border-accent bg-accent text-accent-ink shadow-xs"
                          : "border-border-subtle bg-surface text-ink-secondary hover:border-border-strong hover:bg-subtle/60 hover:text-ink",
                      ].join(" ")}
                    >
                      {names[day]}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Switches modernos */}
            <div className="space-y-2.5">
              <ModernSwitch
                checked={limited}
                disabled={busy}
                label={text("Limitar usos por mês")}
                description={text(
                  "Defina quantas vezes por mês o assinante pode usar os serviços inclusos.",
                )}
                onChange={setLimited}
              />

              {limited && (
                <div className="rounded-xl border border-border-subtle bg-subtle/30 p-3.5">
                  <label className="block max-w-56 space-y-1.5 text-sm font-medium text-ink">
                    <span>{text("Limite mensal")}</span>
                    <input
                      type="number"
                      required
                      min={1}
                      max={10000}
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      className={`${clubField} tabular-nums`}
                    />
                  </label>
                </div>
              )}

              <ModernSwitch
                checked={active}
                disabled={busy}
                label={text("Plano ativo")}
                description={text(
                  "Ativa ou pausa a oferta deste plano no portal público.",
                )}
                onChange={setActive}
              />
            </div>
          </fieldset>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-semibold text-[var(--status-danger-ink)]"
            >
              {error}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
              className="cursor-pointer"
            >
              {text("Cancelar")}
            </Button>
            <Button type="submit" disabled={busy} className={clubPrimary}>
              {busy ? text("Salvando…") : text("Salvar plano")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
