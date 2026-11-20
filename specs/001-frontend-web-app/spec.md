# Feature Specification: Etapa 4 — Frontend Web (Painel Owner, Portal Colaborador e Reserva Pública)

**Feature Branch**: `001-frontend-web-app`

**Created**: 2026-11-20

**Status**: Draft

**Input**: Etapa 4: Frontend Web (Next.js App Router — Painel Owner, Portal Colaborador e Reserva Pública) integrado à API Fastify externa (`NEXT_PUBLIC_API_URL=http://localhost:3333`), com suporte multi-país Brasil (`pt-BR` / `+55`) e Venezuela (`es` / `+58`).

---

## Direção de Arte (`SITE.md`)

1. **Conceito central:** *Clean & Minimalista — Precisão Editorial SaaS* — estética contemporânea limpa e de alto contraste que se adapta tanto a barbearias clássicas quanto a salões femininos e clínicas de estética.
2. **Direção visual:** Design System Clean & Minimalista com suporte nativo a **Modo Claro e Modo Escuro** e **7 paletas curadas** (`cobalt` padrão inicial no modo claro, `rose`, `barber-gold`, `terracotta`, `emerald`, `velvet`, `obsidian`), aplicadas via variáveis CSS (`--primary`, `--accent-primary`) com contraste WCAG 2.2 AA garantido em ambos os modos, botões *pill* e *bento cards* em páginas públicas/auth.
3. **Tipografia:** **`Plus Jakarta Sans`** para títulos e interface operacional + **`Geist Mono`** para horários, durações, preços, comissões e contadores com `tabular-nums` obrigatório. Escala fluida com `clamp()` e `text-balance` em títulos.
4. **Arquitetura de Dashboard SaaS:** Sidebar fixa à esquerda no desktop (e *bottom tab bar* com até 5 itens no mobile), topbar com alternância rápida Claro/Escuro e seletor visual de paleta, **cards de KPI no topo**, agenda limpa e **gaveta lateral deslizante (*slide-over drawer*)** para formulários e ações contextuais.
5. **Assinatura:** (a) Grade tátil de horários com `tabular-nums`, alvos ≥ `44px` e selo permanente do `timezone` da empresa; (b) Resumo fixo na zona do polegar (mobile) durante o fluxo de reserva pública; (c) Banner de impacto (*Conflict Impact Alert*) listando `affectedAppointments` em bloqueios; (d) Personalização instantânea de tema (Claro/Escuro + 7 paletas).
6. **Uso de movimento:** Transições suaves de interface, elevação sutil (*hover elevation*) nos cards e abertura fluida de *slide-over drawers* e modais; 100% condicionado a `prefers-reduced-motion`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reserva Pública Mobile-First sem Login (Priority: P1)

Um cliente final recebe o link `/book/[companyId]` (via WhatsApp ou bio do Instagram), visualiza o nome da barbearia/salão e seu catálogo de serviços ativos, escolhe o serviço, seleciona um profissional específico ou "Qualquer disponível", escolhe data e horário livre exibidos no fuso horário oficial da empresa, informa seu nome e WhatsApp internacional (`+55` Brasil ou `+58` Venezuela) e finaliza o agendamento vendo uma tela clara de confirmação.

**Why this priority**: É o principal fluxo de geração de receita e aquisição de clientes do SaaS, acessado majoritariamente por smartphone sem necessidade de cadastro prévio.

**Independent Test**: Pode ser testada isoladamente acessando `/book/[companyId]` com um `companyId` válido (e outro inválido/inativo para validar a tela `404`), concluindo uma reserva de ponta a ponta em `320px`–`390px` e verificando o agendamento criado na API.

**Acceptance Scenarios**:

