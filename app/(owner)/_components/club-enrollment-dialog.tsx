
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clubLabel } from "@/lib/i18n/club";
import { useLocale } from "@/lib/i18n/locale-context";
import { apiRequest } from "@/lib/api-client";
import { billingDocument, getBillingClients, paymentError, type BillingClient, type ClubPlan, type ClubSubscription, type GatewaySettings } from "@/lib/online-payments";
import { clubField, clubPrimary } from "./club-plan-dialog";

export function ClubEnrollmentDialog({ plans, gateway, onClose, onSaved }: {
  plans: ClubPlan[];
  gateway: GatewaySettings;
  onClose: () => void;
  onSaved: (subscription: ClubSubscription, document?: string) => void;
}) {
  const { locale } = useLocale();
  const text = clubLabel(locale);
  const [clients, setClients] = useState<BillingClient[]>();
  const [filter, setFilter] = useState("");
  const [clientId, setClientId] = useState("");
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [document, setDocument] = useState("");
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const hosted = gateway.paymentProvider === "MERCADO_PAGO";
  const client = clients?.find((item) => item.id === clientId);
  const visibleClients = clients?.filter((item) => item.id === clientId ||
    (item.name + " " + item.phone).toLowerCase().includes(filter.trim().toLowerCase()));

  useEffect(() => {
    const controller = new AbortController();
    void getBillingClients(controller.signal).then((result) => {
      if (!controller.signal.aborted) setClients(result);
    }, () => { if (!controller.signal.aborted) setLoadFailed(true); });
    return () => controller.abort();
  }, [retry]);

  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || busy || (hosted && !client.email)) return;
    setBusy(true);
    setError("");
    try {
      const normalizedDocument = billingDocument(document);
      const result = await apiRequest<ClubSubscription>("/client-subscriptions", {
        method: "POST", body: { clientId, planId, paymentMethod: "PIX", document: normalizedDocument },
      });
      onSaved(result, normalizedDocument);
    } catch (failure) {
      setError(paymentError(failure, text("Não foi possível vincular o assinante.")));
    } finally {
      setBusy(false);
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto" showCloseButton={!busy}>
      <DialogHeader><DialogTitle className="pr-7 text-lg font-semibold">{text("Vincular assinante")}</DialogTitle><DialogDescription>{text("Escolha um cliente cadastrado e o plano que ele vai assinar.")}</DialogDescription></DialogHeader>
      <form onSubmit={enroll} className="space-y-4">
        <fieldset disabled={busy || !clients} className="space-y-3">
          <input aria-label={text("Buscar cliente por nome ou telefone")} placeholder={text("Buscar cliente por nome ou telefone")} value={filter} onChange={(e) => setFilter(e.target.value)} className={clubField} />
          <label className="block space-y-1 text-sm font-medium">{text("Cliente")}
            <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className={clubField}><option value="">{clients ? text("Selecione um cliente") : text("Carregando clientes…")}</option>
              {visibleClients?.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.phone}</option>)}
            </select>
          </label>
          <label className="block space-y-1 text-sm font-medium">{text("Plano")}
            <select required value={planId} onChange={(e) => setPlanId(e.target.value)} className={clubField}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select>
          </label>
          {hosted ? <p className="rounded-xl bg-subtle p-3 text-sm text-ink-secondary">{client && !client.email ? text("O cliente precisa ter um e-mail cadastrado para pagar pelo Mercado Pago.") : text("O assinante conclui a adesão no checkout do Mercado Pago.")}</p>
            : gateway.paymentProvider === "ASAAS" && <label className="block space-y-1 text-sm font-medium">{text("CPF ou CNPJ do pagador")}
                <input inputMode="numeric" value={document} onChange={(e) => setDocument(e.target.value)} className={clubField} maxLength={14} pattern="[0-9]{11}|[0-9]{14}" />
                <span className="block text-xs font-normal text-ink-secondary">{text("Informe o documento se o cliente ainda não estiver cadastrado no Asaas.")}</span>
              </label>}
        </fieldset>
        {loadFailed && <div className="space-y-2"><p role="alert" className="text-[var(--status-danger-ink)]">{text("Não foi possível carregar os clientes.")}</p><Button type="button" variant="outline" onClick={() => { setLoadFailed(false); setRetry((n) => n + 1); }}>{text("Tentar novamente")}</Button></div>}
        {error && <p role="alert" className="text-[var(--status-danger-ink)]">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-3"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{text("Cancelar")}</Button><Button type="submit" className={clubPrimary} disabled={!client || busy || (hosted && !client.email)}>{busy ? text("Vinculando…") : hosted ? text("Vincular e liberar checkout") : text("Vincular e gerar Pix")}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
