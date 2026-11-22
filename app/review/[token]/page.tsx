"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Star } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import { Button } from "@/components/ui/button";

export default function ReviewPage() {
  const { token } = useParams<{ token: string }>();
  const { locale } = useLocale();
  const es = locale === "es";
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  return <main className="mx-auto my-12 w-full max-w-md px-4">
    <section className="space-y-4 rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6">
      <h1 className="text-title-sm font-bold">{es ? "Evalúa tu atención" : "Avalie seu atendimento"}</h1>
      {sent ? <p role="status" className="text-sm text-ink-secondary">{es ? "Gracias por tu evaluación." : "Obrigado pela avaliação."}</p> :
        <form className="space-y-4" onSubmit={async (event) => {
          event.preventDefault();
          if (pending || !stars) return;
          setPending(true);
          setError("");
          try {
            await apiRequest(`/public/reviews/${encodeURIComponent(token)}`, { method: "POST", auth: false, body: { stars, comment: comment.trim() } });
            setSent(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : es ? "No se pudo enviar la evaluación." : "Não foi possível enviar a avaliação.");
          } finally { setPending(false); }
        }}>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{es ? "Calificación" : "Nota"}</legend>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => <label key={value}
                className="grid size-11 cursor-pointer place-items-center rounded-xl border border-border-subtle has-checked:border-accent has-checked:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
                <input type="radio" className="sr-only" name="rating" value={value} checked={stars === value} onChange={() => setStars(value)} aria-label={`${value} / 5`} required />
                <Star aria-hidden="true" className={`size-5 text-amber-600 ${value <= stars ? "fill-amber-400" : ""}`} />
              </label>)}
            </div>
          </fieldset>
          <label className="grid gap-1.5 text-sm font-medium">{es ? "Comentario (opcional)" : "Comentário (opcional)"}
            <textarea className="rounded-xl border border-border-strong bg-surface p-3" rows={4} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-[var(--status-danger-ink)]">{error}</p>}
          <Button type="submit" disabled={!stars || pending}>{es ? "Enviar evaluación" : "Enviar avaliação"}</Button>
        </form>}
    </section>
  </main>;
}