1. **Given** uma empresa ativa com serviços cadastrados, **When** o cliente acessa `/book/[companyId]`, **Then** o sistema exibe imediatamente o cabeçalho da empresa, seu fuso horário e a lista de serviços ativos com duração e preço em `tabular-nums`.
2. **Given** um `companyId` inexistente ou pertencente a uma empresa inativa (`404` da API), **When** o cliente acessa `/book/[companyId]`, **Then** o sistema renderiza a página `not-found.tsx` coerente com a marca, sem erro técnico exposto.
3. **Given** um serviço selecionado, **When** o cliente escolhe um profissional ou "Qualquer disponível" e seleciona uma data, **Then** o sistema consulta a disponibilidade na API e apresenta os horários livres formatados explicitamente no `timezone` da empresa com alvos de toque ≥ `44px`.
4. **Given** um horário escolhido, **When** o cliente preenche seu nome e WhatsApp com seletor de país (`+55` Brasil ou `+58` Venezuela) e confirma, **Then** o agendamento é enviado à API e o cliente vê a tela de confirmação com serviço, profissional, data/horário (com indicação do fuso) e botão para nova reserva.
5. **Given** que o horário escolhido acabou de ser ocupado por outro cliente (conflito retornado pela API), **When** o cliente tenta confirmar, **Then** o sistema exibe mensagem amigável no idioma ativo e atualiza automaticamente a grade de horários disponíveis.

---

### User Story 2 - Autenticação Unificada, Cadastro de Empresa e Proteção de Rotas (Priority: P2)

Um proprietário (Owner) cria sua conta e sua empresa informando o fuso horário IANA (ex.: `America/Sao_Paulo`, `America/Fortaleza`, `America/Caracas`), ou um usuário existente (`OWNER` ou `COLLABORATOR`) faz login em `/login` e é redirecionado automaticamente para o painel correspondente ao seu papel, com proteção contra acesso indevido e logout automático caso a sessão expire (`401`).

**Why this priority**: Habilita o acesso seguro aos painéis internos (`OWNER` e `COLLABORATOR`) e garante o isolamento por papel desde o primeiro acesso.

**Independent Test**: Pode ser testada criando uma conta em `/register`, fazendo logout, entrando em `/login` como `OWNER` (redireciona para `/owner`) e como `COLLABORATOR` (redireciona para `/collaborator`), além de tentar acessar `/owner` sem token ou com token expirado (`401`).

**Acceptance Scenarios**:

1. **Given** um visitante em `/register`, **When** preenche dados do proprietário, nome da empresa e seleciona um `timezone` IANA válido, **Then** a conta é criada na API, a sessão JWT é inicializada e o usuário é redirecionado para `/owner`.
2. **Given** um usuário cadastrado em `/login`, **When** informa credenciais válidas, **Then** o sistema obtém o JWT, consulta `GET /me` para identificar `role` e `company`, e redireciona `OWNER` para `/owner` e `COLLABORATOR` para `/collaborator`.
3. **Given** um usuário não autenticado ou com token expirado/inválido (`401`), **When** acessa qualquer rota de `/owner/*` ou `/collaborator/*` ou executa uma ação autenticada que retorna `401`, **Then** o sistema limpa a sessão local e redireciona automaticamente para `/login` com aviso claro de sessão expirada.
4. **Given** um usuário autenticado como `COLLABORATOR`, **When** tenta navegar manualmente para `/owner`, **Then** o sistema impede a visualização dos dados do Owner e redireciona para `/collaborator`.

---

### User Story 3 - Painel do Owner: Operação Completa da Barbearia/Salão (Priority: P3)

O Owner acessa `/owner` para gerir toda a operação diária: consultar, filtrar, criar (inclusive já como `CONFIRMED`), atualizar status e reagendar compromissos; criar bloqueios individuais ou globais visualizando conflitos (`affectedAppointments`); cadastrar e ativar/desativar colaboradores; gerir serviços, comissões por profissional e grade semanal (`work_schedules`); e configurar o `timezone` da empresa e copiar o link público `/book/[companyId]`.

**Why this priority**: Concentra todas as ferramentas administrativas indispensáveis para que o estabelecimento configure seu catálogo, equipe e agenda antes de receber clientes.

