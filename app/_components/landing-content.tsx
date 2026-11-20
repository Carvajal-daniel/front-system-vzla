"use client";

import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CalendarCheck2,
  CheckCircle2,
  Globe2,
  Scissors,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import {
  FadeInUp,
  MotionCard,
  ParallaxCard,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/motion";

export function LandingContent() {
  const { t } = useLocale();

  return (
    <div className="min-h-dvh flex flex-col bg-[#FFFFFF] text-[#0B0B0D]">
      {/* Navbar minimalista fixa com blur, logo, LocaleSwitcher (PT/ES) e botões pill */}
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0]/80 bg-[#FFFFFF]/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2.5 text-[#0B0B0D]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0B0B0D] text-white shadow-xs">
              <Scissors className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-base font-bold tracking-tight">
              {t.common.appName}
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <LocaleSwitcher />
            <Link
              href="/login"
              className="hidden sm:inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold text-[#0B0B0D] transition-colors hover:bg-[#F1F5F9]"
            >
              {t.landing.navLogin}
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#0B0B0D] px-5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] hover:bg-[#27272A] active:scale-[0.98]"
            >
              {t.landing.navGetStarted}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Editorial + Cards Flutuantes com Parallax real (Framer Motion) */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:py-24">
          <FadeInUp className="space-y-6 lg:col-span-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-1.5 text-xs font-semibold text-[#0B0B0D]">
              <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t.landing.badge}
            </p>

            <h1 className="text-display-lg text-[#0B0B0D]">
              {t.landing.heroTitlePrefix}{" "}
              <em className="italic">{t.landing.heroTitleItalic}</em>{" "}
              {t.landing.heroTitleSuffix}
            </h1>

            <p className="max-w-xl text-base sm:text-lg text-[#475569] leading-relaxed">
              {t.landing.heroSubtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/register"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0B0B0D] px-7 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.02] hover:bg-[#27272A] active:scale-[0.98]"
              >
                {t.landing.heroCtaPrimary}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#CBD5E1] bg-white px-7 text-sm font-semibold text-[#0B0B0D] transition-colors hover:bg-[#F8FAFC]"
              >
                {t.landing.heroCtaSecondary}
              </Link>
            </div>
          </FadeInUp>

          {/* Cards Flutuantes em Parallax inspirados em front.jpg */}
          <div className="relative lg:col-span-5 space-y-4">
            <ParallaxCard offset={26}>
              <MotionCard className="rounded-2xl border border-[#27272A] bg-[#0B0B0D] p-5 text-white shadow-[0_20px_50px_-18px_rgba(11,11,13,0.45)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t.landing.cardConfirmedBadge}
                  </span>
                  <span className="font-mono text-xs text-zinc-400 tabular-nums">
                    +55 · +58
                  </span>
                </div>
                <p className="mt-3 text-base font-bold">
                  {t.landing.cardServiceSample}
                </p>
                <p className="mt-1 font-mono text-xs text-zinc-300 tabular-nums">
                  14:30 · America/Sao_Paulo
                </p>
              </MotionCard>
            </ParallaxCard>

            <div className="grid grid-cols-2 gap-4">
              <ParallaxCard offset={-18}>
                <MotionCard className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.14)]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                    {t.landing.cardSlotsTitle}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-xs tabular-nums">
                    <span className="rounded-lg border border-[#E2E8F0] py-1.5 text-center text-[#0B0B0D]">
                      10:00
                    </span>
                    <span className="rounded-lg bg-[#0B0B0D] py-1.5 text-center font-bold text-white">
                      11:30
                    </span>
                    <span className="rounded-lg border border-[#E2E8F0] py-1.5 text-center text-[#0B0B0D]">
                      14:00
                    </span>
                    <span className="rounded-lg border border-[#E2E8F0] py-1.5 text-center text-[#0B0B0D]">
                      16:30
                    </span>
                  </div>
                </MotionCard>
              </ParallaxCard>

              <ParallaxCard offset={-30}>
                <MotionCard className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.12)] flex flex-col justify-between h-full">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                    {t.landing.cardTeamTitle}
                  </p>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#0B0B0D]">Lucas</span>
                      <span className="font-mono text-[#475569] tabular-nums">
                        50%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#0B0B0D]">
                        Camila
                      </span>
                      <span className="font-mono text-[#475569] tabular-nums">
                        45%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#0B0B0D]">Mateo</span>
                      <span className="font-mono text-[#475569] tabular-nums">
                        40%
                      </span>
                    </div>
                  </div>
                </MotionCard>
              </ParallaxCard>
            </div>
          </div>
        </section>

        {/* Seção de Alto Contraste Escura (#0B0B0D) com métricas de impacto */}
        <section className="bg-[#0B0B0D] py-16 sm:py-24 text-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-12">
            <FadeInUp className="max-w-2xl space-y-3">
              <h2 className="text-display-md text-white">
                {t.landing.metricsHeading}
              </h2>
              <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
                {t.landing.metricsSubtitle}
              </p>
            </FadeInUp>

            <StaggerContainer className="grid gap-4 sm:grid-cols-3">
              <StaggerItem>
                <div className="h-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                  <p className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-white tabular-nums">
                    {t.landing.metric1Value}
                  </p>
                  <p className="mt-3 text-sm text-zinc-400">
                    {t.landing.metric1Label}
                  </p>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className="h-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                  <p className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-white tabular-nums">
                    {t.landing.metric2Value}
                  </p>
                  <p className="mt-3 text-sm text-zinc-400">
                    {t.landing.metric2Label}
                  </p>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className="h-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                  <p className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-white tabular-nums">
                    {t.landing.metric3Value}
                  </p>
                  <p className="mt-3 text-sm text-zinc-400">
                    {t.landing.metric3Label}
                  </p>
                </div>
              </StaggerItem>
            </StaggerContainer>
          </div>
        </section>

        {/* Bento Grid de Funcionalidades com micro-interfaces ilustradas */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 space-y-10">
          <FadeInUp className="max-w-2xl space-y-2">
            <h2 className="text-display-md text-[#0B0B0D]">
              {t.landing.bentoTitle}
            </h2>
            <p className="text-sm sm:text-base text-[#475569]">
              {t.landing.bentoSubtitle}
            </p>
          </FadeInUp>

          <StaggerContainer className="grid gap-4 sm:grid-cols-2">
            <StaggerItem>
              <MotionCard className="h-full rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0B0B0D] text-white">
                  <CalendarCheck2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0B0B0D]">
                    {t.landing.bento1Title}
                  </h3>
                  <p className="mt-1.5 text-sm text-[#475569]">
                    {t.landing.bento1Desc}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-2.5 font-mono text-xs text-[#0B0B0D] flex items-center justify-between">
                  <span>/book/atelier-studio</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    24/7
                  </span>
                </div>
              </MotionCard>
            </StaggerItem>

            <StaggerItem>
              <MotionCard className="h-full rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0B0B0D] text-white">
                  <Users className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0B0B0D]">
                    {t.landing.bento2Title}
                  </h3>
                  <p className="mt-1.5 text-sm text-[#475569]">
                    {t.landing.bento2Desc}
                  </p>
                </div>
                <div className="flex gap-2 font-mono text-xs tabular-nums">
                  <span className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1 font-semibold">
                    OWNER
                  </span>
                  <span className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1 font-semibold">
                    COLLABORATOR
                  </span>
                </div>
              </MotionCard>
            </StaggerItem>

            <StaggerItem>
              <MotionCard className="h-full rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0B0B0D] text-white">
                  <Ban className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0B0B0D]">
                    {t.landing.bento3Title}
                  </h3>
                  <p className="mt-1.5 text-sm text-[#475569]">
                    {t.landing.bento3Desc}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900">
                  {t.conflicts.singleAffected} · 15:00
                </div>
              </MotionCard>
            </StaggerItem>

            <StaggerItem>
              <MotionCard className="h-full rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0B0B0D] text-white">
                  <Globe2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0B0B0D]">
                    {t.landing.bento4Title}
                  </h3>
                  <p className="mt-1.5 text-sm text-[#475569]">
                    {t.landing.bento4Desc}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 font-mono text-xs tabular-nums">
                  <span className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1">
                    BR +55 · America/Sao_Paulo
                  </span>
                  <span className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1">
                    VE +58 · America/Caracas
                  </span>
                </div>
              </MotionCard>
            </StaggerItem>
          </StaggerContainer>
        </section>

        {/* CTA Final Editorial */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <FadeInUp>
            <div className="rounded-3xl bg-[#0B0B0D] px-6 py-14 sm:py-18 text-center text-white space-y-5 shadow-xl">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <ShieldCheck className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <h2 className="text-display-md text-white">
                {t.landing.ctaTitle}
              </h2>
              <p className="mx-auto max-w-lg text-sm sm:text-base text-zinc-400">
                {t.landing.ctaSubtitle}
              </p>
              <div className="pt-2">
                <Link
                  href="/register"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-bold text-[#0B0B0D] transition-transform hover:scale-[1.02] hover:bg-zinc-200 active:scale-[0.98]"
                >
                  {t.landing.ctaButton}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </FadeInUp>
        </section>
      </main>

      <footer className="border-t border-[#E2E8F0] bg-[#FFFFFF] py-8">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 text-xs text-[#64748B]">
          <p>{t.landing.footerTagline}</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-[#0B0B0D] font-medium">
              {t.landing.navLogin}
            </Link>
            <Link href="/register" className="hover:text-[#0B0B0D] font-medium">
              {t.landing.navGetStarted}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
