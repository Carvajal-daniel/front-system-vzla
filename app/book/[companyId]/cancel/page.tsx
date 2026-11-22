"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import { Button } from "@/components/ui/button";

export default function CancelPublicBookingPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const es = locale === "es";
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
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
      await apiRequest(`/public/companies/${encodeURIComponent(companyId)}/appointments/${encodeURIComponent(appointmentId)}/cancel`, {
        method: "POST", auth: false, body: { token },
      });
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : es ? "No se pudo cancelar la reserva." : "Não foi possível cancelar o agendamento.");
      setState("idle");
    }
  }

  return <main className="mx-auto my-12 w-full max-w-md px-4">
    <section className="space-y-4 rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6">
      <h1 className="text-title-sm font-bold">{title}</h1>
      {state === "done" ? <p role="status" className="text-sm">{es ? "Reserva cancelada." : "Agendamento cancelado."}</p> : <>
        <p className="text-sm text-ink-secondary">{es ? "Confirma la cancelación de tu reserva." : "Confirme o cancelamento do seu agendamento."}</p>
        <Button disabled={state === "pending"} onClick={() => void cancel()}>{es ? "Confirmar cancelación" : "Confirmar cancelamento"}</Button>
      </>}
      {error && <p role="alert" className="text-sm text-[var(--status-danger-ink)]">{error}</p>}
      <Link className="block text-sm font-semibold text-accent underline" href={`/book/${companyId}`}>{es ? "Volver a las reservas" : "Voltar ao agendamento"}</Link>
    </section>
  </main>;
}

