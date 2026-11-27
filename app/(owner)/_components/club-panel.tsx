
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, CheckCircle2, CirclePause, Clock3, Pencil, Plus, QrCode, Scissors } from "lucide-react";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";
import { formatDateInTimezone, formatPriceFromCents } from "@/lib/format";
import { clubLabel } from "@/lib/i18n/club";
import { useLocale } from "@/lib/i18n/locale-context";
import { paymentError, subscriberStatuses, type ClubPlan, type ClubSubscription, type GatewaySettings, type PixRequest, type SubscriberStatus } from "@/lib/online-payments";
import type { Service } from "@/lib/types/service";
import { PixChargeDialog } from "./pix-charge-dialog";
import { ClubPlanDialog, clubField, clubPrimary, summarizeClubDays } from "./club-plan-dialog";
import { ClubEnrollmentDialog } from "./club-enrollment-dialog";

const subscriberLabels = {
  ACTIVE: "Ativo", PAST_DUE: "Em atraso", SUSPENDED: "Suspenso", PENDING_PAYMENT: "Aguardando pagamento", CANCELED: "Cancelado",
} as const satisfies Record<SubscriberStatus, string>;

function ClubStatus({ status, label }: { status: SubscriberStatus; label?: string }) {
  const { locale } = useLocale();
  const text = clubLabel(locale);
  const warning = status === "PENDING_PAYMENT" || status === "PAST_DUE";
  const Icon = status === "ACTIVE" ? CheckCircle2 : warning ? Clock3 : CirclePause;
  const colors = status === "ACTIVE" ? "bg-[var(--status-success-bg)] text-[var(--status-success-ink)]"
    : warning ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-ink)]" : "bg-subtle text-ink-secondary";
  return <span className={`inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${colors}`}><Icon className="size-3.5" aria-hidden />{label ?? text(subscriberLabels[status])}</span>;
}

function Retry({ onRetry }: { onRetry: () => void }) {
  const { locale } = useLocale();
  const text = clubLabel(locale);
  return <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-sm text-[var(--status-danger-ink)]">{text("Não foi possível carregar estes dados.")}</p><Button type="button" variant="outline" onClick={onRetry}>{text("Tentar novamente")}</Button></div>;
}

