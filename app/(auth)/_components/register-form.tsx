"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Eye, EyeOff, Loader2, Scissors } from "lucide-react";
import { ApiError, apiRequest, extractAuthToken } from "@/lib/api-client";
import { setStoredToken } from "@/lib/auth";
import { formatPhoneToE164, isValidInternationalPhone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { IANA_TIMEZONES } from "@/lib/timezones";
import type {
  AuthTokenResponse,
  MeResponse,
  RegisterPayload,
} from "@/lib/types/auth";
import type { PhoneCountryCode } from "@/lib/types/public-booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";

export function RegisterForm() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const reducedMotion = useReducedMotion();

  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState<PhoneCountryCode>("+55");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const productHighlights =
    locale === "es"
      ? [
          "Agenda, comandas, comisiones, inventario y CRM en una sola plataforma.",
          "Reserva pública móvil sin registro con zona horaria oficial de tu negocio.",
          "Soporte nativo para Brasil (+55) y Venezuela (+58) en portugués y español.",
        ]
      : [
          "Agenda, comandas, comissões, estoque e CRM em uma única plataforma.",
          "Reserva pública mobile sem cadastro no fuso horário oficial do seu negócio.",
          "Suporte nativo para Brasil (+55) e Venezuela (+58) em português e espanhol.",
        ];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!isValidInternationalPhone(countryCode, phoneDigits)) {
      setError(t.errors.invalidPhone);
      return;
    }

    setSubmitting(true);

    const payload: RegisterPayload = {
      companyName: companyName.trim(),
      name: name.trim(),
      phone: formatPhoneToE164(countryCode, phoneDigits),
      email: email.trim(),
      password,
      timezone,
    };

    try {
      const authRes = await apiRequest<AuthTokenResponse>("/auth/register", {
        method: "POST",
        auth: false,
        body: payload,
      });

      const token = extractAuthToken(authRes);
      if (!token) {
        setError(t.errors.unexpectedDescription);
        return;
      }

      setStoredToken(token);

      const me = await apiRequest<MeResponse>("/me", {
        auth: true,
        token,
      });

      router.replace(me.role === "OWNER" ? "/owner" : "/collaborator");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t.errors.networkDescription,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.23, 1, 0.32, 1] }}
      className="grid overflow-hidden rounded-3xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-xl lg:grid-cols-12"
    >
      {/* Coluna esquerda escura editorial sem prova social fabricada (PRODUCT.md) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-accent px-8 py-10 text-accent-ink lg:col-span-6 lg:flex">
        <div className="relative z-10 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink">
            <Scissors className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-accent-ink">
            {t.common.appName}
          </span>
        </div>

        <div className="relative z-10 my-6 space-y-3">
          <h2 className="font-display text-4xl leading-tight tracking-tight text-accent-ink text-balance">
            {t.auth.registerHeroTitle}
          </h2>
          <p className="text-sm leading-relaxed text-accent-ink/70 max-w-md">
            {t.auth.registerHeroSubtitle}
          </p>
        </div>

        <ul className="relative z-10 space-y-3 border-t border-white/15 pt-6">
          {productHighlights.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-xs leading-relaxed text-accent-ink/90">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink/80" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Coluna direita: Formulário de cadastro limpo */}
      <div className="flex flex-col justify-center px-6 py-8 sm:px-10 lg:col-span-6 lg:px-12 lg:py-10">
        <div className="mx-auto w-full max-w-md space-y-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0D0D0F]">
              {t.auth.registerTitle}
            </h1>
            <p className="mt-1 text-sm text-[#475569]">
              {t.auth.registerSubtitle}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label
                  htmlFor="register-company"
                  className="text-xs font-semibold text-[#334155]"
                >
                  {t.auth.companyNameLabel}
                </Label>
                <Input
                  id="register-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  minLength={3}
                  maxLength={100}
                  className="min-h-11 rounded-xl border-[#CBD5E1] bg-[#F8FAFC] px-3.5 text-[#0D0D0F] focus-visible:bg-white focus-visible:border-[#0D0D0F]"
                />
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor="register-name"
                  className="text-xs font-semibold text-[#334155]"
                >
                  {t.auth.nameLabel}
                </Label>
                <Input
                  id="register-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  className="min-h-11 rounded-xl border-[#CBD5E1] bg-[#F8FAFC] px-3.5 text-[#0D0D0F] focus-visible:bg-white focus-visible:border-[#0D0D0F]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label
                htmlFor="register-email"
                className="text-xs font-semibold text-[#334155]"
              >
                {t.auth.emailLabel}
              </Label>
              <Input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="min-h-11 rounded-xl border-[#CBD5E1] bg-[#F8FAFC] px-3.5 text-[#0D0D0F] focus-visible:bg-white focus-visible:border-[#2563EB]"
              />
            </div>

            <PhoneInput
              id="register-phone"
              label={t.auth.phoneLabel}
              countryCode={countryCode}
              value={phoneDigits}
              onCountryCodeChange={(next) => {
                setCountryCode(next);
                if (next === "+58" && timezone === "America/Sao_Paulo") {
                  setTimezone("America/Caracas");
                } else if (next === "+55" && timezone === "America/Caracas") {
                  setTimezone("America/Sao_Paulo");
                }
              }}
              onChange={setPhoneDigits}
            />

            <div className="space-y-1">
              <Label
                htmlFor="register-timezone"
                className="text-xs font-semibold text-[#334155]"
              >
                {t.auth.timezoneLabel}
              </Label>
              <select
                id="register-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 text-sm text-[#0D0D0F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D0D0F]/20"
              >
                {IANA_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label
                htmlFor="register-password"
                className="text-xs font-semibold text-[#334155]"
              >
                {t.auth.passwordLabel}
              </Label>
              <div className="relative">
                <Input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  maxLength={15}
                  autoComplete="new-password"
                  aria-describedby="register-password-hint"
                  className="min-h-11 rounded-xl border-[#CBD5E1] bg-[#F8FAFC] pl-3.5 pr-11 text-[#0D0D0F] focus-visible:bg-white focus-visible:border-[#0D0D0F]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? t.auth.hidePassword : t.auth.showPassword
                  }
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0D0D0F] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              <p id="register-password-hint" className="text-xs text-[#64748B]">
                {t.auth.passwordHint}
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-ink hover:bg-accent-hover cursor-pointer"
            >
              {submitting && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {t.auth.registerButton}
            </Button>
          </form>

          <p className="text-center text-sm text-ink-secondary">
            {t.auth.hasAccount}{" "}
            <Link
              href="/login"
              className="font-semibold text-ink underline underline-offset-4 hover:text-ink-secondary"
            >
              {t.auth.goToLogin}
            </Link>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
