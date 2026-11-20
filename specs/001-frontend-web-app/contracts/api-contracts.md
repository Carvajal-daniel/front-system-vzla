# API Integration Contracts: Frontend Next.js ↔ API Fastify

**Feature**: `001-frontend-web-app` | **Date**: 2026-11-20
**Base URL**: `process.env.NEXT_PUBLIC_API_URL` (padrão local: `http://localhost:3333`)

> **Regra de Fronteira:** O frontend Next.js consome exclusivamente estes endpoints. Nenhum Route Handler ou Server Action com lógica de negócio deve ser criado.
> **Nota de Verificação:** Os nomes exatos de propriedades de request/response devem ser confirmados em `GET http://localhost:3333/docs/json` na etapa inicial de `/speckit-implement` quando a API local estiver em execução.

---

## Convenções Globais de Transporte (`lib/api-client.ts`)

- **Cabeçalhos padrão:** `Content-Type: application/json`, `Accept: application/json`.
- **Autenticação:** `Authorization: Bearer <token>` em todas as rotas autenticadas.
- **Tratamento de erros:**
  - `401 Unauthorized`: limpa token local e redireciona automaticamente para `/login` com sinalizador de sessão expirada.
  - `403 Forbidden`: exibe mensagem amigável de permissão insuficiente e redireciona para o painel do `role` atual.
  - `404 Not Found` em `/public/companies/:companyId/services`: aciona `notFound()` do Next.js para renderizar `app/book/[companyId]/not-found.tsx`.
  - `409 Conflict` (ex.: horário ocupado): exibe mensagem amigável no idioma ativo e recarrega disponibilidade/agenda.
  - `400 / 422`: mapeia erros de validação nos campos do formulário.
  - `5xx / Network Error`: exibe `ErrorState` com ação "Tentar novamente".

---

## 1. Auth & Perfil

| Método | Rota | Auth | Propósito no Frontend |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Pública | Cadastro de Owner + Empresa com `timezone` IANA (`/register`). Retorna JWT no corpo JSON. |
| `POST` | `/auth/login` | Pública | Login unificado (`/login`). Retorna JWT no corpo JSON. |
| `GET` | `/me` | Bearer | Fonte única de verdade para `user`, `role` (`OWNER` \| `COLLABORATOR`) e `company` (`id`, `companyName`, `timezone`, `isActive`). |

---

## 2. Empresa (OWNER)

| Método | Rota | Auth | Propósito no Frontend |
| --- | --- | --- | --- |
| `PATCH` | `/companies/me/timezone` | Bearer (`OWNER`) | Atualiza o `timezone` IANA da empresa em `/owner/settings` e sincroniza o estado da sessão. |

---

## 3. Equipe (OWNER)

| Método | Rota | Auth | Propósito no Frontend |
| --- | --- | --- | --- |
| `GET` | `/collaborators` | Bearer (`OWNER`) | Lista colaboradores em `/owner/team` e popula seletores em Agenda, Bloqueios e Serviços. |
| `POST` | `/collaborators` | Bearer (`OWNER`) | Cadastra novo colaborador em `/owner/team`. |
| `PATCH` | `/collaborators/:collaboratorId/status` | Bearer (`OWNER`) | Ativa ou desativa um colaborador em `/owner/team`. |

---

## 4. Serviços, Comissões e Grade Semanal (OWNER)

