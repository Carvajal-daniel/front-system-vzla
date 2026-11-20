---

description: "Actionable, dependency-ordered task list for Etapa 4 — Frontend Web"
---

# Tasks: Etapa 4 — Frontend Web (Painel Owner, Portal Colaborador e Reserva Pública)

**Input**: Design documents from `specs/001-frontend-web-app/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/api-contracts.md`, `quickstart.md`

**Tests**: Testes automatizados unitários/E2E não foram solicitados explicitamente na especificação; a validação obrigatória segue os portões da Constituição (`npx tsc --noEmit`, `npm run lint`, `npm run build`) e os cenários de `quickstart.md`.

**Organization**: Tarefas agrupadas por fase e User Story (`US1`–`US5`) para entrega incremental e testabilidade independente, respeitando rigorosamente a organização modular (`components/ui/`, `_components/` colocalizados por grupo de rotas, `lib/` isolado e `"use client"` apenas nas folhas interativas).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Executável em paralelo (arquivos distintos, sem dependência de tarefa incompleta)
- **[Story]**: User Story atendida (`[US1]` a `[US5]`) — omitido em Setup, Foundational e Polish

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Instalar ícone padrão (`lucide-react`), configurar tokens Tailwind CSS v4 (*Warm Luxury + Modern Editorial*), tipografia `next/font` e boundaries globais.

