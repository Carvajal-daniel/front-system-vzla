"use client";

import { clientFields, clientSources, type ClientFieldValues, type CompanySettings } from "@/lib/company-settings";
import type { Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/locale-context";

export function clientFieldLabels(locale: Locale) {
  return locale === "es"
    ? { birthDate: "Fecha de nacimiento", document: "CPF / C.I.", email: "Correo electrónico", gender: "Sexo / Género", source: "Origen del cliente" }
    : { birthDate: "Data de nascimento", document: "CPF / C.I.", email: "E-mail", gender: "Sexo / Gênero", source: "Origem do cliente" };
}

export function ClientDataFields({ modes, values, onChange, fieldClass, today }: {
  modes: CompanySettings["clientFields"];
  values: ClientFieldValues;
  onChange: (values: ClientFieldValues) => void;
  fieldClass: string;
  today?: string;
}) {
  const { locale } = useLocale();
  const es = locale === "es";
  const labels = clientFieldLabels(locale);
  const genders = es ? ["Femenino", "Masculino", "Otro"] : ["Feminino", "Masculino", "Outro"];
  const sources = es ? ["Instagram", "Recomendación", "Google", "Pasó por el local"] : ["Instagram", "Indicação", "Google", "Passou na frente"];
  return clientFields.filter((key) => modes[key] !== "hidden").map((key) => {
    const options = key === "gender" ? ["FEMALE", "MALE", "OTHER"] : key === "source" ? clientSources : null;
    const props = {
      className: fieldClass,
      required: modes[key] === "required",
      value: values[key],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...values, [key]: event.target.value }),
    };
    return <label key={key} className="grid min-w-0 gap-1.5 text-sm font-medium text-ink">
      <span>{labels[key]}{props.required ? " *" : ""}</span>
      {options ? <select {...props}>
        <option value="">{es ? "Seleccionar" : "Selecionar"}</option>
        {options.map((value, index) => <option key={value} value={value}>{(key === "gender" ? genders : sources)[index]}</option>)}
      </select> : <input {...props} type={key === "birthDate" ? "date" : key === "email" ? "email" : "text"}
        max={key === "birthDate" ? today : undefined} maxLength={key === "document" ? 32 : 254}
        autoComplete={key === "email" ? "email" : key === "birthDate" ? "bday" : "off"} />}
    </label>;
  });
}