**Independent Test**: Pode ser testada logando como `OWNER` e percorrendo cada uma das 5 abas principais (Agenda, Bloqueios, Equipe, Serviços, Configurações) em mobile (`375px`) e desktop (`1440px`).

**Acceptance Scenarios**:

1. **Given** o Owner em `/owner` (Agenda), **When** aplica filtros por data, colaborador e status, **Then** a listagem atualiza exibindo os agendamentos no `timezone` da empresa, com ações para alterar status, reagendar ou criar novo agendamento manual (permitindo escolher status inicial `CONFIRMED`).
2. **Given** o Owner em `/owner/blocks`, **When** cria um bloqueio (para um colaborador específico ou global da empresa) que sobrepõe agendamentos existentes, **Then** o sistema exibe um alerta destacado contendo a lista de `affectedAppointments` retornada pela API e permite excluir bloqueios existentes.
3. **Given** o Owner em `/owner/team`, **When** cadastra um novo colaborador ou alterna o status ativo/inativo, **Then** a lista reflete imediatamente o estado persistido pela API.
4. **Given** o Owner em `/owner/services`, **When** cria/edita/ativa/desativa um serviço, vincula/atualiza/remove colaboradores com percentual de comissão (`tabular-nums`) e salva a grade semanal (`work_schedules`) de um colaborador, **Then** todas as alterações persistem na API e exibem feedback claro de sucesso ou erro.
5. **Given** o Owner em `/owner/settings`, **When** atualiza o `timezone` da empresa ou aciona o botão "Copiar link de reserva", **Then** o novo fuso é salvo na API (refletindo na formatação da sessão) e a URL completa `/book/[companyId]` é copiada para a área de transferência com confirmação visual.

---

### User Story 4 - Portal do Colaborador (Priority: P4)

O Colaborador acessa `/collaborator` para acompanhar sua própria agenda, atualizar status dos seus atendimentos, criar e remover bloqueios pessoais (visualizando alerta de `affectedAppointments` quando houver conflito), e consultar em modo leitura sua grade semanal de trabalho e os serviços/comissões vinculados a ele.

**Why this priority**: Dá autonomia diária aos profissionais sem expor controles administrativos ou dados de outros colaboradores.

**Independent Test**: Pode ser testada logando como `COLLABORATOR` e validando atualização de status em um agendamento próprio, criação/remoção de bloqueio pessoal e leitura da grade semanal e serviços com comissão.

**Acceptance Scenarios**:

1. **Given** o Colaborador em `/collaborator` (Minha Agenda), **When** visualiza seus agendamentos do dia/período e altera o status de um atendimento, **Then** a API atualiza o status e a interface reflete a mudança sem recarregar toda a aplicação.
2. **Given** o Colaborador em `/collaborator/blocks`, **When** cria um bloqueio pessoal que afeta agendamentos já marcados, **Then** o sistema exibe alerta claro com `affectedAppointments` e permite remover o bloqueio posteriormente.
3. **Given** o Colaborador em `/collaborator/schedule` e `/collaborator/services`, **When** abre essas visões, **Then** visualiza sua grade semanal (`GET /me/work-schedules`) e seus serviços com percentuais de comissão (`GET /me/services`) em formato somente leitura e `tabular-nums`.

---

### User Story 5 - Experiência Multi-País e Bilíngue Brasil & Venezuela (Priority: P5)

Usuários no Brasil (`pt-BR`, DDI `+55`) e na Venezuela (`es`, DDI `+58`) alternam o idioma da interface de forma consistente, visualizam todas as datas e horários no `timezone` oficial da empresa sem erros de hidratação, e informam números de WhatsApp válidos para ambos os países.

**Why this priority**: É requisito estrutural de produto para operação binacional, reduzindo atrito para clientes e equipes venezuelanas e brasileiras desde o lançamento.

**Independent Test**: Pode ser testada alternando o seletor de idioma entre `pt-BR` e `es` nas rotas públicas e autenticadas, verificando ausência de textos hardcoded fora de idioma, ausência de warnings de hidratação no console e submissão de reservas com telefones `+55` e `+58`.

