"use client";

import { useLocale } from "@/lib/i18n/locale-context";
import { formatNationalPhoneDisplay, stripNonDigits } from "@/lib/format";
import type { PhoneCountryCode } from "@/lib/types/public-booking";

export interface PhoneInputProps {
  id: string;
  label: string;
  countryCode: PhoneCountryCode;
  value: string;
  onCountryCodeChange: (code: PhoneCountryCode) => void;
  onChange: (rawDigits: string) => void;
  error?: string;
  disabled?: boolean;
  countries?: readonly PhoneCountryCode[];
}

const countryLabels: Record<PhoneCountryCode, string> = {
  "+55": "BR +55", "+58": "VE +58", "+1": "US/CA +1", "+34": "ES +34", "+351": "PT +351",
};
export function PhoneInput({
  id,
  label,
  countryCode,
  value,
  onCountryCodeChange,
  onChange,
  error,
  disabled,
  countries = ["+55", "+58"],
}: PhoneInputProps) {
  const { t } = useLocale();
  const displayValue = formatNationalPhoneDisplay(countryCode, value);
  const placeholder =
    countryCode === "+55" ? t.phone.placeholderBR : countryCode === "+58" ? t.phone.placeholderVE : undefined;

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="flex gap-2">
        <select
          aria-label={t.phone.countryLabel}
          value={countryCode}
          disabled={disabled}
          onChange={(e) =>
            onCountryCodeChange(e.target.value as PhoneCountryCode)
          }
          className="min-h-11 rounded-xl border border-border-strong bg-surface px-2.5 text-sm font-medium text-ink tabular-nums"
        >
          {countries.map((code) => <option key={code} value={code}>{countryLabels[code]}</option>)}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          disabled={disabled}
          value={displayValue}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            const maxDigits = countryCode === "+55" || countryCode === "+58" ? 11 : countryCode === "+1" ? 10 : 9;
            const digits = stripNonDigits(e.target.value).slice(0, maxDigits);
            onChange(digits);
          }}
          className={[
            "min-h-11 min-w-0 flex-1 rounded-xl border bg-surface px-3.5 text-sm text-ink tabular-nums",
            "placeholder:text-ink-muted transition-colors",
            error
              ? "border-[var(--status-danger-ink)]"
              : "border-border-strong focus:border-accent",
          ].join(" ")}
        />
      </div>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs font-medium text-[var(--status-danger-ink)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