- [X] T001 Install `lucide-react` dependency in `package.json` and verify `NEXT_PUBLIC_API_URL` configuration in `.env.local` (and document `.env.example` at repository root)
- [X] T002 Configure Tailwind CSS v4 `@theme inline` tokens (Warm Luxury + Editorial palette, WCAG 2.2 AA contrast colors, fluid `clamp()` typography tokens, `prefers-reduced-motion` rules) in `app/globals.css`
- [X] T003 Configure `next/font/google` (`Fraunces`, `Plus_Jakarta_Sans`, `Geist_Mono`), base `Metadata`, and `LocaleProvider` wrapper in `app/layout.tsx`
- [X] T004 [P] Create root error boundary (`"use client"`) with recovery action in `app/error.tsx`
- [X] T005 [P] Create global branded 404 page (Server Component) in `app/not-found.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Camada `lib/` (tipos, cliente HTTP Bearer + interceptador `401`, formatação determinística `Intl`, i18n `pt-BR`/`es`) e primitivas reutilizáveis `components/ui/`.

**⚠️ CRITICAL**: Nenhuma User Story pode iniciar antes da conclusão desta fase.

### Types & Core Infrastructure (`lib/`)

- [X] T006 [P] Create authentication and company DTOs citing `data-model.md` (`UserRole`, `Company.timezone`, `Company.isActive`, `AuthUser`, `MeResponse.role`, `AuthTokenResponse.token`, `AuthTokenResponse.accessToken`) in `lib/types/auth.ts`
- [X] T007 [P] Create team and schedule DTOs citing `data-model.md` (`Collaborator.isActive`, `WorkScheduleSlot.dayOfWeek`, `WorkScheduleSlot.startTime`, `WorkScheduleSlot.endTime`) in `lib/types/team.ts`
- [X] T008 [P] Create service and commission DTOs citing `data-model.md` (`Service.durationMinutes`, `Service.price`, `Service.isActive`, `ServiceCollaborator.commissionPercentage`) in `lib/types/service.ts`
- [X] T009 [P] Create appointment and schedule block DTOs citing `data-model.md` (`AppointmentStatus`, `Appointment.startsAt`, `Appointment.endsAt`, `Appointment.clientPhone`, `Appointment.status`, `ScheduleBlock.collaboratorId`, `CreateScheduleBlockResponse.affectedAppointments`, `AffectedAppointment`) in `lib/types/appointment.ts`
- [X] T010 [P] Create public booking DTOs citing `data-model.md` (`PublicCatalogResponse`, `AvailabilitySlot`, `PublicBookingFormInput.clientName`, `PublicBookingFormInput.countryCode`, `PublicBookingFormInput.clientPhone`, `PublicBookingFormInput.collaboratorId`) in `lib/types/public-booking.ts`
- [X] T011 [P] Create curated IANA timezones list (Brasil, Venezuela and common zones) in `lib/timezones.ts`
- [X] T012 [P] Implement deterministic `Intl.DateTimeFormat`, `Intl.NumberFormat`, `tabular-nums` helpers, and E.164 `+55`/`+58` phone formatters/validators citing `data-model.md` (`Company.timezone`, `PublicBookingFormInput.countryCode`, `PublicBookingFormInput.clientPhone`) in `lib/format.ts`
- [X] T013 [P] Implement client-only token storage helpers (read strictly inside `useEffect`, never during SSR) and logout dispatcher in `lib/auth.ts`
- [X] T014 Implement centralized HTTP client (`NEXT_PUBLIC_API_URL`, `Authorization: Bearer <token>`, token normalization for `AuthTokenResponse.token`/`AuthTokenResponse.accessToken`, global `401` auto-logout, typed API errors for `400`/`403`/`404`/`409`/`5xx`) in `lib/api-client.ts` (depends on T006, T013)
- [X] T015 [P] Create typed i18n dictionary contract and exports in `lib/i18n/index.ts`, complete Portuguese strings in `lib/i18n/pt-BR.ts`, and complete Spanish strings in `lib/i18n/es.ts`
- [X] T016 Create minimal `"use client"` `LocaleProvider` and `useLocale` hook (deterministic `"pt-BR"` SSR default, synced in `useEffect`) in `lib/i18n/locale-context.tsx` (depends on T015)

### Reusable Base UI Components (`components/ui/`)

- [X] T017 [P] Create accessible `Button` (>= 44px touch target, loading state, variants) in `components/ui/button.tsx` and `Card` in `components/ui/card.tsx`
- [X] T018 [P] Create accessible `Input` in `components/ui/input.tsx` and `Select` (>= 44px touch target, error `aria-describedby`) in `components/ui/select.tsx`
- [X] T019 [P] Create semantic `Badge` (color + icon + label) in `components/ui/badge.tsx` and `Skeleton` primitives in `components/ui/skeleton.tsx`
- [X] T020 [P] Create `EmptyState` (with primary action) in `components/ui/empty-state.tsx`, `ErrorState` (with retry button) in `components/ui/error-state.tsx`, and `ConflictAlert` (rendering `CreateScheduleBlockResponse.affectedAppointments` per `data-model.md`) in `components/ui/conflict-alert.tsx`
- [X] T021 [P] Create `"use client"` accessible `Modal` (Esc close, focus management) in `components/ui/modal.tsx`, `PhoneInput` (`+55` BR / `+58` VE selector citing `data-model.md` `PublicBookingFormInput.countryCode` and `PublicBookingFormInput.clientPhone`) in `components/ui/phone-input.tsx`, and `LocaleSwitcher` in `components/ui/locale-switcher.tsx`
- [X] T022 Create `"use client"` `AuthGuard` (SSR-safe skeleton -> `useEffect` `GET /me` validation -> `MeResponse.role` check -> redirect on `401` or role mismatch, providing session context to authenticated dashboards) in `components/ui/auth-guard.tsx` (depends on T014, T019)

**Checkpoint**: Fundação completa (`lib/` e `components/ui/`). As User Stories podem ser implementadas de forma incremental e independente.

---

## Phase 3: User Story 1 — Reserva Pública Mobile-First sem Login (Priority: P1) 🎯 MVP

**Goal**: Entregar o fluxo completo de reserva pública `/book/[companyId]` com Server Component + `<Suspense>` (Next.js 16 `cacheComponents: true`), `not-found.tsx` em `404` e wizard mobile-first em etapas com WhatsApp `+55`/`+58` e confirmação.

**Independent Test**: Acessar `/book/[companyId]` válido e `/book/inexistente` (`404`) em `320px`–`390px`, percorrer Serviço → Profissional/Qualquer disponível → Data/Horário no `company.timezone` → Nome/WhatsApp → Confirmação sem login e com zero erros de hidratação.

- [X] T023 [P] [US1] Create mobile-first loading skeleton in `app/book/[companyId]/loading.tsx`, branded 404 page in `app/book/[companyId]/not-found.tsx`, and error boundary (`"use client"`) in `app/book/[companyId]/error.tsx`
- [X] T024 [US1] Implement async Server Component `PublicCatalogLoader` fetching `GET /public/companies/:companyId/services` and calling `notFound()` on `404` in `app/book/[companyId]/_components/public-catalog-loader.tsx` (depends on T010, T014)
- [X] T025 [US1] Implement `"use client"` multi-step `BookingWizard` (service selection with `Service.durationMinutes`/`Service.price` in `tabular-nums`, professional or "any available" per `data-model.md` `PublicBookingFormInput.collaboratorId`, date + `GET /public/companies/:companyId/availability` slot grid in `Company.timezone`, client name + `PhoneInput` per `PublicBookingFormInput.clientName`/`PublicBookingFormInput.countryCode`/`PublicBookingFormInput.clientPhone`, `POST /public/companies/:companyId/appointments` with `409` conflict refresh, sticky thumb-zone summary, and confirmation screen) in `app/book/[companyId]/_components/booking-wizard.tsx` (depends on T012, T014, T016, T021)
- [X] T026 [US1] Implement Server Component page wrapping `<PublicCatalogLoader params={props.params} />` inside `<Suspense fallback={<BookingLoading />}>` (Next.js 16 `cacheComponents: true` compliant) in `app/book/[companyId]/page.tsx` (depends on T023, T024, T025)

**Checkpoint**: MVP de Reserva Pública (`/book/[companyId]`) completo e testável independentemente.

---

## Phase 4: User Story 2 — Autenticação Unificada, Cadastro de Empresa e Proteção de Rotas (Priority: P2)

**Goal**: Entregar `/login`, `/register` (com seletor IANA timezone) e entrada `/`, redirecionando conforme `MeResponse.role` (`OWNER` → `/owner`, `COLLABORATOR` → `/collaborator`) com proteção de rotas e logout automático em `401`.

**Independent Test**: Criar empresa + Owner em `/register`, testar redirecionamento para `/owner`, fazer logout, autenticar em `/login` como `OWNER` e como `COLLABORATOR`, validar bloqueio de acesso sem token e logout automático em `401`.

- [X] T027 [P] [US2] Create Server Component auth layout with editorial framing and `<LocaleSwitcher />` in `app/(auth)/layout.tsx`
- [X] T028 [P] [US2] Create `"use client"` `LoginForm` (`POST /auth/login` -> store JWT -> `GET /me` -> redirect by `MeResponse.role` per `data-model.md`, displaying session-expired banner when redirected from `401`) in `app/(auth)/_components/login-form.tsx`
- [X] T029 [P] [US2] Create `"use client"` `RegisterForm` (`POST /auth/register` with curated IANA `Company.timezone` selector from `lib/timezones.ts` -> store JWT -> `GET /me` -> redirect to `/owner`) in `app/(auth)/_components/register-form.tsx`
- [X] T030 [US2] Create Server Component pages `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, and clean landing/entry route `app/page.tsx` with direct navigation to `/login` and `/register` (depends on T027, T028, T029)