**Acceptance Scenarios**:

1. **Given** qualquer tela do sistema (`/login`, `/register`, `/book/[companyId]`, `/owner/*`, `/collaborator/*`), **When** o usuário alterna o idioma entre Português (`pt-BR`) e Espanhol (`es`), **Then** todos os rótulos, botões, mensagens de validação, estados vazios e alertas mudam integralmente para o idioma escolhido.
2. **Given** um navegador configurado em fuso horário diferente do `timezone` da empresa (ex.: navegador em `America/Caracas` acessando empresa em `America/Sao_Paulo`), **When** a página é carregada e hidratada, **Then** não ocorre nenhum erro ou aviso de hidratação e todos os horários exibidos respeitam rigorosamente o `timezone` da empresa.

---

### User Story 6 - Personalização Visual nos Dashboards (Light/Dark + 5 Paletas) (Priority: P2)

O cliente (Owner ou Colaborador) alterna instantaneamente dentro do seu painel (`/owner/*` ou `/collaborator/*`) entre **Modo Claro e Modo Escuro** e escolhe entre **5 paletas de cores** sem tons de marrom (`cobalt` padrão inicial, `rose`, `emerald`, `velvet`, `obsidian`), aplicadas dinamicamente via CSS variables (`data-palette`) no wrapper do dashboard com contraste WCAG 2.2 AA e persistidas no navegador sem afetar a identidade editorial fixa da Landing Page e de `/login`/`/register`.

**Why this priority**: Permite que cada barbearia, salão feminino ou clínica de estética adapte o painel ao seu ambiente de iluminação e identidade visual sem custo de desenvolvimento.

**Independent Test**: Pode ser testada alternando Claro/Escuro e selecionando cada uma das 7 paletas na topbar/header, recarregando a página para validar persistência no navegador e checando ausência de warnings de hidratação.

**Acceptance Scenarios**:

1. **Given** o usuário na topbar do painel ou header público, **When** alterna entre Modo Claro e Modo Escuro, **Then** toda a interface atualiza suas superfícies, bordas e textos preservando contraste WCAG 2.2 AA.
2. **Given** o seletor visual das 7 paletas com círculos de cor, **When** o usuário escolhe qualquer paleta (`rose`, `cobalt`, `barber-gold`, `terracotta`, `emerald`, `velvet`, `obsidian`), **Then** a cor primária/acento (`--primary` / `--accent-primary`) é aplicada imediatamente em botões, indicadores ativos e badges, e mantida após recarregar a página.

---

### Edge Cases

- **Empresa inativa ou inexistente em `/book/[companyId]`:** A API retorna `404`; a página exibe `not-found.tsx` amigável sem vazar stack trace ou URL interna.
- **Empresa ativa sem serviços ativos ou sem horários livres na data escolhida:** Exibir estado vazio claro com orientação (ex.: "Nenhum horário livre nesta data — tente outro dia ou selecione 'Qualquer disponível'").
- **Bloqueio de agenda com `affectedAppointments` não vazio:** Destacar visualmente a quantidade e a lista de agendamentos afetados (horário, cliente, serviço) logo após a confirmação da API, para que Owner ou Colaborador possa reagendar ou avisar os clientes.
- **Sessão expirada (`401`) durante preenchimento de formulário ou navegação:** Interceptar globalmente no cliente HTTP, limpar credenciais locais, preservar mensagem explicativa de sessão expirada e redirecionar para `/login`.
- **Erro de rede ou API indisponível (`5xx` / timeout):** Renderizar estado de erro recuperável (botão "Tentar novamente" e `error.tsx` no nível do segmento) sem travar a navegação.
- **Duplo clique em submissão de reserva ou criação de registro:** Desabilitar botão durante envio com indicador de carregamento para evitar chamadas duplicadas.
- **Telas muito estreitas (`320px`) e nomes longos de serviços/empresas:** Aplicar truncamento ou quebra controlada (`text-balance`, `min-w-0`), garantindo zero scroll horizontal acidental.

---

