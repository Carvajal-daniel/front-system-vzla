# Implementation Plan: Etapa 4 — Frontend Web (Painel Owner, Portal Colaborador e Reserva Pública)

**Branch**: `001-frontend-web-app` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-frontend-web-app/spec.md`

## Summary

Construir a aplicação web Next.js 16 (App Router) do SaaS de Gestão de Barbearias e Salões cobrindo: (1) Reserva Pública mobile-first em etapas (`/book/[companyId]`) com Server Component + `<Suspense>` e `not-found.tsx` para `404`; (2) Autenticação unificada (`/login`, `/register`) via JWT Bearer retornado pela API Fastify (`NEXT_PUBLIC_API_URL`) e roteamento por papel via `GET /me`; (3) Painel do Owner (`/owner/*`) com 5 módulos (Agenda, Bloqueios, Equipe, Serviços/Comissões/Horários, Configurações); (4) Portal do Colaborador (`/collaborator/*`) com 4 módulos; e (5) Suporte multi-país nativo Brasil (`pt-BR` / `+55`) e Venezuela (`es` / `+58`) com formatação determinística no `timezone` da empresa e zero erros de hidratação.

## Technical Context

**Language/Version**: TypeScript `^5` (`strict: true`), Next.js `16.4.6` (App Router), React `19.3.0`
**Primary Dependencies**: `next@16.4.6`, `react@19.3.0`, `react-dom@19.3.0`, `tailwindcss@4.3.3`, `@tailwindcss/turbopack@4.3.3`, `lucide-react` (a instalar na fase de implementação conforme Constituição v1.0.0)
**Storage**: N/A no frontend — toda persistência reside na API Fastify externa (`NEXT_PUBLIC_API_URL=http://localhost:3333`); sessão JWT Bearer mantida apenas no navegador (lida exclusivamente em `useEffect` pós-montagem)
**Testing**: Verificação estática obrigatória (`npx tsc --noEmit`, `npm run lint`, `npm run build`) + validação end-to-end manual/navegador em `320px`, `375px`, `768px` e `1440px` conforme `quickstart.md`
**Target Platform**: Web responsiva mobile-first (`320px`–`1440px`), navegadores modernos (Chrome, Safari iOS, Android Chrome, Edge, Firefox)
**Project Type**: Web application (Frontend Next.js App Router consumindo API REST externa)
**Performance Goals**: Lighthouse mobile Performance ≥ 90, Acessibilidade ≥ 95, Boas Práticas ≥ 95, SEO ≥ 90 (rotas públicas); LCP ≤ 2,5 s, CLS ≤ 0,1, INP ≤ 200 ms; fluxo de reserva pública < 90 s em `375px`
**Constraints**: `cacheComponents: true` e `partialPrefetching: true` ativos em `next.config.ts`; proibido Server Actions/Route Handlers com lógica de negócio; zero erros de hidratação; WCAG 2.2 AA; alvos de toque ≥ `44px`; `tabular-nums` obrigatório em horários/durações/preços/percentuais; `prefers-reduced-motion` obrigatório
**Scale/Scope**: 13 rotas App Router (3 públicas/auth, 1 reserva pública dinâmica, 5 Owner, 4 Colaborador), integração com ~26 endpoints Fastify, 2 idiomas (`pt-BR` / `es`) e 2 padrões telefônicos (`+55` / `+58`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Princípio I — Stack, Renderização e Fronteira com a API REST:** Usa Next.js `16.4.6` App Router, React `19.3.0`, TypeScript `strict`, Tailwind CSS `4.3.3` (`@theme` em `app/globals.css`), `lucide-react`; Server Components por padrão com `"use client"` apenas nas folhas interativas; zero Server Actions ou Route Handlers com lógica de domínio; compatível com `cacheComponents: true` (toda leitura dinâmica/fetch não cacheado sob `<Suspense>`).
- [x] **Princípio II — Interface, Mobile-First, Movimento e Acessibilidade:** Design `320px`–`1440px`, alvos ≥ `44px`, *bottom tab bar* com 5 itens no Owner e 4 no Colaborador, `clamp()`, `tabular-nums`, WCAG 2.2 AA, 4 estados completos (skeleton, vazio com ação, erro com `error.tsx`, sucesso) e `prefers-reduced-motion`.
- [x] **Princípio III — Hidratação, Segurança e Multi-País (BR & VE):** Zero leitura de `window`/`localStorage` no render inicial; `Intl.DateTimeFormat` e `Intl.NumberFormat` sempre com `locale` e `timezone` explícitos da empresa; apenas `NEXT_PUBLIC_API_URL` exposta ao cliente; dicionários `pt-BR`/`es` isolados em `lib/i18n/` e suporte a `+55`/`+58`.
- [x] **Princípio IV — Fluxo Spec-Kit e Portões de Qualidade:** Portões `npx tsc --noEmit`, `npm run lint` e `npm run build` definidos como obrigatórios antes de encerrar cada entrega.

**Re-check pós-Phase 1:** Nenhuma violação detectada. Os contratos, o modelo de dados e a árvore de arquivos respeitam integralmente os 4 princípios da Constituição `v1.0.0`.

## Project Structure

### Documentation (this feature)

```text
specs/001-frontend-web-app/
├── plan.md                      # Este arquivo (/speckit-plan)
├── research.md                  # Decisões técnicas e padrões Next.js 16 (Phase 0)
├── data-model.md                # Entidades, estados e validações (Phase 1)
├── quickstart.md                # Guia de execução e validação E2E (Phase 1)
├── contracts/
│   └── api-contracts.md         # Contratos de integração com a API Fastify (Phase 1)
├── checklists/
│   └── requirements.md          # Checklist de qualidade da spec
└── tasks.md                     # A ser gerado por /speckit-tasks (Phase 2)
```

### Source Code (repository root)

```text
app/
├── layout.tsx                           # Server: html, next/font (Plus Jakarta Sans + Geist Mono), metadata base, ThemeProvider + LocaleProvider
├── globals.css                          # Tailwind CSS v4 (@import "tailwindcss"; @theme inline { ... }), Design System Clean & Minimalista (Light/Dark + 7 paletas via CSS variables), hover elevation, slide-over drawer, reduced-motion
├── page.tsx                             # Server: página inicial limpa com acesso a /login e /register
├── error.tsx                            # Client: error boundary raiz com ação de recuperação
├── not-found.tsx                        # Server: 404 global coerente com a marca
├── (auth)/
│   ├── layout.tsx                       # Server: moldura editorial centralizada + seletor de idioma
│   ├── _components/
│   │   ├── login-form.tsx               # Client folha: POST /auth/login + GET /me + redirect por role
│   │   └── register-form.tsx            # Client folha: POST /auth/register com seletor IANA timezone
│   ├── login/
│   │   └── page.tsx                     # Server: metadata + <LoginForm />
│   └── register/
│       └── page.tsx                     # Server: metadata + <RegisterForm />
├── (owner)/
│   ├── layout.tsx                       # Server: compõe AuthGuard(role="OWNER") + DashboardShell (5 itens mobile bottom tab bar / desktop sidebar)
│   ├── error.tsx                        # Client: recuperação de erros do segmento Owner
│   ├── _components/
│   │   ├── owner-shell.tsx              # Client folha: navegação Owner (Agenda, Bloqueios, Equipe, Serviços, Config) + logout + idioma
│   │   ├── appointments-panel.tsx       # Client folha: filtros (data, colaborador, status), listagem, criação manual (CONFIRMED), status e reagendamento
│   │   ├── blocks-panel.tsx             # Client folha: listagem, criação individual/global, exclusão e ConflictAlert (affectedAppointments)
│   │   ├── team-panel.tsx               # Client folha: listagem, cadastro e toggle ativo/inativo de colaboradores
│   │   ├── services-panel.tsx           # Client folha: CRUD serviços, toggle status, vínculo de colaboradores + comissão (%) e editor de work_schedules
│   │   └── settings-panel.tsx           # Client folha: atualização de timezone + exibição/cópia de /book/[companyId]
│   └── owner/
│       ├── page.tsx                     # Server: metadata (noindex) + <AppointmentsPanel />
│       ├── blocks/page.tsx              # Server: <BlocksPanel />
│       ├── team/page.tsx                # Server: <TeamPanel />
│       ├── services/page.tsx            # Server: <ServicesPanel />
│       └── settings/page.tsx            # Server: <SettingsPanel />
├── (collaborator)/
│   ├── layout.tsx                       # Server: compõe AuthGuard(role="COLLABORATOR") + DashboardShell (4 itens mobile bottom tab bar / desktop sidebar)
│   ├── error.tsx                        # Client: recuperação de erros do segmento Colaborador
│   ├── _components/
│   │   ├── collaborator-shell.tsx       # Client folha: navegação Colaborador (Agenda, Bloqueios, Horários, Serviços) + logout + idioma
│   │   ├── my-appointments-panel.tsx    # Client folha: GET /me/appointments + PATCH status
│   │   ├── my-blocks-panel.tsx          # Client folha: GET/POST/DELETE /me/schedule-blocks + ConflictAlert (affectedAppointments)
│   │   ├── my-schedule-panel.tsx        # Client folha: GET /me/work-schedules (somente leitura)
│   │   └── my-services-panel.tsx        # Client folha: GET /me/services (serviços + % comissão, somente leitura)
│   └── collaborator/
│       ├── page.tsx                     # Server: metadata (noindex) + <MyAppointmentsPanel />
│       ├── blocks/page.tsx              # Server: <MyBlocksPanel />
│       ├── schedule/page.tsx            # Server: <MySchedulePanel />
│       └── services/page.tsx            # Server: <MyServicesPanel />
└── book/
    └── [companyId]/
        ├── page.tsx                     # Server: envolve <PublicCatalogLoader params={props.params} /> em <Suspense>
        ├── loading.tsx                  # Server: skeleton mobile-first da reserva pública
        ├── error.tsx                    # Client: erro recuperável da reserva pública
        ├── not-found.tsx                # Server: 404 elegante para empresa inexistente/inativa
        └── _components/
            ├── public-catalog-loader.tsx # Server async: GET /public/companies/:companyId/services; 404 -> notFound()
            └── booking-wizard.tsx       # Client folha: etapas Serviço -> Profissional -> Data/Hora -> Nome/WhatsApp (+55/+58) -> Confirmação

components/
└── ui/
    ├── button.tsx                       # Alvo >= 44px, variantes, loading state
    ├── input.tsx                        # Input acessível com label, erro e aria-describedby
    ├── select.tsx                       # Select acessível >= 44px
    ├── card.tsx                         # Superfícies elevadas com borda areia
    ├── badge.tsx                        # Badges semânticos (sempre com ícone/texto)
    ├── modal.tsx                        # Client folha: dialog acessível por teclado (Esc, foco)
    ├── skeleton.tsx                     # Skeletons de carregamento
    ├── empty-state.tsx                  # Estado vazio com ação primária
    ├── error-state.tsx                  # Estado de erro com botão de retry
    ├── conflict-alert.tsx               # Alerta destacado de affectedAppointments
    ├── phone-input.tsx                  # Client folha: seletor +55 (BR) / +58 (VE) + formatação
    ├── locale-switcher.tsx              # Client folha: alternância pt-BR / es
    ├── theme-customizer.tsx             # Client folha: toggle Claro/Escuro + seletor visual das 7 paletas (círculos de cor)
    ├── slide-over-drawer.tsx            # Client folha: gaveta lateral deslizante acessível para formulários/ações de dashboard
    └── auth-guard.tsx                   # Client folha: guarda determinística (skeleton inicial -> useEffect GET /me -> role check)

lib/
├── api-client.ts                        # Cliente HTTP centralizado (NEXT_PUBLIC_API_URL, Bearer token, interceptador 401)
├── auth.ts                              # Armazenamento seguro de token no cliente + helpers de sessão/logout
├── theme-context.tsx                    # Client provider: Modo Claro/Escuro + 7 paletas (cobalt padrão) via CSS variables e localStorage pós-montagem
├── format.ts                            # Intl.DateTimeFormat / Intl.NumberFormat com locale/timezone explícitos + telefones +55/+58
├── timezones.ts                         # Lista curada de timezones IANA (Brasil, Venezuela e comuns)
├── types/
│   ├── auth.ts                          # AuthResponse, MeResponse, Role, Company
│   ├── team.ts                          # Collaborator, WorkSchedule
│   ├── service.ts                       # Service, ServiceCollaborator
│   ├── appointment.ts                   # Appointment, AppointmentStatus, ScheduleBlock, AffectedAppointment
│   └── public-booking.ts                # PublicCatalogResponse, AvailabilitySlot, CreatePublicAppointmentInput
└── i18n/
    ├── index.ts                         # Tipos Locale ("pt-BR" | "es") e dicionário tipado
    ├── locale-context.tsx               # Client provider mínimo + hook useLocale (default determinístico pt-BR no SSR)
    ├── pt-BR.ts                         # Textos completos em Português (Brasil)
    └── es.ts                            # Textos completos em Espanhol (Venezuela)
```

**Structure Decision**: Adotamos a raiz `app/` existente (sem `src/`), com `components/ui/` para primitivas reutilizáveis, `_components/` colocalizados em cada route group (`(auth)`, `(owner)`, `(collaborator)`, `book/[companyId]`) e `lib/` isolando API, sessão, tipos, formatadores e i18n. Essa organização maximiza coesão, mantém `"use client"` estritamente nas folhas interativas e evita camadas abstratas desnecessárias.

## Complexity Tracking

> Nenhuma violação à Constituição `v1.0.0` identificada. Tabela omitida por conformidade integral.
