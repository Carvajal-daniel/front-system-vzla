"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ApiError, apiRequest } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import { useCompanySettings } from "@/lib/use-company-settings";
import { clientWhatsAppUrl, getCompanyBookingPhone } from "@/lib/use-clients";
import { Button } from "@/components/ui/button";

export default function CancelPublicBookingPage() {
  return <Suspense fallback={null}><CancelPublicBookingForm /></Suspense>;
}

function CancelPublicBookingForm() {
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const es = locale === "es";
  const { settings } = useCompanySettings(companyId);
  const [state, setState] = useState<"idle" | "pending" | "done" | "blocked">("idle");
  const [blocked, setBlocked] = useState<{ expired: boolean; minutes?: number }>();
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const companyPath = `/public/companies/${encodeURIComponent(companyId)}`;
  const minutes = blocked?.minutes ?? settings.cancelLeadTime ?? settings.leadTime;
  const lead = minutes > 0 && minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;
  const [error, setError] = useState("");
  const title = es ? "Cancelar reserva" : "Cancelar agendamento";

  async function cancel() {
    const url = new URL(window.location.href);
    const appointmentId = url.searchParams.get("appointment");
    const token = url.hash.slice(1);
    if (!appointmentId || !token) {
      setError(es ? "Enlace de cancelación inválido." : "Link de cancelamento inválido.");
      return;
    }
    setState("pending");
    setError("");
    try {
      await apiRequest(`${companyPath}/appointments/${encodeURIComponent(appointmentId)}/cancel`, {
        method: "POST", auth: false, body: { token },
      });
      setState("done");
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.status === 403)) {
        const details = err.details as { cancelLeadTime?: number; whatsapp?: string; timezone?: string } | undefined;
        setBlocked({ expired: err.status === 409, minutes: details?.cancelLeadTime });
        setWhatsapp(clientWhatsAppUrl(details?.whatsapp || getCompanyBookingPhone(companyId), details?.timezone === "America/Caracas" ? "+58" : "+55"));
        setState("blocked");
        return;
      }
      setError(err instanceof Error ? err.message : es ? "No se pudo cancelar la reserva." : "Não foi possível cancelar o agendamento.");
      setState("idle");
    }
  }

  return <main className="mx-auto my-12 w-full max-w-md px-4">
    <section className="space-y-4 rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6">
      <h1 className="text-title-sm font-bold">{title}</h1>
      {state === "done" ? <p role="status" className="text-sm">{es ? "Reserva cancelada." : "Agendamento cancelado."}</p> : state === "blocked" ? <>
        <p role="alert" className="text-sm text-[var(--status-danger-ink)]">
          {blocked?.expired
            ? minutes === 0
              ? (es ? "El plazo venció. Puedes cancelar hasta antes del inicio de la reserva." : "O prazo expirou. O cancelamento pode ser feito até antes do início do agendamento.")
              : (es ? `El plazo venció. Cancela con más de ${lead} de anticipación.` : `O prazo expirou. O cancelamento exige mais de ${lead} de antecedência.`)
            : (es ? "La cancelación por este enlace está desactivada." : "O cancelamento por este link está desativado.")}
        </p>
        <p className="text-sm text-ink-secondary">{es ? "Contacta al establecimiento por WhatsApp." : "Entre em contato com a barbearia pelo WhatsApp."}</p>
        {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className="cursor-pointer text-sm font-semibold text-accent underline">WhatsApp</a>}
      </> : <>
        <p className="text-sm text-ink-secondary">{es ? "Confirma la cancelación de tu reserva." : "Confirme o cancelamento do seu agendamento."}</p>
        <Button className="cursor-pointer" disabled={state === "pending"} onClick={() => void cancel()}>{es ? "Confirmar cancelación" : "Confirmar cancelamento"}</Button>
      </>}
      {error && <p role="alert" className="text-sm text-[var(--status-danger-ink)]">{error}</p>}
      <Link className="block text-sm font-semibold text-accent underline" href={`/book/${companyId}`}>{es ? "Volver a las reservas" : "Voltar ao agendamento"}</Link>
    </section>
  </main>;
}