**Checkpoint**: Fluxo completo de autenticação e proteção de sessão funcional.

---

## Phase 4.5: User Story 6 — Design System Clean & Minimalista + Personalização Visual (Light/Dark + 7 Paletas)

**Goal**: Atualizar tokens e tipografia (`Plus Jakarta Sans` + `Geist Mono`), implementar alternância Claro/Escuro + 7 paletas (`rose`, `cobalt` [padrão], `barber-gold`, `terracotta`, `emerald`, `velvet`, `obsidian`) via CSS variables com contraste WCAG 2.2 AA e persistência local, além de gaveta lateral deslizante (`SlideOverDrawer`).

**Independent Test**: Alternar Claro/Escuro e selecionar cada uma das 7 paletas no `ThemeCustomizer`, recarregar a página para confirmar persistência sem warnings de hidratação.

- [X] T030a [US6] Update Tailwind CSS v4 tokens (Light/Dark + 7 `[data-palette]` palettes with WCAG 2.2 AA contrast, pill/bento/hover-elevation/drawer utilities, `prefers-reduced-motion`) in `app/globals.css` and fonts (`Plus_Jakarta_Sans` + `Geist_Mono`) + `<ThemeProvider>` in `app/layout.tsx`
- [X] T030b [P] [US6] Implement hydration-safe `ThemeProvider` & `useTheme` (default `light` + `cobalt`, synced with `localStorage` and `<html>` attributes) in `lib/theme-context.tsx`, `ThemeCustomizer` (Light/Dark toggle + 7 color swatches) in `components/ui/theme-customizer.tsx`, and `SlideOverDrawer` in `components/ui/slide-over-drawer.tsx`

