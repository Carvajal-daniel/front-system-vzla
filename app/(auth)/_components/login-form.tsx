"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  CalendarCheck2,
  Clock4,
  Eye,
  EyeOff,
  Globe2,
  Loader2,
  Lock,
  LogIn,
  Mail,
  Scissors,
  Users,
} from "lucide-react";
import { ApiError, apiRequest, extractAuthToken } from "@/lib/api-client";
import { setStoredToken } from "@/lib/auth";
import { useLocale } from "@/lib/i18n/locale-context";
import type {
  AuthTokenResponse,
  LoginPayload,
  MeResponse,
} from "@/lib/types/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();

  const expired = searchParams.get("reason") === "expired";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const features = [
    {
      icon: CalendarCheck2,
      title: t.auth.loginFeat1Title,
      desc: t.auth.loginFeat1Desc,
    },
    {
      icon: Users,
      title: t.auth.loginFeat2Title,
      desc: t.auth.loginFeat2Desc,
    },
    {
      icon: Clock4,
      title: t.auth.loginFeat3Title,
      desc: t.auth.loginFeat3Desc,
    },
    {
      icon: Globe2,
      title: t.auth.loginFeat4Title,
      desc: t.auth.loginFeat4Desc,
    },
  ];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload: LoginPayload = {
      email: email.trim(),
      password,
    };

    try {
      const authRes = await apiRequest<AuthTokenResponse>("/auth/login", {
        method: "POST",
        auth: false,
        body: payload,
      });

      const token = extractAuthToken(authRes);
      if (!token) {
        setError(t.errors.unauthorized);
        return;
      }

      setStoredToken(token);

      // Valida sessão e papel exclusivamente via GET /me na API Fastify
      const me = await apiRequest<MeResponse>("/me", {
        auth: true,
        token,
      });

      router.replace(me.role === "OWNER" ? "/owner" : "/collaborator");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(t.errors.unauthorized);
      } else {
        setError(
          err instanceof ApiError ? err.message : t.errors.networkDescription,
        );
      }
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
      {/* Coluna esquerda: Formulário limpo inspirado em loginPage.png */}
      <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:col-span-6 lg:px-12 lg:py-12">
        <div className="mx-auto w-full max-w-sm space-y-6">
          {/* Cabeçalho com grade geométrica sutil atrás do ícone */}
          <div className="relative flex flex-col items-center text-center">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-6 h-24 w-48 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #E2E8F0 1px, transparent 1px), linear-gradient(to bottom, #E2E8F0 1px, transparent 1px)",
                backgroundSize: "18px 18px",
                maskImage:
                  "radial-gradient(ellipse at center, black 35%, transparent 80%)",
              }}
            />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2563EB] text-white shadow-lg shadow-[#2563EB]/25">
              <LogIn className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-[#0D0D0F]">
              {t.auth.loginTitle}
            </h1>
            <p className="mt-1.5 text-sm text-[#475569]">
              {t.auth.loginSubtitle}
            </p>
          </div>

          {expired && !error && (
            <div
              role="status"
              className="rounded-xl border border-[#FCD34D] bg-[#FEF3C7] px-3.5 py-2.5 text-xs font-medium text-[#92400E]"
            >
              {t.errors.sessionExpired}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-xs font-semibold text-[#334155]">
                {t.auth.emailLabel}
              </Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                  aria-hidden="true"
                />
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="nome@barbearia.com"
                  className="min-h-11 rounded-xl border-[#CBD5E1] bg-[#FFFFFF] pl-10 pr-3.5 text-[#0D0D0F] placeholder:text-[#94A3B8] focus-visible:border-[#2563EB]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="text-xs font-semibold text-[#334155]">
                {t.auth.passwordLabel}
              </Label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                  aria-hidden="true"
                />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={1}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="min-h-11 rounded-xl border-[#CBD5E1] bg-[#FFFFFF] pl-10 pr-11 text-[#0D0D0F] placeholder:text-[#94A3B8] focus-visible:border-[#2563EB]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? t.auth.hidePassword : t.auth.showPassword
                  }
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0D0D0F] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
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
              {t.auth.loginButton}
            </Button>
          </form>

          <p className="text-center text-sm text-[#475569]">
            {t.auth.noAccount}{" "}
            <Link
              href="/register"
              className="font-semibold text-[#2563EB] hover:underline"
            >
              {t.auth.goToRegister}
            </Link>
          </p>
        </div>
      </div>

      {/* Coluna direita: Painel visual de destaque inspirado em loginPage.png */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#EFF6FF] via-[#E0ECFF] to-[#DBEAFE] p-8 lg:col-span-6 lg:flex lg:m-3 lg:rounded-2xl">
        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight text-[#0F172A]">
            {t.auth.loginHeroPrefix}{" "}
            <span className="text-[#2563EB]">{t.auth.loginHeroHighlight}</span>
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-[#475569] max-w-sm mx-auto">
            {t.auth.loginHeroCaption}
          </p>
        </div>

        {/* Composição orbital central com ícones do SaaS */}
        <div className="relative mx-auto my-6 flex h-56 w-56 items-center justify-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-[#2563EB]/15"
          />
          <span
            aria-hidden="true"
            className="absolute inset-6 rounded-full border border-[#2563EB]/20"
          />
          <span
            aria-hidden="true"
            className="absolute inset-12 rounded-full border border-[#2563EB]/25 bg-[#2563EB]/5"
          />

          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-xl shadow-[#2563EB]/35"
          >
            <Scissors className="h-7 w-7" aria-hidden="true" />
          </motion.div>

          <motion.span
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-1 left-1/2 -translate-x-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#2563EB] shadow-md"
          >
            <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
          </motion.span>
          <motion.span
            animate={{ y: [0, 6, 0] }}
            transition={{
              duration: 3.8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.4,
            }}
            className="absolute bottom-2 left-6 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0D9488] shadow-md"
          >
            <Users className="h-4 w-4" aria-hidden="true" />
          </motion.span>
          <motion.span
            animate={{ y: [0, -5, 0] }}
            transition={{
              duration: 3.6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.8,
            }}
            className="absolute top-12 right-1 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#7C3AED] shadow-md"
          >
            <Clock4 className="h-4 w-4" aria-hidden="true" />
          </motion.span>
          <motion.span
            animate={{ y: [0, 5, 0] }}
            transition={{
              duration: 4.1,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1.1,
            }}
            className="absolute bottom-6 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#E11D48] shadow-md"
          >
            <Globe2 className="h-4 w-4" aria-hidden="true" />
          </motion.span>
        </div>

        {/* Grade compacta de diferenciais */}
        <div className="grid grid-cols-2 gap-2.5">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + idx * 0.08, duration: 0.35 }}
                className="rounded-xl border border-white/80 bg-white/80 p-3 backdrop-blur-sm shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className="h-4 w-4 shrink-0 text-[#2563EB]"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-bold text-[#0F172A] truncate">
                    {feat.title}
                  </p>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-[#475569]">
                  {feat.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
