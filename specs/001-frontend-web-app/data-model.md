# Data Model: Etapa 4 — Frontend Web

**Feature**: `001-frontend-web-app` | **Date**: 2026-11-20

> Todas as entidades abaixo são **modelos de leitura/escrita (DTOs) do Frontend** alinhados à API REST Fastify externa. Nenhuma entidade é persistida localmente no Next.js.

## 1. Identidade, Sessão e Empresa (`lib/types/auth.ts`)

### `UserRole`
- `"OWNER" | "COLLABORATOR"`

### `Company`
- `id`: `string` (UUID)
- `companyName`: `string`
- `timezone`: `string` (IANA timezone, ex.: `"America/Sao_Paulo"`, `"America/Fortaleza"`, `"America/Caracas"`)
- `isActive`: `boolean`

### `AuthUser`
- `id`: `string`
- `name`: `string`
- `email`: `string`

### `MeResponse` (`GET /me`)
- `user`: `AuthUser`
- `role`: `UserRole`
- `company`: `Company`

### `AuthTokenResponse` (`POST /auth/login`, `POST /auth/register`)
- `token?`: `string`
- `accessToken?`: `string`
- *(Normalizado em `lib/api-client.ts` para extrair o JWT independentemente de a chave ser `token` ou `accessToken`.)*

---

## 2. Equipe e Grade Semanal (`lib/types/team.ts`)

### `Collaborator`
- `id`: `string`
- `name`: `string`
- `email`: `string`
- `phone?`: `string | null`
- `isActive`: `boolean`

### `WorkScheduleSlot`
- `dayOfWeek`: `0 | 1 | 2 | 3 | 4 | 5 | 6` (`0` = Domingo … `6` = Sábado)
- `startTime`: `string` (formato `"HH:mm"`, ex.: `"09:00"`)
- `endTime`: `string` (formato `"HH:mm"`, ex.: `"18:00"`)
- `isActive?`: `boolean`
- **Regras de validação de UI:** `startTime < endTime`; múltiplos turnos no mesmo dia não devem se sobrepor visualmente; validação definitiva realizada pela API Fastify.

---

## 3. Serviços e Comissões (`lib/types/service.ts`)

### `Service`
- `id`: `string`
- `name`: `string`
- `description?`: `string | null`
- `durationMinutes`: `number` (inteiro positivo, exibido com `tabular-nums`)
- `price`: `number` (valor monetário ou centavos conforme contrato da API, exibido com `Intl.NumberFormat` + `tabular-nums`)
- `isActive`: `boolean`

### `ServiceCollaborator`
- `serviceId`: `string`
- `collaboratorId`: `string`
- `collaboratorName?`: `string`
- `commissionPercentage`: `number` (`0` a `100`, exibido com `tabular-nums`, ex.: `45%`)

---

## 4. Agendamentos e Bloqueios (`lib/types/appointment.ts`)

### `AppointmentStatus`
- `"PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELED" | "NO_SHOW"` *(adaptável aos valores exatos do enum no Swagger; badges sempre com cor semântica + ícone + texto traduzido)*

### `Appointment`
- `id`: `string`
- `companyId`: `string`
- `serviceId`: `string`
- `serviceName?`: `string`
- `collaboratorId`: `string`
- `collaboratorName?`: `string`
- `clientName`: `string`
- `clientPhone`: `string` (E.164, ex.: `+5511999999999` ou `+584121234567`)
- `startsAt`: `string` (ISO 8601 UTC/offset — sempre formatado via `Intl.DateTimeFormat` no `company.timezone`)
- `endsAt`: `string` (ISO 8601)
- `status`: `AppointmentStatus`
- `price?`: `number`

### Transições de Status (validadas pela API Fastify)
- Criação pública: inicia no status padrão definido pela API (tipicamente `PENDING` ou `CONFIRMED`).
- Criação manual pelo Owner: permite selecionar status inicial `CONFIRMED` (ou padrão).
- Atualizações operacionais (Owner e Colaborador): `PENDING` → `CONFIRMED` / `CANCELED`; `CONFIRMED` → `COMPLETED` / `NO_SHOW` / `CANCELED`.

### `AffectedAppointment`
- `id`: `string`
- `clientName`: `string`
- `serviceName?`: `string`
- `collaboratorName?`: `string`
- `startsAt`: `string` (ISO 8601)
- `endsAt?`: `string`
- `status`: `AppointmentStatus`

### `ScheduleBlock`
- `id`: `string`
- `collaboratorId`: `string | null` (`null` indica bloqueio global da empresa criado pelo Owner)
- `collaboratorName?`: `string | null`
- `startsAt`: `string` (ISO 8601)
- `endsAt`: `string` (ISO 8601)
- `reason?`: `string | null`

### `CreateScheduleBlockResponse`
- `block` (ou campos diretos do bloqueio criado)
- `affectedAppointments`: `AffectedAppointment[]` (quando `length > 0`, dispara `ConflictAlert` em destaque)

---

## 5. Reserva Pública (`lib/types/public-booking.ts`)

### `PublicCatalogResponse` (`GET /public/companies/:companyId/services`)
- `company`: `{ id: string; companyName: string; timezone: string }`
- `services`: `Service[]` (apenas serviços ativos retornados pela API)

### `AvailabilitySlot` (`GET /public/companies/:companyId/availability`)
- `startsAt`: `string` (ISO 8601)
- `endsAt`: `string` (ISO 8601)
- `collaboratorId?`: `string`
- `collaboratorName?`: `string`

### `PublicBookingFormInput`
- `serviceId`: `string`
- `collaboratorId?`: `string | null` (`null`/`undefined` = "Qualquer disponível")
- `startsAt`: `string`
- `clientName`: `string` (mínimo 2 caracteres)
- `countryCode`: `"+55" | "+58"`
- `clientPhone`: `string` (normalizado em E.164: `+55` + 10–11 dígitos ou `+58` + 10 dígitos)
