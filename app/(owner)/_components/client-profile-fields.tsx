"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";
import { profileFieldLabels } from "@/lib/company-settings";
import { useLocale } from "@/lib/i18n/locale-context";
import { useCompanySettings } from "@/lib/use-company-settings";

export function ClientProfileFields({ companyId, clientId }: { companyId: string; clientId: string }) {
  const { settings } = useCompanySettings(companyId, undefined, true, true);
  const { locale, t } = useLocale();
  const es = locale === "es";
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "loadError" | "saveError">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const path = `/companies/me/client-profiles/${encodeURIComponent(clientId)}`;
  const fields = [
    ...Object.entries(profileFieldLabels).map(([id, labels]) => ({ id, label: labels[es ? 1 : 0], mode: settings.clientFields[id] ?? "optional" })),
    ...settings.customClientFields,
  ].filter((field) => field.mode !== "hidden");

  useEffect(() => {
    const request = new AbortController();
    void apiRequest<{ values: Record<string, string> }>(path, { signal: request.signal }).then(({ values }) => {
      if (request.signal.aborted) return;
      setValues(values);
      setStatus("ready");
    }).catch(() => {
      if (!request.signal.aborted) setStatus("loadError");
    });
    return () => request.abort();
  }, [path, loadAttempt]);

  const inputClass = "min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink";
  const error = es ? "No se pudieron sincronizar los campos de la ficha." : "Não foi possível sincronizar os campos da ficha.";

  return <section className="space-y-4 rounded-2xl border border-border-subtle bg-surface p-5">
    <h3 className="text-sm font-bold text-ink">{es ? "Campos de la ficha" : "Campos da ficha"}</h3>
    {status === "loading" && <p role="status" className="text-sm text-ink-secondary">{es ? "Cargando ficha…" : "Carregando ficha…"}</p>}
    {status === "loadError" && <div className="space-y-2">
      <p role="alert" className="text-sm">{error}</p>
      <Button type="button" variant="outline" onClick={() => { setStatus("loading"); setLoadAttempt((value) => value + 1); }}>
        {es ? "Reintentar" : "Tentar novamente"}
      </Button>
    </div>}
    {values && fields.length > 0 && <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      setStatus("saving");
      try {
        const visibleValues = Object.fromEntries(fields.map(({ id }) => [id, values[id] ?? ""]));
        const saved = await apiRequest<{ values: Record<string, string> }>(path, { method: "PATCH", body: { values: visibleValues } });
        setValues(saved.values);
        setStatus("saved");
      } catch { setStatus("saveError"); }
    }}>
      <fieldset className="grid gap-3 sm:grid-cols-2" disabled={status === "saving"}>
        {fields.map(({ id, label, mode }) => {
          const props = {
            className: inputClass, value: values[id] ?? "", required: mode === "required",
            onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
              setStatus("ready");
              setValues({ ...values, [id]: event.target.value });
            },
          };
          return <label key={id} className="grid gap-1.5 text-sm font-medium text-ink">
            {label}{props.required ? " *" : ""}
            {id === "medication" ? <select {...props}>
              <option value="">{es ? "Seleccionar" : "Selecionar"}</option>
              <option value="yes">{es ? "Sí" : "Sim"}</option>
              <option value="no">{es ? "No" : "Não"}</option>
            </select> : ["observations", "allergyNotes", "currentTreatments"].includes(id)
              ? <textarea {...props} className={inputClass + " py-2"} rows={3} maxLength={2500} />
              : <input {...props} maxLength={400} inputMode={id === "clientPostalCode" ? "numeric" : undefined} />}
          </label>;
        })}
      </fieldset>
      <Button type="submit" className="min-h-11" disabled={status === "saving"}>{status === "saving" ? t.common.saving : t.common.save}</Button>
      {status === "saved" && <p role="status" className="text-sm text-ink-secondary">{es ? "Ficha guardada." : "Ficha salva."}</p>}
      {status === "saveError" && <p role="alert" className="text-sm">{error}</p>}
    </form>}
  </section>;
}