## Mapa de Rotas App Router e Fronteiras Server/Client

### Mapa de Rotas (`app/`)

| Rota | Route Group / Segmento | Acesso | Responsabilidade |
| --- | --- | --- | --- |
| `/` | `app/page.tsx` | Público | Entrada leve redirecionando ou oferecendo acesso rápido a `/login` e `/register`. |
| `/login` | `app/(auth)/login/page.tsx` | Público | Login unificado (`POST /auth/login` + `GET /me` → `/owner` ou `/collaborator`). |
| `/register` | `app/(auth)/register/page.tsx` | Público | Cadastro de Owner + Empresa com seletor de `timezone` IANA (`POST /auth/register`). |
| `/book/[companyId]` | `app/book/[companyId]/page.tsx` | Público | Reserva pública em etapas; inclui `loading.tsx`, `error.tsx` e `not-found.tsx` (em `404`). |
| `/owner` | `app/(owner)/owner/page.tsx` | `OWNER` | Agenda da empresa (filtros, criação manual `CONFIRMED`, status, reagendamento). |
| `/owner/blocks` | `app/(owner)/owner/blocks/page.tsx` | `OWNER` | Bloqueios individuais e globais com alerta de `affectedAppointments`. |
| `/owner/team` | `app/(owner)/owner/team/page.tsx` | `OWNER` | Listagem, cadastro e ativação/desativação de colaboradores. |
| `/owner/services` | `app/(owner)/owner/services/page.tsx` | `OWNER` | CRUD de serviços, status, vínculo de colaboradores + comissão (%) e grade semanal (`work_schedules`). |
| `/owner/settings` | `app/(owner)/owner/settings/page.tsx` | `OWNER` | Atualização de `timezone` da empresa e cópia do link público `/book/[companyId]`. |
| `/collaborator` | `app/(collaborator)/collaborator/page.tsx` | `COLLABORATOR` | Minha agenda com atualização de status. |
| `/collaborator/blocks` | `app/(collaborator)/collaborator/blocks/page.tsx` | `COLLABORATOR` | Gestão de bloqueios pessoais com alerta de `affectedAppointments`. |
| `/collaborator/schedule` | `app/(collaborator)/collaborator/schedule/page.tsx` | `COLLABORATOR` | Visualização da grade semanal (`GET /me/work-schedules`). |
| `/collaborator/services` | `app/(collaborator)/collaborator/services/page.tsx` | `COLLABORATOR` | Visualização dos serviços e comissões vinculados (`GET /me/services`). |

> **Navegação Mobile (Bottom Tab Bar ≤ 5 itens):**
> - **Owner (`5` itens):** Agenda, Bloqueios, Equipe, Serviços, Config.
> - **Colaborador (`4` itens):** Agenda, Bloqueios, Horários, Serviços.

### Estratégia de Autenticação e Sessão (JWT Bearer sem lógica de negócio no Next.js)

- **Emissão:** `POST /auth/login` e `POST /auth/register` na API Fastify (`NEXT_PUBLIC_API_URL`) retornam o JWT no corpo JSON (`token` / `accessToken`).
- **Transporte:** Todas as requisições autenticadas enviam o cabeçalho `Authorization: Bearer <token>` por meio de um cliente HTTP centralizado (`lib/api-client.ts`).
- **Armazenamento e Hidratação Segura:** O token é armazenado no navegador e lido **exclusivamente dentro de `useEffect`** após a montagem do componente de sessão (`AuthProvider` / `AuthGuard`), nunca durante a renderização inicial. Durante a verificação inicial, servidor e cliente renderizam o mesmo skeleton neutro, garantindo **zero erros de hidratação**.
- **Validação de Sessão e Papel:** A única fonte de verdade para autenticação, perfil, `role` (`OWNER` | `COLLABORATOR`) e dados da empresa (`company.timezone`, `company.companyName`, `company.id`) é `GET /me` na API Fastify. O Next.js NÃO decodifica nem valida regras de permissão por conta própria.
- **Proteção de Rotas e Logout Automático em `401`:**
  - `(owner)/layout.tsx` envolve o conteúdo em `AuthGuard` exigindo `role === "OWNER"`.
  - `(collaborator)/layout.tsx` envolve o conteúdo em `AuthGuard` exigindo `role === "COLLABORATOR"`.
  - Qualquer resposta `401` em qualquer endpoint autenticado dispara limpeza imediata da sessão e redirecionamento para `/login`.

