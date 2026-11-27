
"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";
import { clubLabel } from "@/lib/i18n/club";
import type { Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/locale-context";
import { paymentError, type ClubPlan } from "@/lib/online-payments";
import type { Service } from "@/lib/types/service";

export const clubField = "block min-h-10 w-full cursor-pointer rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";
export const clubPrimary = "bg-accent text-accent-ink hover:bg-accent-hover";
const allDays = [0, 1, 2, 3, 4, 5, 6];
const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const weekdayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function dayLabels(locale: Locale) {
  return locale === "es" ? ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] : weekdays;
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
  return groups.map((group) => group.length > 1
    ? `${names[group[0]!]} a ${names[group.at(-1)!]}`
    : names[group[0]!]).join(", ");
}

export function ClubPlanDialog({ plan, services, onClose, onSaved }: {
  plan: ClubPlan | null;
  services: Service[];
  onClose: () => void;
  onSaved: (plan: ClubPlan) => void;
}) {
  const { locale } = useLocale();
  const text = clubLabel(locale);
  const names = dayLabels(locale);
  const accessibleDays = locale === "es" ? ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] : weekdayNames;
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [price, setPrice] = useState(plan ? (plan.priceCents / 100).toFixed(2).replace(".", ",") : "");
  const [included, setIncluded] = useState(plan?.includedServiceIds ?? []);
  const [days, setDays] = useState<number[] | null>(plan?.allowedDaysOfWeek ?? null);
  const [grace, setGrace] = useState(String(plan?.gracePeriodDays ?? 3));
  const [limited, setLimited] = useState(plan?.maxMonthlyUses != null);
  const [limit, setLimit] = useState(String(plan?.maxMonthlyUses ?? 4));
  const [active, setActive] = useState(plan?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    if (!/^\d+(?:[,.]\d{1,2})?$/.test(value) || (!unchangedLegacyPrice && cents < 1) || cents > 2_147_483_647) {
      setError(text("Informe um valor mensal válido e maior que zero."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<ClubPlan>(plan ? `/subscription-plans/${plan.id}` : "/subscription-plans", {
        method: plan ? "PATCH" : "POST",
        body: {
          name: name.trim(), description: description.trim() || null,
          ...(unchangedLegacyPrice ? {} : { priceCents: cents }), billingCycle: "MONTHLY",
          ...(included === plan?.includedServiceIds ? {} : { includedServiceIds: included }),
          allowedDaysOfWeek: days?.length === 7 ? null : days,
          gracePeriodDays: Number(grace), maxMonthlyUses: limited ? Number(limit) : null, active,
        },
      });
      onSaved(result);
    } catch (failure) {
      setError(paymentError(failure, text("Não foi possível salvar o plano.")));
    } finally {
      setBusy(false);
    }
  }

  const currentDays = days ?? allDays;
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl" showCloseButton={!busy}>
      <DialogHeader><DialogTitle className="pr-7 text-lg font-semibold">{plan ? text("Editar plano") : text("Novo plano")}</DialogTitle><DialogDescription>{text("Defina o valor mensal e as regras dos benefícios.")}</DialogDescription></DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          <label className="block space-y-1 text-sm font-medium">{text("Nome do plano")}<input required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} className={clubField} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">{text("Valor mensal")}<input required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={clubField} placeholder="0,00" /></label>
            <label className="space-y-1 text-sm font-medium">{text("Carência (dias)")}<input required type="number" min={0} max={365} value={grace} onChange={(e) => setGrace(e.target.value)} className={clubField} /></label>
          </div>
          <label className="block space-y-1 text-sm font-medium">{text("Descrição")}<textarea rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className={clubField} /></label>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">{text("Serviços inclusos")}</legend>
            {services.length || included.length ? <div className="grid max-h-36 gap-1 overflow-y-auto rounded-xl border border-border-subtle p-2 sm:grid-cols-2">
              {[...services, ...included.filter((id) => !services.some((item) => item.id === id)).map((id) => ({ id, name: text("Serviço indisponível"), active: false }))].map((service) =>
                <label key={service.id} className="flex min-h-9 cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-subtle">
                  <input type="checkbox" className="mt-1 cursor-pointer accent-accent" checked={included.includes(service.id)}
                    onChange={(e) => setIncluded(e.target.checked ? [...included, service.id] : included.filter((id) => id !== service.id))} />
                  <span>{service.name}{!service.active && <small className="ml-1 text-ink-secondary">· {text("Inativo")}</small>}</span>
                </label>)}
            </div> : <p className="text-sm text-ink-secondary">{text("Nenhum serviço cadastrado.")}</p>}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">{text("Dias permitidos")}</legend>
            <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="cursor-pointer accent-accent" checked={currentDays.length === 7} onChange={(e) => setDays(e.target.checked ? null : [])} />{text("Todos os dias")}</label>
            <div className="flex flex-wrap gap-1.5">
              {allDays.map((day) => {
                const selected = currentDays.includes(day);
                return <Button key={day} type="button" variant="outline" aria-label={accessibleDays[day]} aria-pressed={selected} onClick={() => setDays(selected ? currentDays.filter((value) => value !== day) : [...currentDays, day])}
                  className={selected ? "min-w-10 border-accent/50 bg-accent-soft text-accent hover:bg-accent-soft" : "min-w-10 border-border-subtle text-ink-secondary"}>{names[day]}</Button>;
              })}
            </div>
          </fieldset>
          <div className="space-y-2">
            <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="cursor-pointer accent-accent" checked={limited} onChange={(e) => setLimited(e.target.checked)} />{text("Limitar usos por mês")}</label>
            {limited && <label className="block max-w-48 space-y-1 text-sm">{text("Limite mensal")}<input type="number" required min={0} max={10000} value={limit} onChange={(e) => setLimit(e.target.value)} className={clubField} /></label>}
            <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" role="switch" className="cursor-pointer accent-accent" checked={active} onChange={(e) => setActive(e.target.checked)} />{text("Plano ativo")}</label>
          </div>
        </fieldset>
        {error && <p role="alert" className="text-[var(--status-danger-ink)]">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-3"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>{text("Cancelar")}</Button><Button type="submit" disabled={busy} className={clubPrimary}>{busy ? text("Salvando…") : text("Salvar plano")}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