---

## Phase 5: User Story 3 — Painel do Owner (Priority: P3)

**Goal**: Entregar os 5 módulos do Painel Owner (`/owner`, `/owner/blocks`, `/owner/team`, `/owner/services`, `/owner/settings`) no layout SaaS Clean & Minimalista: sidebar fixa à esquerda (desktop), *bottom tab bar* (5 itens no mobile), topbar com `<ThemeCustomizer />` e `<LocaleSwitcher />`, cards de KPI no topo, agenda limpa e *slide-over drawers* para ações.

**Independent Test**: Logar como `OWNER` e operar Agenda (filtros, criação manual `CONFIRMED`, status, reagendamento), Bloqueios (individual/global + `affectedAppointments`), Equipe (criar/toggle), Serviços/Comissões/Horários (`work_schedules`) e Configurações (`timezone` + copiar link `/book/[companyId]`).

- [X] T031 [P] [US3] Create `"use client"` `OwnerShell` (mobile bottom tab bar with 5 items >= 44px + desktop sidebar, company badge, `<LocaleSwitcher />`, logout button) in `app/(owner)/_components/owner-shell.tsx` and segment error boundary in `app/(owner)/error.tsx`
- [X] T032 [US3] Create Server Component `app/(owner)/layout.tsx` composing `<AuthGuard requiredRole="OWNER"><OwnerShell>{children}</OwnerShell></AuthGuard>` with `robots: { index: false, follow: false }` metadata (depends on T022, T031)
- [X] T033 [P] [US3] Implement `"use client"` `AppointmentsPanel` (`GET /appointments` with date/collaborator/`Appointment.status` filters, manual creation via `POST /appointments` supporting initial `CONFIRMED` status per `data-model.md` `AppointmentStatus`, `PATCH /appointments/:appointmentId/status`, `PATCH /appointments/:appointmentId/reschedule`, formatted in `Company.timezone` with `tabular-nums`) in `app/(owner)/_components/appointments-panel.tsx`
- [X] T034 [P] [US3] Implement `"use client"` `BlocksPanel` (`GET /schedule-blocks`, `POST /schedule-blocks` supporting collaborator-specific or global `ScheduleBlock.collaboratorId = null`, `DELETE /schedule-blocks/:blockId`, displaying `ConflictAlert` when `CreateScheduleBlockResponse.affectedAppointments` is non-empty per `data-model.md`) in `app/(owner)/_components/blocks-panel.tsx`
- [X] T035 [P] [US3] Implement `"use client"` `TeamPanel` (`GET /collaborators`, `POST /collaborators`, `PATCH /collaborators/:collaboratorId/status` per `data-model.md` `Collaborator.isActive`) in `app/(owner)/_components/team-panel.tsx`
- [X] T036 [P] [US3] Implement `"use client"` `ServicesPanel` (CRUD `GET/POST /services`, `PATCH /services/:serviceId`, `PATCH /services/:serviceId/status` citing `Service.durationMinutes`/`Service.price`/`Service.isActive`; collaborator commission management `GET/POST/PATCH/DELETE /services/:serviceId/collaborators` citing `ServiceCollaborator.commissionPercentage`; and collaborator weekly schedule editor `GET/PUT /collaborators/:collaboratorId/work-schedules` citing `WorkScheduleSlot.dayOfWeek`/`WorkScheduleSlot.startTime`/`WorkScheduleSlot.endTime` per `data-model.md`) in `app/(owner)/_components/services-panel.tsx`
- [X] T037 [P] [US3] Implement `"use client"` `SettingsPanel` (`PATCH /companies/me/timezone` citing `Company.timezone` + public booking link `/book/[companyId]` display and one-tap clipboard copy with visual feedback) in `app/(owner)/_components/settings-panel.tsx`
- [X] T038 [US3] Create Server Component Owner pages `app/(owner)/owner/page.tsx`, `app/(owner)/owner/blocks/page.tsx`, `app/(owner)/owner/team/page.tsx`, `app/(owner)/owner/services/page.tsx`, and `app/(owner)/owner/settings/page.tsx` (depends on T032, T033, T034, T035, T036, T037)

