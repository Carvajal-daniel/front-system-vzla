"use client";

import { selectedClientFields, type ClientFieldValues, type CompanySettings } from "@/lib/company-settings";
import { useLocale } from "@/lib/i18n/locale-context";

export function ClientDataFields({ settings, values, onChange, fieldClass, today, include }: {
  settings: CompanySettings;
  values: ClientFieldValues;
  onChange: (values: ClientFieldValues) => void;
  fieldClass: string;
  today?: string;
  include?: (id: string) => boolean;
}) {
  const { locale } = useLocale();
  const es = locale === "es";
  return selectedClientFields(settings, es).filter(({ id }) => !include || include(id)).map(({ id, label, required }) => {
    const props = {
      className: fieldClass, required, value: values[id] ?? "",
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        onChange({ ...values, [id]: event.target.value }),
    };
    const notes = ["observations", "allergyNotes", "pathologyNotes", "currentTreatments"].includes(id);
    return <label key={id} className="grid min-w-0 gap-1.5 text-sm font-medium text-ink">
      <span>{label}{required ? " *" : ""}</span>
      {id === "medication" || id === "soughtDoctor" ? <select {...props}>
        <option value="">{es ? "Seleccionar" : "Selecionar"}</option>
        <option value="yes">{es ? "Sí" : "Sim"}</option>
        <option value="no">{es ? "No" : "Não"}</option>
      </select> : notes ? <textarea {...props} className={fieldClass + " min-h-20 py-2"} rows={3} maxLength={2500} />
        : <input {...props} type={id === "birthDate" ? "date" : id === "email" ? "email" : "text"}
          max={id === "birthDate" ? today : undefined} maxLength={id === "document" ? 32 : id === "email" ? 254 : 400}
          inputMode={id === "clientPostalCode" ? "numeric" : undefined}
          autoComplete={id === "email" ? "email" : id === "birthDate" ? "bday" : "off"} />}
    </label>;
  });
}

