"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ClientDataFields } from "@/components/ui/client-data-fields";
import { apiRequest } from "@/lib/api-client";
import { selectedClientFields } from "@/lib/company-settings";
import { useLocale } from "@/lib/i18n/locale-context";
import { useCompanySettings } from "@/lib/use-company-settings";
import type { ClientRecord } from "@/lib/use-clients";

type Registration = Pick<ClientRecord, "email" | "birthDate" | "document">;

export function ClientProfileFields({ companyId, client, onSaved }: {
  companyId: string; client: ClientRecord; onSaved: (values: Registration) => void;
}) {
  const { settings } = useCompanySettings(companyId, undefined, true, true);
  const { locale, t } = useLocale();
  const es = locale === "es";
  const [stored, setStored] = useState<Record<string, string> | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "loadError" | "saveError">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const path = `/companies/me/client-profiles/${encodeURIComponent(client.id)}`;
  const fields = selectedClientFields(settings);
  const values = {
    observations: client.notes ?? "", ...client.profileFields,
    email: client.email ?? "", birthDate: client.birthDate ?? "", document: client.document ?? "",
    ...stored, ...draft,
  } as Record<string, string>;

  useEffect(() => {
    const request = new AbortController();
    void apiRequest<{ values: Record<string, string> }>(path, { signal: request.signal }).then(({ values }) => {
      if (request.signal.aborted) return;
      setStored(values);
      setStatus("ready");
    }).catch(() => {
      if (!request.signal.aborted) setStatus("loadError");
    });
    return () => request.abort();
  }, [path, loadAttempt]);

  if (!fields.length) return <p className="text-sm text-ink-secondary">{es ? "No hay campos adicionales seleccionados." : "Nenhum campo adicional selecionado."}</p>;

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
    {stored && <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      setStatus("saving");
      const visibleValues = Object.fromEntries(fields.map(({ id }) => [id, values[id]?.trim() ?? ""]));
      try {
        const saved = await apiRequest<{ values: Record<string, string> }>(path, { method: "PATCH", body: { values: visibleValues } });
        setStored(saved.values);
        setDraft({});
        const registration: Registration = {};
        for (const id of ["email", "birthDate", "document"] as const) {
          if (Object.hasOwn(visibleValues, id)) registration[id] = visibleValues[id];
        }
        if (Object.keys(registration).length) onSaved(registration);
        setStatus("saved");
      } catch { setStatus("saveError"); }
    }}>
      <fieldset className="grid gap-3 sm:grid-cols-2" disabled={status === "saving"}>
        <ClientDataFields settings={settings} values={values} onChange={(next) => { setDraft(next); setStatus("ready"); }} fieldClass={inputClass} />
      </fieldset>
      <Button type="submit" className="min-h-11" disabled={status === "saving"}>{status === "saving" ? t.common.saving : t.common.save}</Button>
      {status === "saved" && <p role="status" className="text-sm text-ink-secondary">{es ? "Ficha guardada." : "Ficha salva."}</p>}
      {status === "saveError" && <p role="alert" className="text-sm">{error}</p>}
    </form>}
  </section>;
}