export function ClubPanel() {
  const { locale } = useLocale();
  const text = clubLabel(locale);
  const loading = <p role="status" className="text-sm text-ink-secondary">{text("Carregando…")}</p>;
  const { session } = useSession();
  const { currency, timezone } = session.company;
  const [view, setView] = useState<"plans" | "subscribers">("plans");
  const [plans, setPlans] = useState<ClubPlan[]>();
  const [services, setServices] = useState<Service[]>([]);
  const [gateway, setGateway] = useState<GatewaySettings>();
  const [plansError, setPlansError] = useState(false);
  const [gatewayError, setGatewayError] = useState(false);
  const [plansRevision, setPlansRevision] = useState(0);
  const [filter, setFilter] = useState<SubscriberStatus | "">("");
  const [subscribers, setSubscribers] = useState<{ filter: SubscriberStatus | ""; rows?: ClubSubscription[]; failed?: boolean }>();
  const [subscriberRevision, setSubscriberRevision] = useState(0);
  const [planEditor, setPlanEditor] = useState<{ plan: ClubPlan | null }>();
  const [enrolling, setEnrolling] = useState(false);
  const [pix, setPix] = useState<PixRequest | null>(null);
  const [checkout, setCheckout] = useState<string | null>(null);
  const [statusError, setStatusError] = useState("");
  const [toggling, setToggling] = useState<string>();
  const activePlans = plans?.filter((plan) => plan.active && plan.priceCents > 0) ?? [];
  const shown = subscribers?.filter === filter ? subscribers : undefined;

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      apiRequest<ClubPlan[]>("/subscription-plans", { signal: controller.signal }),
      // A rota GET /services retorna { services: Service[] }; extrai com segurança para evitar lista vazia.
      apiRequest<Service[] | { services?: Service[] }>("/services", { signal: controller.signal }),
    ]).then(([newPlans, rawServices]) => {
      if (!controller.signal.aborted) {
        const normalizedServices = Array.isArray(rawServices)
          ? rawServices
          : Array.isArray(rawServices?.services)
            ? rawServices.services
            : [];
        setPlans(newPlans);
        setServices(normalizedServices);
      }
    }, () => { if (!controller.signal.aborted) setPlansError(true); });
    void apiRequest<GatewaySettings>("/payments/config", { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setGateway(result);
    }, () => { if (!controller.signal.aborted) setGatewayError(true); });
    return () => controller.abort();
  }, [plansRevision]);

  useEffect(() => {
    if (view !== "subscribers") return;
    const controller = new AbortController();
    void apiRequest<ClubSubscription[]>("/client-subscriptions", { query: { status: filter }, signal: controller.signal })
      .then((rows) => { if (!controller.signal.aborted) setSubscribers({ filter, rows }); },
        () => { if (!controller.signal.aborted) setSubscribers({ filter, failed: true }); });
    return () => controller.abort();
  }, [filter, subscriberRevision, view]);

  useEffect(() => {
    if (view !== "subscribers") return;
    function refresh() { setSubscriberRevision((n) => n + 1); }
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [view]);

  function replacePlan(plan: ClubPlan) {
    setPlans((items) => [...(items ?? []).filter((item) => item.id !== plan.id), plan].sort((a, b) => a.name.localeCompare(b.name, locale)));
  }

  async function togglePlan(plan: ClubPlan) {
    if (toggling) return;
    setToggling(plan.id);
    setStatusError("");
    try {
      replacePlan(await apiRequest<ClubPlan>(`/subscription-plans/${plan.id}`, { method: "PATCH", body: { active: !plan.active } }));
    } catch (error) {
      setStatusError(paymentError(error, text("Não foi possível atualizar o status do plano.")));
    } finally {
      setToggling(undefined);
    }
  }

  function showCharge(subscription: ClubSubscription, document?: string) {
    if (subscription.status === "ACTIVE" || subscription.status === "CANCELED") return;
    if (subscription.checkoutUrl?.startsWith("https://")) {
      setCheckout(subscription.checkoutUrl);
    } else if (subscription.paymentMethod === "PIX" && subscription.paymentProvider !== "MERCADO_PAGO") {
      setPix({ referenceType: "SUBSCRIPTION", referenceId: subscription.id, clientId: subscription.clientId, document });
    }
  }

  function retryCatalog() {
    setPlansError(false);
    setGatewayError(false);
    setPlansRevision((n) => n + 1);
  }

  return <div className="space-y-5">
    <header className="space-y-1">
      <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{text("Clube de Assinaturas")}</h1>
      <p className="text-sm text-ink-secondary">{text("Gerencie os planos, os benefícios e os pagamentos recorrentes do clube.")}</p>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-3">
      <div className="flex gap-1 rounded-xl bg-subtle p-1" role="group" aria-label={text("Área do clube")}>
        <Button type="button" variant="ghost" aria-pressed={view === "plans"} className={view === "plans" ? "bg-surface text-accent shadow-xs" : "text-ink-secondary"} onClick={() => setView("plans")}>{text("Planos")}</Button>
        <Button type="button" variant="ghost" aria-pressed={view === "subscribers"} className={view === "subscribers" ? "bg-surface text-accent shadow-xs" : "text-ink-secondary"} onClick={() => setView("subscribers")}>{text("Assinantes")}</Button>
      </div>
      {view === "plans" ? <Button type="button" className={clubPrimary} disabled={!plans || plansError} onClick={() => setPlanEditor({ plan: null })}><Plus aria-hidden />{text("Novo plano")}</Button>
        : <Button type="button" className={clubPrimary} disabled={!activePlans.length || !gateway || gateway.paymentProvider === "NONE"} onClick={() => setEnrolling(true)}><Plus aria-hidden />{text("Vincular assinante")}</Button>}
    </div>
    {view === "plans" ? <>
      {statusError && <p role="alert" className="text-sm text-[var(--status-danger-ink)]">{statusError}</p>}
      {plansError ? <Retry onRetry={retryCatalog} /> : !plans ? loading
        : plans.length === 0 ? <p className="rounded-2xl border border-border-subtle bg-surface p-5 text-sm text-ink-secondary">{text("Nenhum plano cadastrado.")}</p>
        : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => <article key={plan.id} className="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="min-w-0 break-words text-base font-semibold">{plan.name}</h2><ClubStatus status={plan.active ? "ACTIVE" : "SUSPENDED"} label={text(plan.active ? "Ativo" : "Inativo")} /></div>
              <p className="text-xl font-semibold tabular-nums">{formatPriceFromCents(plan.priceCents, locale, currency)}<span className="ml-1 text-xs font-normal text-ink-secondary">{text("/mês")}</span></p>
              {plan.description && <p className="break-words text-sm text-ink-secondary">{plan.description}</p>}
            </div>
            <div className="space-y-1.5 text-sm">
              <h3 className="flex items-center gap-1.5 font-medium"><Scissors className="size-4 text-accent" aria-hidden />{text("Serviços inclusos")}</h3>
              <p className="break-words text-ink-secondary">{plan.includedServiceIds.map((id) => services.find((service) => service.id === id)?.name ?? text("Serviço indisponível")).join(", ") || text("Nenhum serviço incluso")}</p>
            </div>
            <dl className="space-y-2 border-t border-border-subtle pt-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-1.5"><dt className="flex items-center gap-1.5 text-ink-secondary"><CalendarDays className="size-4" aria-hidden />{text("Dias permitidos")}</dt><dd className="font-medium">{summarizeClubDays(plan.allowedDaysOfWeek, locale)}</dd></div>
              <div className="flex flex-wrap justify-between gap-1.5"><dt className="text-ink-secondary">{text("Tolerância de atraso")}</dt><dd>{plan.gracePeriodDays} {plan.gracePeriodDays === 1 ? text("dia") : text("dias")}</dd></div>
              <div className="flex flex-wrap justify-between gap-1.5"><dt className="text-ink-secondary">{text("Limite mensal")}</dt><dd>{plan.maxMonthlyUses === null ? text("Ilimitado") : `${plan.maxMonthlyUses} ${plan.maxMonthlyUses === 1 ? text("uso") : text("usos")}`}</dd></div>
            </dl>
            <div className="mt-auto flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setPlanEditor({ plan })}><Pencil aria-hidden />{text("Editar plano")}</Button>
              <Button type="button" variant="ghost" disabled={!!toggling} onClick={() => void togglePlan(plan)}>{plan.active ? text("Desativar") : text("Reativar")}</Button>
            </div>
          </article>)}
        </div>}
    </> : <section className="space-y-4">
      {(gatewayError || plansError) && <Retry onRetry={retryCatalog} />}
      {gateway?.paymentProvider === "NONE" && <p className="text-sm text-ink-secondary">{text("Configure um gateway para vincular assinantes.")} <Link className="cursor-pointer font-medium text-accent underline" href="/owner/finance/online-payments">{text("Configurar pagamentos")}</Link></p>}
      {plans && !activePlans.length && <p className="text-sm text-ink-secondary">{text("Cadastre um plano ativo com valor mensal para vincular assinantes.")}</p>}
      <label className="block w-fit space-y-1 text-sm font-medium">{text("Status")}
        <select className={clubField} value={filter} onChange={(e) => setFilter(e.target.value as SubscriberStatus | "")}>
          <option value="">{text("Todos os status")}</option>{subscriberStatuses.map((status) => <option key={status} value={status}>{text(subscriberLabels[status])}</option>)}
        </select>
      </label>
      {!shown ? loading
        : shown.failed ? <Retry onRetry={() => { setSubscribers(undefined); setSubscriberRevision((n) => n + 1); }} />
        : !shown.rows?.length ? <p className="rounded-2xl border border-border-subtle bg-surface p-5 text-sm text-ink-secondary">{text("Nenhum assinante neste filtro.")}</p>
        : <ul className="divide-y divide-border-subtle rounded-2xl border border-border-subtle bg-surface">
          {shown.rows.map((subscription) => <li key={subscription.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-center">
            <div className="min-w-0"><p className="break-words text-sm font-semibold">{subscription.clientName}</p><p className="break-words text-sm text-ink-secondary">{subscription.planName}</p></div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-secondary">
              <span>{subscription.paymentMethod === "PIX" ? "Pix" : text("Cartão de crédito")}</span>
              <span>{text("Vencimento")} · {subscription.currentPeriodEnd ? formatDateInTimezone(subscription.currentPeriodEnd, timezone, locale) : "—"}</span>
            </div>
            <ClubStatus status={subscription.status} />
            <div className="justify-self-start md:justify-self-end">
              {subscription.status !== "ACTIVE" && subscription.status !== "CANCELED" && ((subscription.status === "PENDING_PAYMENT" && subscription.checkoutUrl?.startsWith("https://")) || (subscription.paymentMethod === "PIX" && subscription.paymentProvider !== "MERCADO_PAGO")) &&
                <Button type="button" variant="outline" onClick={() => showCharge(subscription)}>{subscription.checkoutUrl ? <ArrowUpRight aria-hidden /> : <QrCode aria-hidden />}{subscription.checkoutUrl ? text("Abrir checkout") : text("Pix Online / QR Code")}</Button>}
            </div>
          </li>)}
        </ul>}
    </section>}
    {planEditor && <ClubPlanDialog plan={planEditor.plan} services={services} currency={currency} onClose={() => setPlanEditor(undefined)} onSaved={(plan) => { replacePlan(plan); setPlanEditor(undefined); }} />}
    {enrolling && gateway && <ClubEnrollmentDialog plans={activePlans} gateway={gateway} onClose={() => setEnrolling(false)} onSaved={(subscription, document) => {
      setEnrolling(false);
      setFilter("");
      setSubscriberRevision((n) => n + 1);
      showCharge(subscription, document);
    }} />}
    {pix && <PixChargeDialog request={pix} onClose={() => setPix(null)} onConfirmed={() => { setPix(null); setSubscriberRevision((n) => n + 1); }} />}
    {checkout && <Dialog open onOpenChange={(open) => { if (!open) setCheckout(null); }}><DialogContent>
      <DialogHeader><DialogTitle className="pr-7 text-lg font-semibold">Mercado Pago</DialogTitle><DialogDescription>{text("O assinante conclui a adesão no checkout. A lista é atualizada quando você retorna.")}</DialogDescription></DialogHeader>
      <a href={checkout} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 w-fit cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent"><ArrowUpRight className="size-4" aria-hidden />{text("Abrir checkout")}</a>
    </DialogContent></Dialog>}
  </div>;
}