### Fronteiras Server/Client e Cache Components (Next.js 16)

- **Server Components (padrão):**
  - `app/layout.tsx`: fontes (`next/font`), tokens CSS (`globals.css`), metadata base e provider mínimo de idioma (`LocaleProvider`).
  - `app/book/[companyId]/page.tsx`: Server Component que delega o carregamento inicial de `GET /public/companies/:companyId/services` a um componente assíncrono envolvido em `<Suspense fallback={<BookingSkeleton />}>` (respeitando `cacheComponents: true` do Next.js 16 para não bloquear o *static shell*). Em resposta `404`, chama `notFound()` para acionar `app/book/[companyId]/not-found.tsx`.
  - Layouts `(auth)/layout.tsx`, `(owner)/layout.tsx`, `(collaborator)/layout.tsx` e as `page.tsx` permanecem Server Components, compondo a estrutura semântica e delegando apenas as folhas interativas aos Client Components.
- **Client Components (`"use client"` isolado nas folhas):**
  - Formulários de login/registro (`LoginForm`, `RegisterForm`).
  - Fluxo interativo de reserva (`BookingWizard`: seleção de serviço, profissional, calendário/horários via `GET /public/companies/:companyId/availability`, formulário de cliente `+55`/`+58` e envio `POST /public/companies/:companyId/appointments`).
  - Guarda de sessão e shell interativo de navegação (`AuthGuard`, `DashboardShell`, `LocaleSwitcher`).
  - Módulos interativos dos dashboards (filtros, tabelas/cards com ações, modais de criação/reagendamento, editor de `work_schedules`, formulário de bloqueios com `ConflictAlert`, formulário de `timezone` + botão copiar link).
- **Zero Server Actions / Route Handlers de domínio:** Nenhuma regra de validação de conflito, persistência ou autenticação é criada em `app/api/` ou `"use server"`.

### Organização Modular do Código

