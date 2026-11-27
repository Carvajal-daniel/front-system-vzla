"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ShieldCheck, Sparkles, Star } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { defaultCompanySettings } from "@/lib/company-settings";
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
  const { settings, refresh } = useCompanySettings(
    session.company.id,
    defaultCompanySettings,
    true,
    true,
  );
  const { locale, t } = useLocale();
  const es = locale === "es";
  const [enabled, setEnabled] = useState<boolean>();
  const [postVisitEnabled, setPostVisitEnabled] = useState<boolean>();
  const [googleReviewUrlInput, setGoogleReviewUrlInput] = useState<string>();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invitationReviews, setInvitationReviews] = useState<Review[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [stars, setStars] = useState<number>();
  const [limit, setLimit] = useState(5);
  const [revision, setRevision] = useState(0);
  const [reviewsError, setReviewsError] = useState("");
  const [result, setResult] = useState<{ stars?: number; revision: number; limit: number; reviews: Review[] }>();
  const reviews = result?.stars === stars && result?.revision === revision ? result.reviews : undefined;
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
      setInvitationReviews(received);
    }).catch(() => {
      if (!signal.aborted) setError(t.errors.networkDescription);
    });
    return () => request.abort();
  }, [t.errors.networkDescription]);

  useEffect(() => {
    if (!expanded) return;
    const request = new AbortController();
    const { signal } = request;
    void apiRequest<Review[]>("/companies/me/reviews", { query: { stars, limit: limit + 1 }, signal })
      .then((received) => {
        if (!signal.aborted) setResult({ stars, revision, limit, reviews: received });
      }).catch(() => {
        if (!signal.aborted) setReviewsError(t.errors.networkDescription);
      });
    return () => request.abort();
  }, [expanded, stars, limit, revision, t.errors.networkDescription]);

  async function run(action: string, fn: () => Promise<void>) {
    setPending(action);
    setError("");
    setStatus("");
    try { await fn(); }
    catch (err) { setError(err instanceof Error ? err.message : t.errors.unexpectedDescription); }
    finally { setPending(""); }
  }

  const currentPostVisit = postVisitEnabled ?? settings.enablePostVisitSurvey ?? true;
  const currentGoogleReviewUrl = googleReviewUrlInput ?? settings.googleReviewUrl ?? "";
  const hasSurveyChanges =
    enabled !== undefined ||
    postVisitEnabled !== undefined ||
    googleReviewUrlInput !== undefined;

  const reviewed = new Set(invitationReviews.map((review) => review.appointmentId));
  const available = appointments.filter((appointment) => !reviewed.has(appointment.id));
  const card = "space-y-4 rounded-2xl border border-border-subtle bg-surface p-4 sm:p-6";
  return <>
    <section className={card}>
      <h2 className="text-title-sm font-bold text-ink">{es ? "Encuesta de satisfacción" : "Pesquisa de Satisfação"}</h2>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        if (!hasSurveyChanges) return;
        const trimmedUrl = currentGoogleReviewUrl.trim();
        if (trimmedUrl) {
          try {
            new URL(trimmedUrl);
          } catch {
            setError(es ? "Ingresa una URL válida de Google Maps." : "Informe uma URL válida do Google Maps (ex.: https://g.page/r/...).");
            return;
          }
        }
        void run("save", async () => {
          await saveCompanySettings(session.company.id, {
            ...(enabled !== undefined ? { surveyEnabled: enabled } : {}),
            enablePostVisitSurvey: currentPostVisit,
            googleReviewUrl: trimmedUrl ? trimmedUrl : null,
          });
          setEnabled(undefined);
          setPostVisitEnabled(undefined);
          setGoogleReviewUrlInput(undefined);
          setStatus(t.common.profileUpdated);
        });
      }}>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
          <input type="checkbox" role="switch" className="size-4 cursor-pointer accent-accent" checked={enabled ?? settings.surveyEnabled} onChange={(event) => setEnabled(event.target.checked)} />
          {es ? "Activar encuesta manual por enlace" : "Ativar pesquisa manual por link"}
        </label>

        {/* Blindagem de Reputação: Pesquisa Pós-Atendimento via WhatsApp + Link Google Maps */}
        <div className="space-y-3 rounded-xl border border-border-subtle bg-canvas/50 p-3.5">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-ink">
                {es ? "Blindaje de reputación (WhatsApp)" : "Blindagem de Reputação (Pós-Atendimento WhatsApp)"}
              </p>
              <p className="text-xs text-ink-secondary">
                {es
                  ? "Envía la encuesta 2h después del cierre. Notas 1–3 se retienen y alertan al dueño; nota 5 invita a evaluar en Google Maps."
                  : "Dispara pesquisa automática 2h após o fechamento da comanda. Notas 1 a 3 ficam retidas com alerta no painel do dono; nota 5 recebe o link do Google Maps."}
              </p>
            </div>
          </div>

          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              role="switch"
              className="size-4 cursor-pointer accent-accent"
              checked={currentPostVisit}
              onChange={(event) => setPostVisitEnabled(event.target.checked)}
            />
            {es ? "Activar encuesta automática post-atención" : "Ativar pesquisa automática pós-atendimento"}
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-ink">
            <span className="flex items-center justify-between gap-2">
              <span>{es ? "Enlace de reseña en Google Maps (para nota 5)" : "Link de avaliação no Google Maps (para notas 5)"}</span>
              {currentGoogleReviewUrl.trim() && (
                <a
                  href={currentGoogleReviewUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  {es ? "Probar enlace" : "Testar link"}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              )}
            </span>
            <input
              type="url"
              value={currentGoogleReviewUrl}
              onChange={(event) => setGoogleReviewUrlInput(event.target.value)}
              placeholder="https://g.page/r/sua-barbearia/review"
              maxLength={500}
              className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm font-normal text-ink outline-none focus-visible:border-accent"
            />
          </label>
        </div>

        <Button className="cursor-pointer" type="submit" disabled={!!pending || !hasSurveyChanges}>{t.common.save}</Button>
      </form>
      {settings.surveyEnabled && <div className="space-y-3 border-t border-border-subtle pt-4">
        <label className="grid gap-2 text-sm font-medium">
          {es ? "Atención completada" : "Atendimento concluído"}
          <select value={selected} onChange={(event) => { setSelected(event.target.value); setInvite(undefined); }}
            className="min-h-11 w-full cursor-pointer rounded-xl border border-border-strong bg-surface px-3 text-sm">
            <option value="">{es ? "Selecciona una atención" : "Selecione um atendimento"}</option>
            {available.map((appointment) => <option key={appointment.id} value={appointment.id}>
              {appointment.serviceNameSnapshot} · {appointment.clientName} · {formatDateTimeInTimezone(appointment.startsAt, session.company.timezone, locale)}
            </option>)}
          </select>
        </label>
        <Button className="cursor-pointer" variant="outline" disabled={!selected || !!pending} onClick={() => void run("invite", async () => {
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
        <span className="inline-flex items-center gap-1 text-sm font-semibold">
          <Star aria-hidden="true" className="size-4 fill-amber-500 text-amber-500" />
          {settings.rating?.average.toLocaleString(locale, { maximumFractionDigits: 1 }) ?? "—"} · {settings.rating?.count ?? 0}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button className="cursor-pointer" variant="outline" disabled={!!pending} onClick={() => void run("refresh", async () => {
            const [received] = await Promise.all([apiRequest<Review[]>("/companies/me/reviews"), refresh()]);
            setInvitationReviews(received);
            setReviewsError("");
            setRevision((value) => value + 1);
          })}>{es ? "Actualizar" : "Atualizar"}</Button>
          <Button className="cursor-pointer" variant="outline" aria-expanded={expanded} aria-controls="received-reviews"
            onClick={() => { setReviewsError(""); setExpanded((value) => !value); }}>
            {expanded ? (es ? "Ocultar evaluaciones" : "Ocultar avaliações") : (es ? "Ver evaluaciones" : "Ver avaliações")}
          </Button>
        </div>
      </div>
      <div id="received-reviews" hidden={!expanded} className="space-y-3">
        {expanded && <>
          <div className="flex flex-wrap gap-2" role="group" aria-label={es ? "Filtrar por estrellas" : "Filtrar por estrelas"}>
            {[undefined, 5, 4, 3, 2, 1].map((value) => <Button key={value ?? "all"} className="min-h-9 cursor-pointer rounded-full"
              variant={stars === value ? "default" : "outline"} aria-pressed={stars === value}
              onClick={() => {
                if (stars !== value || reviewsError) setRevision((current) => current + 1);
                setReviewsError("");
                setStars(value);
                setLimit(5);
              }}>
              {value === undefined ? "Todas" : `${value} ★`}
            </Button>)}
          </div>
          {!reviews ? (!reviewsError && <p role="status" className="text-sm text-ink-secondary">{es ? "Cargando evaluaciones…" : "Carregando avaliações…"}</p>)
            : reviews.length === 0 ? <p className="text-sm text-ink-secondary">{es ? "No hay evaluaciones para mostrar." : "Nenhuma avaliação para exibir."}</p>
            : <ul className="divide-y divide-border-subtle">
              {reviews.slice(0, limit).map((review) => <li key={review.id} className="space-y-1 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{review.service || (es ? "Servicio sin identificar" : "Serviço sem identificação")}</span><span className="text-ink-secondary">★ {review.stars}/5</span></div>
                <p className="text-xs text-ink-muted">{formatDateTimeInTimezone(review.submittedAt, session.company.timezone, locale)}</p>
                {review.comment && <p className="whitespace-pre-wrap break-words text-ink-secondary">{review.comment}</p>}
              </li>)}
            </ul>}
          {reviews && (reviews.length > limit || (result && result.limit < limit)) && <Button className="cursor-pointer" variant="outline"
            disabled={result?.limit !== limit && !reviewsError} onClick={() => {
              if (result?.limit === limit) setLimit((value) => value + 5);
              else setRevision((value) => value + 1);
              setReviewsError("");
            }}>{es ? "Cargar más" : "Carregar mais"}</Button>}
          {reviewsError && <p role="alert" className="text-sm text-[var(--status-danger-ink)]">{reviewsError}</p>}
        </>}
      </div>
    </section>
    <section className={card}>
      <h2 className="text-title-sm font-bold text-ink">Diagnóstico local</h2>
      <Button className="cursor-pointer" disabled={!!pending || !settings.rating} onClick={() => void run("analysis", async () => {
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