**Checkpoint**: Painel completo do Owner funcional em mobile (`320px`–`390px`) e desktop (`1440px`).

---

## Phase 6: User Story 4 — Portal do Colaborador (Priority: P4)

**Goal**: Entregar os 4 módulos do Portal do Colaborador (`/collaborator`, `/collaborator/blocks`, `/collaborator/schedule`, `/collaborator/services`) com *bottom tab bar* (4 itens no mobile) e *sidebar* no desktop.

**Independent Test**: Logar como `COLLABORATOR` e operar Minha Agenda (alterar status), Meus Bloqueios (criar/excluir com alerta de `affectedAppointments`), Minha Grade Semanal (somente leitura) e Meus Serviços/Comissões (somente leitura).

- [X] T039 [P] [US4] Create `"use client"` `CollaboratorShell` (mobile bottom tab bar with 4 items >= 44px + desktop sidebar, `<LocaleSwitcher />`, logout button) in `app/(collaborator)/_components/collaborator-shell.tsx` and segment error boundary in `app/(collaborator)/error.tsx`
- [X] T040 [US4] Create Server Component `app/(collaborator)/layout.tsx` composing `<AuthGuard requiredRole="COLLABORATOR"><CollaboratorShell>{children}</CollaboratorShell></AuthGuard>` with `robots: { index: false, follow: false }` metadata (depends on T022, T039)
- [X] T041 [P] [US4] Implement `"use client"` `MyAppointmentsPanel` (`GET /me/appointments` + `PATCH /appointments/:appointmentId/status` formatted in `Company.timezone` with `tabular-nums`) in `app/(collaborator)/_components/my-appointments-panel.tsx`
- [X] T042 [P] [US4] Implement `"use client"` `MyBlocksPanel` (`GET/POST/DELETE /me/schedule-blocks` displaying `ConflictAlert` when `CreateScheduleBlockResponse.affectedAppointments` is non-empty per `data-model.md`) in `app/(collaborator)/_components/my-blocks-panel.tsx`
- [X] T043 [P] [US4] Implement `"use client"` read-only `MySchedulePanel` (`GET /me/work-schedules` citing `WorkScheduleSlot.dayOfWeek`/`WorkScheduleSlot.startTime`/`WorkScheduleSlot.endTime`) in `app/(collaborator)/_components/my-schedule-panel.tsx` and read-only `MyProfilePanel` (`GET /me/services` citing `Service.durationMinutes`/`Service.price`/`ServiceCollaborator.commissionPercentage`) in `app/(collaborator)/_components/my-profile-panel.tsx`
- [X] T044 [US4] Create Server Component Collaborator pages `app/(collaborator)/collaborator/page.tsx`, `app/(collaborator)/collaborator/blocks/page.tsx`, `app/(collaborator)/collaborator/schedule/page.tsx`, and `app/(collaborator)/collaborator/profile/page.tsx` (depends on T040, T041, T042, T043)

**Checkpoint**: Portal completo do Colaborador funcional e isolado do Painel Owner.

---

## Phase 7: User Story 5 — Suporte Multi-País Brasil & Venezuela (Priority: P5)

**Goal**: Garantir cobertura 100% bilíngue (`pt-BR` / `es`), ausência de strings hardcoded no JSX, validação completa de telefones `+55`/`+58` e formatação de datas/horários 100% imune a divergências de fuso horário do navegador.

**Independent Test**: Alternar idioma `pt-BR` ↔ `es` em todas as 13 rotas, testar com fuso do navegador diferente do `Company.timezone` e validar submissões com `+55` e `+58`.

