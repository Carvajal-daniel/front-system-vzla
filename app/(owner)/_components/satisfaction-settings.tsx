"use client";

import { useEffect, useState } from "react";
import { Sparkles, Star } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { formatDateTimeInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type { Appointment } from "@/lib/types/appointment";
import { clientWhatsAppUrl } from "@/lib/use-clients";
import { saveCompanySettings, useCompanySettings } from "@/lib/use-company-settings";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";

interface Review {
  id: string;
  appointmentId: string | null;
  stars: number;
  comment: string | null;
  submittedAt: string;
  service: string | null;
}

interface Analysis {
  strengths: string[];
  concerns: string[];
  actions: string[];
}

export function SatisfactionSettings() {
  const { session } = useSession();
  const { settings, refresh } = useCompanySettings(session.company.id);
  const { locale, t } = useLocale();
  const es = locale === "es";
  const [enabled, setEnabled] = useState<boolean>();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selected, setSelected] = useState("");
  const [invite, setInvite] = useState<{ url: string; whatsapp: string | null }>();
  const [analysis, setAnalysis] = useState<Analysis>();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const request = new AbortController();
    const signal = request.signal;
    void Promise.all([
      apiRequest<Appointment[]>("/appointments", { query: { status: "COMPLETED" }, signal }),
      apiRequest<Review[]>("/companies/me/reviews", { signal }),
    ]).then(([completed, received]) => {
      if (signal.aborted) return;
      setAppointments(completed);
      setReviews(received);
    }).catch(() => {
      if (!signal.aborted) setError(t.errors.networkDescription);
    });
    return () => request.abort();
  }, [t.errors.networkDescription]);

  async function run(action: string, fn: () => Promise<void>) {
    setPending(action);
    setError("");
    setStatus("");
    try { await fn(); }
    catch (err) { setError(err instanceof Error ? err.message : t.errors.unexpectedDescription); }
    finally { setPending(""); }
  }

  const reviewed = new Set(reviews.map((review) => review.appointmentId));
  const available = appointments.filter((appointment) => !reviewed.has(appointment.id));
  const card = "space-y-4 rounded-2xl border border-border-subtle bg-surface p-4 sm:p-6";
  return <>
    <section className={card}>
      <h2 className="text-title-sm font-bold text-ink">{es ? "Encuesta de satisfacción" : "Pesquisa de Satisfação"}</h2>
      <form className="space-y-3" onSubmit={(event) => {
        event.preventDefault();
        if (enabled === undefined) return;
        void run("save", async () => {
          await saveCompanySettings(session.company.id, { surveyEnabled: enabled });
          setEnabled(undefined);
          setStatus(t.common.profileUpdated);
        });
      }}>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input type="checkbox" role="switch" className="size-4 accent-accent" checked={enabled ?? settings.surveyEnabled} onChange={(event) => setEnabled(event.target.checked)} />
          {es ? "Activar encuesta después de la atención" : "Ativar pesquisa pós-atendimento"}
        </label>
        <Button type="submit" disabled={!!pending || enabled === undefined}>{t.common.save}</Button>
      </form>
      {settings.surveyEnabled && <div className="space-y-3 border-t border-border-subtle pt-4">
        <label className="grid gap-2 text-sm font-medium">
          {es ? "Atención completada" : "Atendimento concluído"}
          <select value={selected} onChange={(event) => { setSelected(event.target.value); setInvite(undefined); }}
            className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm">
            <option value="">{es ? "Selecciona una atención" : "Selecione um atendimento"}</option>
            {available.map((appointment) => <option key={appointment.id} value={appointment.id}>
              {appointment.serviceNameSnapshot} · {appointment.clientName} · {formatDateTimeInTimezone(appointment.startsAt, session.company.timezone, locale)}
            </option>)}
          </select>
        </label>
        <Button variant="outline" disabled={!selected || !!pending} onClick={() => void run("invite", async () => {
          const appointment = available.find((row) => row.id === selected);
          if (!appointment) return;
          const { token } = await apiRequest<{ token: string }>(`/companies/me/reviews/${appointment.id}`, { method: "POST" });
          const url = new URL(`/review/${token}`, window.location.origin).href;
          const whatsapp = clientWhatsAppUrl(appointment.clientPhone, session.company.timezone === "America/Caracas" ? "+58" : "+55");
          const message = es ? "¿Cómo fue tu atención? Evalúala aquí" : "Como foi seu atendimento? Avalie aqui";
          setInvite({ url, whatsapp: whatsapp ? `${whatsapp}?text=${encodeURIComponent(`${message} ${url}`)}` : null });
        })}>{es ? "Generar enlace de evaluación" : "Gerar link de avaliação"}</Button>
        {invite && <div className="flex flex-wrap gap-4 text-sm">
          <a className="font-semibold text-accent underline" href={invite.url} target="_blank" rel="noreferrer">{es ? "Abrir evaluación" : "Abrir avaliação"}</a>
          {invite.whatsapp && <a className="font-semibold text-accent underline" href={invite.whatsapp} target="_blank" rel="noreferrer">{es ? "Enviar por WhatsApp" : "Enviar pelo WhatsApp"}</a>}
        </div>}
      </div>}
    </section>
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-title-sm font-bold text-ink">{es ? "Evaluaciones recibidas" : "Avaliações recebidas"}</h2>
        {settings.rating && <span className="inline-flex items-center gap-1 text-sm font-semibold"><Star className="size-4 fill-amber-500 text-amber-500" />{settings.rating.average.toLocaleString(locale, { maximumFractionDigits: 1 })} · {settings.rating.count}</span>}
        <Button variant="outline" disabled={!!pending} onClick={() => void run("refresh", async () => {
          const [received] = await Promise.all([apiRequest<Review[]>("/companies/me/reviews"), refresh()]);
          setReviews(received);
        })}>{es ? "Actualizar" : "Atualizar"}</Button>
      </div>
      {reviews.length === 0 ? <p className="text-sm text-ink-secondary">{es ? "Aún no hay evaluaciones." : "Nenhuma avaliação recebida."}</p> : <ul className="divide-y divide-border-subtle">
        {reviews.map((review) => <li key={review.id} className="space-y-1 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{review.service || (es ? "Servicio sin identificar" : "Serviço sem identificação")}</span><span className="text-ink-secondary">★ {review.stars}/5</span></div>
          <p className="text-xs text-ink-muted">{formatDateTimeInTimezone(review.submittedAt, session.company.timezone, locale)}</p>
          {review.comment && <p className="whitespace-pre-wrap break-words text-ink-secondary">{review.comment}</p>}
        </li>)}
      </ul>}
    </section>
    <section className={card}>
      <h2 className="text-title-sm font-bold text-ink">Diagnóstico local</h2>
      <Button disabled={!!pending || !settings.rating} onClick={() => void run("analysis", async () => {
        setAnalysis(await apiRequest<Analysis>("/companies/me/reviews/analysis", { method: "POST", body: { locale } }));
      })}><Sparkles className="size-4" />{pending === "analysis" ? (es ? "Analizando…" : "Analisando…") : es ? "Analizar evaluaciones" : "Analisar avaliações"}</Button>
      {analysis && ([
        [es ? "Puntos fuertes" : "Pontos Fortes", analysis.strengths],
        [es ? "Puntos de atención" : "Pontos de Atenção", analysis.concerns],
        [es ? "3 acciones prácticas" : "3 Ações Práticas", analysis.actions],
      ] as const).map(([title, items]) => <div key={title} className="space-y-1">
        <h3 className="font-semibold">{title}</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-secondary">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
      </div>)}
    </section>
    {status && <p role="status" className="text-sm text-ink-secondary">{status}</p>}
    {error && <p role="alert" className="text-sm text-[var(--status-danger-ink)]">{error}</p>}
  </>;
}