- **`components/ui/`:** Componentes base reutilizáveis de apresentação e acessibilidade (botões, inputs, selects, badges de status, cards, skeletons, modais/drawers, alertas de conflito), sem acoplamento a endpoints da API.
- **Componentes de domínio colocalizados por grupo de rotas:** Componentes específicos de cada fluxo vivem junto à sua rota em `app/(auth)/_components/`, `app/(owner)/_components/`, `app/(collaborator)/_components/` e `app/book/[companyId]/_components/`, mantendo alta coesão e evitando pastas globais infladas.
- **`lib/`:** Camada isolada de infraestrutura do frontend contendo cliente HTTP centralizado (`lib/api-client.ts` com `Authorization: Bearer <token>` e interceptação global de `401`), contratos e tipos TypeScript alinhados ao Swagger (`lib/types/`), formatadores determinísticos de data/hora/moeda/telefone `+55`/`+58` (`lib/format.ts`), utilitários de sessão (`lib/auth.ts`) e dicionários de internacionalização `pt-BR`/`es` (`lib/i18n/`).
- **Disciplina `"use client"`:** A diretiva `"use client"` permanece estritamente restrita aos componentes-folha interativos (formulários, filtros, modais, seletores de horário, guarda de sessão e controles de idioma/cópia); páginas, layouts e seções estáticas permanecem Server Components.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (Autenticação e Registro):** O sistema DEVE oferecer cadastro de empresa + Owner em `/register` com seleção de `timezone` IANA (incluindo opções de Brasil e Venezuela como `America/Sao_Paulo`, `America/Fortaleza`, `America/Manaus`, `America/Caracas`) e login unificado em `/login`.
- **FR-002 (Roteamento por Papel e Proteção):** Após autenticar, o sistema DEVE consultar `GET /me` com `Authorization: Bearer <token>`, redirecionar `OWNER` para `/owner` e `COLLABORATOR` para `/collaborator`, impedir acesso cruzado entre papéis e executar logout automático com redirecionamento para `/login` diante de qualquer resposta `401`.
- **FR-003 (Agenda do Owner):** O painel `/owner` DEVE listar agendamentos com filtros por data, colaborador e status; permitir criação manual de agendamento (com opção de criar diretamente como `CONFIRMED`); permitir atualização de status e reagendamento via API.
- **FR-004 (Bloqueios do Owner):** O painel `/owner/blocks` DEVE listar bloqueios, permitir criar bloqueios para colaborador específico ou globais da empresa e excluí-los, exibindo alerta destacado com `affectedAppointments` sempre que a API retornar agendamentos impactados.
- **FR-005 (Gestão de Equipe):** O painel `/owner/team` DEVE listar colaboradores, permitir cadastrar novos colaboradores e ativar/desativar seu status.
- **FR-006 (Serviços, Comissões e Grade Semanal):** O painel `/owner/services` DEVE permitir criar, editar e ativar/desativar serviços; listar, vincular, atualizar percentual de comissão e desvincular colaboradores em cada serviço; e visualizar/salvar a grade semanal (`work_schedules`) de cada profissional.
- **FR-007 (Configurações da Empresa):** O painel `/owner/settings` DEVE permitir atualizar o `timezone` da empresa (`PATCH /companies/me/timezone`) e exibir com ação de cópia em um toque o link público `/book/[companyId]`.
- **FR-008 (Portal do Colaborador):** O portal `/collaborator` DEVE oferecer: minha agenda com atualização de status (`GET /me/appointments`, `PATCH /appointments/:appointmentId/status`), gestão dos meus bloqueios pessoais com aviso de `affectedAppointments` (`GET/POST/DELETE /me/schedule-blocks`), visualização da minha grade semanal (`GET /me/work-schedules`) e visualização dos meus serviços e comissões (`GET /me/services`).
- **FR-009 (Reserva Pública):** A rota `/book/[companyId]` DEVE carregar empresa e serviços ativos sem login (exibindo `not-found.tsx` em `404`), conduzir o cliente pelas etapas Serviço → Profissional (ou "Qualquer disponível") → Data e Horário livre (`GET /public/companies/:companyId/availability`) → Nome e WhatsApp (`+55`/`+58`) → Confirmação (`POST /public/companies/:companyId/appointments`).
- **FR-010 (Multi-País e Internacionalização):** Todos os textos e labels da interface DEVEM ficar isolados em dicionários desacoplados suportando alternância `pt-BR` e `es`, com suporte nativo a telefones `+55` (Brasil) e `+58` (Venezuela).
- **FR-011 (Datas, Fusos e Zero Hidratação):** Todas as datas, horários e valores monetários DEVEM ser formatados com `Intl.DateTimeFormat` e `Intl.NumberFormat` utilizando explicitamente `locale` e `timezone` da empresa, sem qualquer leitura de ambiente do navegador durante a renderização inicial.
- **FR-012 (Estados Completos e Acessibilidade):** Todas as telas de dados DEVEM apresentar estados de carregamento (*skeleton*), vazio (com ação), erro (com recuperação via `error.tsx` ou botão de retry) e sucesso, respeitando WCAG 2.2 AA, alvos de toque ≥ `44px`, `tabular-nums`, mobile-first (`320px`–`1440px`) e `prefers-reduced-motion`.
- **FR-013 (Personalização Visual nos Dashboards — Light/Dark + 5 Paletas):** Os painéis autenticados (`/owner/*` e `/collaborator/*`) DEVEM permitir alternância entre Modo Claro e Modo Escuro e seleção entre as 5 paletas (`cobalt` [padrão inicial], `rose`, `emerald`, `velvet`, `obsidian`) aplicadas no wrapper raiz do dashboard via CSS variables com contraste WCAG 2.2 AA e persistência local, preservando a identidade fixa editorial de `/`, `/login` e `/register`.

