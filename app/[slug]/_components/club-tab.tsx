"use client";

import { useMemo, useState } from "react";
import {
  CalendarCheck2,
  Check,
  CheckCircle2,
  Crown,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import {
  formatNationalPhoneDisplay,
  formatPriceFromCents,
  stripNonDigits,
} from "@/lib/format";
import {
  getPublicPortalErrorMessage,
  subscribePublicClub,
  type PublicClubPlan,
  type PublicClubSubscribeResponse,
  type PublicIdentifyResponse,
  type PublicPortalCompany,
  type PublicPortalService,
} from "@/src/services/public-portal";
import { PublicPixCheckout } from "./public-pix-checkout";

interface ClubTabProps {
  company: PublicPortalCompany;
  services: PublicPortalService[];
  clubPlans: PublicClubPlan[];
  clientName: string;
  clientPhoneDigits: string;
  identification: PublicIdentifyResponse | null;
  onClientNameChange: (name: string) => void;
  onClientPhoneDigitsChange: (digits: string) => void;
  onSubscriptionConfirmed: (digits: string, name?: string) => Promise<void>;
  onGoToBooking: () => void;
}

const DAY_LABELS: Record<string, string> = {
  "0": "Dom",
  "1": "Seg",
  "2": "Ter",
  "3": "Qua",
  "4": "Qui",
  "5": "Sex",
  "6": "Sáb",
  SUNDAY: "Dom",
  MONDAY: "Seg",
  TUESDAY: "Ter",
  WEDNESDAY: "Qua",
  THURSDAY: "Qui",
  FRIDAY: "Sex",
  SATURDAY: "Sáb",
};

function formatBillingCycle(cycle: string): string {
  switch (cycle.toUpperCase()) {
    case "WEEKLY":
      return "/semana";
    case "BIWEEKLY":
      return "/quinzena";
    case "MONTHLY":
      return "/mês";
    case "QUARTERLY":
      return "/trimestre";
    case "YEARLY":
    case "ANNUAL":
      return "/ano";
    default:
      return "/mês";
  }
}

function formatAllowedDays(days: Array<number | string> | null): string {
  if (!days || days.length === 0 || days.length >= 7) {
    return "Todos os dias da semana";
  }
  const labels = days
    .map((d) => DAY_LABELS[String(d).toUpperCase()] ?? String(d))
    .filter(Boolean);
  return labels.join(", ");
}

export function ClubTab({
  company,
  services,
  clubPlans,
  clientName,
  clientPhoneDigits,
  identification,
  onClientNameChange,
  onClientPhoneDigitsChange,
  onSubscriptionConfirmed,
  onGoToBooking,
}: ClubTabProps) {
  const currency = company.currency || "BRL";

  const [selectedPlan, setSelectedPlan] = useState<PublicClubPlan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionCharge, setSubscriptionCharge] =
    useState<PublicClubSubscribeResponse | null>(null);
  const [activatedPlanName, setActivatedPlanName] = useState<string | null>(null);

  const servicesById = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services],
  );

  const activePlanId =
    identification?.isSubscriber && identification.subscription
      ? identification.subscription.planId
      : null;

  async function handleSubscribeSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedPlan) return;
    setError(null);

    if (clientName.trim().length < 2) {
      setError("Informe seu nome completo para continuar.");
      return;
    }
    if (clientPhoneDigits.length < 10) {
      setError("Informe um telefone válido com DDD.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await subscribePublicClub(company.slug, {
        customerName: clientName.trim(),
        customerPhone: clientPhoneDigits,
        planId: selectedPlan.id,
      });
      setSubscriptionCharge(response);
    } catch (failure) {
      setError(
        getPublicPortalErrorMessage(
          failure,
          "Não foi possível iniciar a assinatura agora. Tente novamente.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePixConfirmed() {
    const planTitle = selectedPlan?.name ?? "Clube VIP";
    setSubscriptionCharge(null);
    setSelectedPlan(null);
    setActivatedPlanName(planTitle);
    await onSubscriptionConfirmed(clientPhoneDigits, clientName.trim() || undefined);
  }

  // Tela de boas-vindas após confirmação da assinatura VIP
  if (activatedPlanName) {
    return (
      <section className="rounded-2xl border border-[var(--status-success-border)] bg-surface p-6 text-center shadow-xs space-y-4">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--status-success-bg)] text-[var(--status-success-ink)]">
          <Crown className="size-7" aria-hidden="true" />
        </div>
        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--status-success-bg)] px-3 py-1 text-xs font-semibold text-[var(--status-success-ink)]">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Assinatura Ativa
          </span>
          <h2 className="mt-2 text-xl font-bold text-ink">
            Bem-vindo ao {activatedPlanName}!
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Seu acesso VIP já foi reconhecido automaticamente. Você já pode
            agendar seus serviços inclusos sem pagar sinal.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setActivatedPlanName(null);
            onGoToBooking();
          }}
          className="cursor-pointer flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
        >
          <CalendarCheck2 className="size-4" aria-hidden="true" />
          Agendar meu primeiro horário VIP
        </button>
      </section>
    );
  }

  // Tela de Checkout Pix da assinatura
  if (subscriptionCharge) {
    return (
      <PublicPixCheckout
        slug={company.slug}
        charge={subscriptionCharge.payment}
        currency={currency}
        title="Assinatura Clube VIP via Pix"
        subtitle={selectedPlan ? `Plano ${selectedPlan.name}` : undefined}
        onConfirmed={() => void handlePixConfirmed()}
        onClose={() => setSubscriptionCharge(null)}
      />
    );
  }

  if (clubPlans.length === 0) {
    return (
      <section className="rounded-2xl border border-border-subtle bg-surface p-8 text-center shadow-xs space-y-2">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-subtle text-ink-muted">
          <Crown className="size-5" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-ink">
          Clube VIP em breve
        </h2>
        <p className="text-sm text-ink-secondary">
          Este estabelecimento ainda não publicou planos de assinatura por aqui.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {selectedPlan && (
        <section className="rounded-2xl border border-accent bg-surface p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Finalizar adesão
              </span>
              <h2 className="text-base font-bold text-ink">
                {selectedPlan.name}
              </h2>
              <p className="text-xs text-ink-secondary">
                {formatPriceFromCents(selectedPlan.priceCents, "pt-BR", currency)}
                {formatBillingCycle(selectedPlan.billingCycle)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedPlan(null);
                setError(null);
              }}
              aria-label="Fechar formulário de assinatura"
              className="cursor-pointer rounded-lg p-1.5 text-ink-muted hover:bg-subtle hover:text-ink"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={handleSubscribeSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="club-customer-name"
                className="mb-1 block text-xs font-medium text-ink-secondary"
              >
                Seu nome completo *
              </label>
              <input
                id="club-customer-name"
                type="text"
                autoComplete="name"
                placeholder="Digite seu nome"
                value={clientName}
                onChange={(e) => onClientNameChange(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="club-customer-phone"
                className="mb-1 block text-xs font-medium text-ink-secondary"
              >
                WhatsApp / Telefone *
              </label>
              <input
                id="club-customer-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="(11) 99999-9999"
                value={formatNationalPhoneDisplay("+55", clientPhoneDigits)}
                onChange={(e) =>
                  onClientPhoneDigitsChange(
                    stripNonDigits(e.target.value).slice(0, 11),
                  )
                }
                className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink tabular-nums placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-xs font-medium text-[var(--status-danger-ink)]"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="cursor-pointer flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2
                    className="size-4 motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                  Gerando Pix da assinatura…
                </>
              ) : (
                <>
                  <Crown className="size-4" aria-hidden="true" />
                  Continuar para pagamento Pix
                </>
              )}
            </button>
          </form>
        </section>
      )}

      {clubPlans.map((plan) => {
        const isCurrentPlan = activePlanId === plan.id;
        const includedServices = plan.includedServiceIds
          .map((id) => servicesById.get(id))
          .filter((item): item is PublicPortalService => Boolean(item));

        return (
          <article
            key={plan.id}
            className={[
              "rounded-2xl border bg-surface p-5 shadow-xs space-y-4 transition-all",
              isCurrentPlan
                ? "border-[var(--status-success-border)] ring-1 ring-[var(--status-success-border)]"
                : "border-border-subtle",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Crown className="size-4 text-accent" aria-hidden="true" />
                  <h3 className="text-base font-bold text-ink">{plan.name}</h3>
                </div>
                {plan.description && (
                  <p className="mt-1 text-xs text-ink-secondary leading-relaxed">
                    {plan.description}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <p className="text-lg font-bold tabular-nums text-ink">
                  {formatPriceFromCents(plan.priceCents, "pt-BR", currency)}
                </p>
                <p className="text-[11px] text-ink-muted">
                  {formatBillingCycle(plan.billingCycle)}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-subtle/70 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-secondary">Limite mensal</span>
                <span className="font-semibold text-ink">
                  {plan.maxMonthlyUses === null
                    ? "Ilimitado"
                    : `Até ${plan.maxMonthlyUses} ${
                        plan.maxMonthlyUses === 1 ? "uso/mês" : "usos/mês"
                      }`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-secondary">Dias permitidos</span>
                <span className="font-medium text-ink text-right">
                  {formatAllowedDays(plan.allowedDaysOfWeek)}
                </span>
              </div>
            </div>

            {includedServices.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-ink-secondary">
                  Serviços inclusos:
                </p>
                <ul className="space-y-1.5">
                  {includedServices.map((service) => (
                    <li
                      key={service.id}
                      className="flex items-center gap-2 text-xs text-ink"
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--status-success-bg)] text-[var(--status-success-ink)]">
                        <Check className="size-3" aria-hidden="true" />
                      </span>
                      <span>{service.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isCurrentPlan ? (
              <button
                type="button"
                onClick={onGoToBooking}
                className="cursor-pointer flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 text-sm font-semibold text-[var(--status-success-ink)] transition-colors hover:opacity-90"
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Seu plano atual • Agendar horário
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSelectedPlan(plan);
                  setError(null);
                }}
                className="cursor-pointer flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
              >
                <Crown className="size-4" aria-hidden="true" />
                Assinar Plano
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
