"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Quote, Scissors } from "lucide-react";
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

function getAuthorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function RegisterForm() {
  const router = useRouter();
  const { t } = useLocale();

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

  // Duplica depoimentos para loop contínuo suave (marquee)
  const marqueeItems = [...t.auth.testimonials, ...t.auth.testimonials];

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
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="grid overflow-hidden rounded-3xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-xl lg:grid-cols-12"
    >
      {/* Coluna esquerda escura editorial inspirada em registerPage.png com marquee de depoimentos */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0F172A] px-8 py-10 text-white lg:col-span-6 lg:flex">
        {/* Glow sutil em azul/índigo (sem tons de marrom) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-[#2563EB]/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-[#6366F1]/20 blur-3xl"
        />

        <div className="relative z-10 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB] text-white">
            <Scissors className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="font-display text-lg tracking-tight text-white">
            Atelier Agenda
          </span>
        </div>

        <div className="relative z-10 my-6 space-y-3">
          <h2 className="font-display text-4xl leading-tight tracking-tight text-white">
            {t.auth.registerHeroTitle}
          </h2>
          <p className="text-sm leading-relaxed text-[#94A3B8] max-w-md">
            {t.auth.registerHeroSubtitle}
          </p>
        </div>

        {/* Carrossel / Marquee contínuo com depoimentos de Brasil e Venezuela */}
        <div className="relative z-10 -mx-8 overflow-hidden py-2">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#0F172A] to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#0F172A] to-transparent"
          />

          <motion.div
            className="flex gap-4 px-8"
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              duration: 38,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            {marqueeItems.map((item, idx) => (
              <article
                key={`${item.author}-${idx}`}
                className="w-72 shrink-0 rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-md flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <Quote
                    className="h-4 w-4 text-[#60A5FA]"
                    aria-hidden="true"
                  />
                  <p className="text-xs leading-relaxed text-[#E2E8F0]">
                    &ldquo;{item.quote}&rdquo;
                  </p>
                </div>

                <div className="flex items-center gap-3 border-t border-white/10 pt-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563EB]/25 text-xs font-bold text-[#93C5FD]">
                    {getAuthorInitials(item.author)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white">
                      {item.author}
                    </p>
                    <p className="truncate text-[11px] text-[#94A3B8]">
                      {item.role} · {item.location}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </motion.div>
        </div>
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
                  className="min-h-11 rounded-xl border-[#CBD5E1] bg-[#F8FAFC] px-3.5 text-[#0D0D0F] focus-visible:bg-white focus-visible:border-[#2563EB]"
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
                  className="min-h-11 rounded-xl border-[#CBD5E1] bg-[#F8FAFC] px-3.5 text-[#0D0D0F] focus-visible:bg-white focus-visible:border-[#2563EB]"
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
                className="min-h-11 w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 text-sm text-[#0D0D0F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
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
                  className="min-h-11 rounded-xl border-[#CBD5E1] bg-[#F8FAFC] pl-3.5 pr-11 text-[#0D0D0F] focus-visible:bg-white focus-visible:border-[#2563EB]"
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
              <p id="register-password-hint" className="text-[11px] text-[#64748B]">
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
              className="min-h-11 w-full rounded-xl bg-[#2563EB] text-sm font-semibold text-white shadow-md shadow-[#2563EB]/20 hover:bg-[#1D4ED8] cursor-pointer"
            >
              {submitting && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {t.auth.registerButton}
            </Button>
          </form>

          <p className="text-center text-sm text-[#475569]">
            {t.auth.hasAccount}{" "}
            <Link
              href="/login"
              className="font-semibold text-[#2563EB] hover:underline"
            >
              {t.auth.goToLogin}
            </Link>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