- [X] T045 [US5] Audit all components across `app/` and `components/ui/` to ensure zero hardcoded UI strings remain outside `lib/i18n/pt-BR.ts` and `lib/i18n/es.ts` and sync `document.documentElement.lang` on locale toggle in `lib/i18n/locale-context.tsx`
- [X] T046 [US5] Verify and refine `+55` (Brasil) / `+58` (Venezuela) E.164 normalization and error messages in `lib/format.ts` and `components/ui/phone-input.tsx`

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Conferência final contra Swagger real, auditoria de fronteiras `"use client"`, responsividade/acessibilidade e portões obrigatórios da Constituição.

- [X] T047 Verify payload field parity against live Fastify Swagger (`GET http://localhost:5148/docs/json`) when backend is active and adjust DTO mappings in `lib/types/` and `lib/api-client.ts` if any field name differs
- [X] T048 Audit `"use client"` boundaries across `app/` and `components/` (confirming zero pages/layouts marked `"use client"`, zero Server Actions/Route Handlers with business logic, and zero hydration warnings)
- [X] T049 Run mandatory Constitution quality gates (`npx tsc --noEmit`, `npm run lint`, `npm run build`) and prepare end-to-end validation scenarios from `specs/001-frontend-web-app/quickstart.md` across `320px`, `375px`, `768px`, and `1440px`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Inicia imediatamente.
- **Foundational (Phase 2)**: Depende de Phase 1 — **BLOQUEIA** todas as User Stories.
- **User Story 1 (P1 — Reserva Pública)**: Depende apenas de Phase 2 (MVP independente).
- **User Story 2 (P2 — Autenticação)**: Depende apenas de Phase 2 (pode rodar em paralelo com US1).
- **User Story 3 (P3 — Painel Owner)**: Depende de Phase 2 e usa sessão de US2.
- **User Story 4 (P4 — Portal Colaborador)**: Depende de Phase 2 e usa sessão de US2 (pode rodar em paralelo com US3).
- **User Story 5 (P5 — Multi-País Audit)**: Depende de US1–US4 estarem implementadas para varredura completa.
- **Polish (Phase 8)**: Depende de todas as User Stories concluídas.

### Parallel Opportunities

- Em **Phase 2**, todos os arquivos de tipos (`T006`–`T010`), utilitários independentes (`T011`–`T013`, `T015`) e primitivas UI (`T017`–`T021`) podem ser criados em paralelo.
- Em **Phase 5 (Owner)**, os 5 painéis (`T033`–`T037`) são independentes e podem ser implementados em paralelo.
- Em **Phase 6 (Colaborador)**, os 4 painéis (`T041`–`T043`) podem ser implementados em paralelo.

---

## Parallel Example: User Story 3 (Painel Owner)

```text
# Após T032 (layout Owner), implementar os 5 painéis em paralelo:
- T033: app/(owner)/_components/appointments-panel.tsx
- T034: app/(owner)/_components/blocks-panel.tsx
- T035: app/(owner)/_components/team-panel.tsx
- T036: app/(owner)/_components/services-panel.tsx
- T037: app/(owner)/_components/settings-panel.tsx
```

---

## Implementation Strategy

### Entrega Incremental Módulo por Módulo

1. **Etapa A — Setup + Fundação (Phases 1–2):** `lucide-react`, tokens Tailwind v4, `lib/` completo e `components/ui/`. Gate: `npx tsc --noEmit && npm run lint && npm run build`.
2. **Etapa B — MVP Reserva Pública (Phase 3 / US1):** `/book/[companyId]` funcional de ponta a ponta. Gate: `tsc`, `lint`, `build`.
3. **Etapa C — Autenticação (Phase 4 / US2):** `/login`, `/register`, `/` e proteção de rotas. Gate: `tsc`, `lint`, `build`.
4. **Etapa D — Painel Owner (Phase 5 / US3):** 5 módulos `/owner/*`. Gate: `tsc`, `lint`, `build`.
5. **Etapa E — Portal Colaborador (Phase 6 / US4):** 4 módulos `/collaborator/*`. Gate: `tsc`, `lint`, `build`.
6. **Etapa F — Multi-País + Polish (Phases 7–8 / US5):** auditoria `pt-BR`/`es`, conferência Swagger `/docs/json`, validação visual e build de produção.