| Método | Rota | Auth | Propósito no Frontend |
| --- | --- | --- | --- |
| `GET` | `/services` | Bearer (`OWNER`) | Lista serviços em `/owner/services` e popula seletor na criação manual de agendamento. |
| `POST` | `/services` | Bearer (`OWNER`) | Cria novo serviço em `/owner/services`. |
| `PATCH` | `/services/:serviceId` | Bearer (`OWNER`) | Edita dados do serviço (nome, duração, preço). |
| `PATCH` | `/services/:serviceId/status` | Bearer (`OWNER`) | Ativa ou desativa serviço. |
| `GET` | `/services/:serviceId/collaborators` | Bearer (`OWNER`) | Lista colaboradores vinculados ao serviço e seus percentuais de comissão. |
| `POST` | `/services/:serviceId/collaborators` | Bearer (`OWNER`) | Vincula colaborador ao serviço com percentual de comissão. |
| `PATCH` | `/services/:serviceId/collaborators/:collaboratorId` | Bearer (`OWNER`) | Atualiza percentual de comissão do colaborador no serviço. |
| `DELETE` | `/services/:serviceId/collaborators/:collaboratorId` | Bearer (`OWNER`) | Remove vínculo do colaborador com o serviço. |
| `GET` | `/collaborators/:collaboratorId/work-schedules` | Bearer (`OWNER`) | Carrega grade semanal de trabalho de um profissional. |
| `PUT` | `/collaborators/:collaboratorId/work-schedules` | Bearer (`OWNER`) | Salva grade semanal completa do profissional. |

---

## 5. Agenda e Bloqueios (OWNER)

| Método | Rota | Auth | Propósito no Frontend |
| --- | --- | --- | --- |
| `GET` | `/appointments` | Bearer (`OWNER`) | Lista agendamentos em `/owner` com query params de filtro (data, `collaboratorId`, `status`). |
| `POST` | `/appointments` | Bearer (`OWNER`) | Cria agendamento manual (permitindo enviar status inicial `CONFIRMED`). |
| `PATCH` | `/appointments/:appointmentId/status` | Bearer (`OWNER`) | Atualiza status do agendamento. |
| `PATCH` | `/appointments/:appointmentId/reschedule` | Bearer (`OWNER`) | Reagenda data/hora/profissional do agendamento. |
| `GET` | `/schedule-blocks` | Bearer (`OWNER`) | Lista bloqueios da empresa e individuais em `/owner/blocks`. |
| `POST` | `/schedule-blocks` | Bearer (`OWNER`) | Cria bloqueio individual ou global; retorna `affectedAppointments` para exibição imediata em `ConflictAlert`. |
| `DELETE` | `/schedule-blocks/:blockId` | Bearer (`OWNER`) | Remove bloqueio existente. |

---

## 6. Portal do Colaborador (COLLABORATOR)

| Método | Rota | Auth | Propósito no Frontend |
| --- | --- | --- | --- |
| `GET` | `/me/appointments` | Bearer (`COLLABORATOR`) | Lista agenda pessoal em `/collaborator`. |
| `PATCH` | `/appointments/:appointmentId/status` | Bearer (`COLLABORATOR`) | Atualiza status de atendimento próprio. |
| `GET` | `/me/schedule-blocks` | Bearer (`COLLABORATOR`) | Lista bloqueios pessoais em `/collaborator/blocks`. |
| `POST` | `/me/schedule-blocks` | Bearer (`COLLABORATOR`) | Cria bloqueio pessoal; retorna `affectedAppointments` para exibição em `ConflictAlert`. |
| `DELETE` | `/me/schedule-blocks/:blockId` | Bearer (`COLLABORATOR`) | Remove bloqueio pessoal. |
| `GET` | `/me/work-schedules` | Bearer (`COLLABORATOR`) | Exibe grade semanal em modo somente leitura (`/collaborator/schedule`). |
| `GET` | `/me/services` | Bearer (`COLLABORATOR`) | Exibe serviços e comissões vinculados em modo somente leitura (`/collaborator/services`). |

---

## 7. Reserva Pública (Sem Login)

| Método | Rota | Auth | Propósito no Frontend |
| --- | --- | --- | --- |
| `GET` | `/public/companies/:companyId/services` | Pública | Carregado em Server Component (`<PublicCatalogLoader />` sob `<Suspense>`). Retorna `{ company: { id, companyName, timezone }, services }` ou `404` (`notFound()`). |
| `GET` | `/public/companies/:companyId/availability` | Pública | Consulta horários livres por serviço, data e colaborador opcional (ou "qualquer disponível"). |
| `POST` | `/public/companies/:companyId/appointments` | Pública | Cria reserva pública enviando serviço, profissional (opcional), horário, nome e WhatsApp (`+55` / `+58`). |