### Key Entities *(include if feature involves data)*

- **AuthenticatedSession (`GET /me`):** Combinação de `user` (identificador, nome, email), `role` (`"OWNER" | "COLLABORATOR"`) e `company` (`id`, `companyName`, `timezone`, `isActive`).
- **Collaborator:** Profissional vinculado à empresa com identificador, nome, email/contato, status (`isActive`) e grade semanal (`work_schedules`).
- **Service & ServiceCollaborator:** Serviço oferecido pela empresa (nome, duração em minutos, preço, status ativo/inativo) e vínculos com colaboradores contendo o percentual de comissão.
- **WorkSchedule:** Faixas de horário semanal por dia da semana configuradas por colaborador.
- **Appointment:** Agendamento contendo serviço, colaborador, cliente (nome e WhatsApp), início/fim no fuso da empresa e status operacional.
- **ScheduleBlock:** Bloqueio de disponibilidade (escopo individual ou global da empresa) com período, motivo opcional e lista de `affectedAppointments` retornada pela API em caso de sobreposição.
- **PublicCatalog & Availability:** Metadados públicos da empresa (`id`, `companyName`, `timezone`), lista de serviços ativos e slots livres por data/serviço/profissional.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001:** Um cliente final consegue concluir uma reserva pública em `/book/[companyId]` em um smartphone (`375px`) em menos de **90 segundos**, sem necessidade de login e sem scroll horizontal acidental.
- **SC-002:** 100% das rotas autenticadas (`/owner/*` e `/collaborator/*`) bloqueiam acesso sem sessão válida, redirecionam automaticamente em resposta `401` e impedem acesso cruzado entre `OWNER` e `COLLABORATOR`.
- **SC-003:** 100% dos fluxos de criação de bloqueio (Owner e Colaborador) exibem claramente os agendamentos impactados (`affectedAppointments`) sempre que a API reportar conflito.
- **SC-004:** Zero erros ou avisos de hidratação no console em qualquer rota, mesmo quando o navegador utiliza fuso horário distinto do `timezone` da empresa.
- **SC-005:** 100% dos textos visíveis da interface alternam corretamente entre Português (`pt-BR`) e Espanhol (`es`), e o formulário público aceita e valida números WhatsApp de Brasil (`+55`) e Venezuela (`+58`).
- **SC-006:** O projeto passa integralmente nos portões de qualidade da Constituição (`npx tsc --noEmit`, `npm run lint` e `npm run build` sem erros) e cumpre contraste WCAG 2.2 AA e alvos de toque ≥ `44px` nas resoluções `320px`, `375px`, `768px` e `1440px`.

---

## Assumptions

- A API Fastify externa (`NEXT_PUBLIC_API_URL`, padrão local `http://localhost:3333`) está configurada com CORS permitindo a origem do frontend Next.js (`http://localhost:3000` em desenvolvimento) e aceita o cabeçalho `Authorization: Bearer <token>`.
- Os payloads exatos de request/response de cada endpoint serão confirmados contra `/docs/json` da API Fastify durante a fase `/speckit-plan` (o servidor local não estava ativo durante a geração desta especificação).
- A moeda exibida para preços de serviços acompanha o contexto da empresa/país (padrão `BRL` para `pt-BR` / `America/Sao_Paulo` e `USD` ou `VES` conforme retornado ou configurado pela API; assumiremos formatação segura baseada no valor retornado pela API e locale selecionado, ajustável na inspeção do Swagger).
- `lucide-react` será instalado na fase de implementação como biblioteca padrão de ícones conforme a Constituição; animações serão implementadas prioritariamente com CSS/transitions nativas (respeitando `prefers-reduced-motion`), evitando instalar GSAP a menos que uma interação específica exija.
- Pagamentos online, notificações automáticas de WhatsApp e recuperação de senha por e-mail estão fora do escopo desta Etapa 4 (pois não constam nos endpoints listados).
