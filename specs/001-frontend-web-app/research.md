# Research & Technical Decisions: Etapa 4 — Frontend Web

**Feature**: `001-frontend-web-app` | **Date**: 2026-11-20

## 1. Next.js 16 `cacheComponents: true` & `partialPrefetching: true`

- **Decision:** Todas as rotas com acesso a `params` dinâmicos ou `fetch` não cacheado (`/book/[companyId]`) delegarão o carregamento assíncrono a um Server Component filho envolvido em `<Suspense fallback={...}>`, nunca fazendo `await params` ou `await fetch` diretamente no nível raiz de `layout.tsx` ou sem `<Suspense>` em `page.tsx`.
- **Rationale:** Conforme verificado na documentação local `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`, quando `cacheComponents: true` está ativo em `next.config.ts`, leituras dinâmicas fora de `<Suspense>` disparam erro de `blocking-route` em dev/build. Empurrar o `await` para dentro de `<Suspense>` preserva o *static shell* e garante `notFound()` imediato em `404` da API sem cachear respostas de empresas desativadas.
- **Alternatives considered:** Desabilitar `cacheComponents` em `next.config.ts` (rejeitado pela Constituição: proibido alterar arquitetura/configuração sem necessidade real) ou usar `"use cache"` com longa duração em `/book/[companyId]` (rejeitado porque desativação de empresa/serviço precisa refletir rapidamente).

## 2. Autenticação JWT Bearer com Zero Erros de Hidratação

- **Decision:** `POST /auth/login` e `POST /auth/register` retornam o JWT no corpo JSON (`token` ou `accessToken`, normalizado pelo cliente HTTP). O token é salvo no navegador (`localStorage` sob chave prefixada) e **nunca** lido durante a renderização inicial. O componente `AuthGuard` renderiza um skeleton determinístico idêntico no servidor e no primeiro paint do cliente; dentro de `useEffect`, lê o token e valida a sessão exclusivamente via `GET /me` (`Authorization: Bearer <token>`). Qualquer `401` em qualquer chamada de `lib/api-client.ts` limpa o token e redireciona para `/login`.
- **Rationale:** Atende simultaneamente à API Fastify (Bearer JWT em JSON), à proibição constitucional de criar lógica de negócio/autenticação em Server Actions ou Route Handlers do Next.js, e à garantia de zero erros de hidratação.
- **Alternatives considered:** Criar Route Handlers `/api/auth/login` em Next.js para encapsular JWT em cookie `HttpOnly` (descartado inicialmente para evitar qualquer camada BFF/proxy no Next.js e manter simplicidade; pode ser revisitado apenas se o backend Fastify passar a emitir cookies `HttpOnly` diretamente).

## 3. Tailwind CSS v4 (`@theme inline`) e Direção de Arte

- **Decision:** Configurar todos os tokens visuais (*Warm Luxury + Modern Editorial*: fundo `#FAF8F5`, superfície `#FFFFFF`, borda `#E7E2D8`, texto `#171614`, acento cobre `#9A3412` / `#B45309`, semânticas AA) diretamente em `app/globals.css` usando `@theme inline` e variáveis CSS, carregando fontes com `next/font/google` (`Fraunces` para títulos editoriais, `Plus_Jakarta_Sans` para UI e `Geist_Mono` para códigos/horários se necessário) em `app/layout.tsx`.
- **Rationale:** O projeto utiliza `tailwindcss@4.3.3` com `@tailwindcss/turbopack@4.3.3`, onde `@theme` substitui `tailwind.config.*`. O contraste de `#9A3412` sobre `#FFFFFF` e `#FAF8F5` supera `7:1` (acima de WCAG 2.2 AA `4.5:1`).
- **Alternatives considered:** Manter o tema padrão cinza/branco do `create-next-app` (rejeitado pelo teste anti-template do `SITE.md`) ou usar tema escuro padrão em dashboards (rejeitado por pior legibilidade em ambientes iluminados de barbearias/salões).

## 4. Formatação de Datas, Fusos Horários e Multi-País (BR & VE)

- **Decision:** Centralizar toda formatação em `lib/format.ts` utilizando `Intl.DateTimeFormat(locale, { timeZone: companyTimezone, ... })` e `Intl.NumberFormat(locale, ...)` com parâmetros explícitos. Nunca chamar `new Date().toLocaleString()` sem `timeZone`. Para i18n, usar dicionários TypeScript estritamente tipados (`lib/i18n/pt-BR.ts` e `lib/i18n/es.ts`) com `LocaleProvider` inicializando em `"pt-BR"` de forma determinística no SSR e sincronizando preferência salva do usuário em `useEffect` (sem mismatch de hidratação). Para WhatsApp, `PhoneInput` oferece seletor `+55` (Brasil: 10–11 dígitos nacionais) e `+58` (Venezuela: 10 dígitos nacionais, ex.: `412`/`414`/`416`/`424`/`426`), normalizando para formato E.164 (`+55...` / `+58...`).
- **Rationale:** Elimina divergências de hidratação entre fuso do servidor Node e fuso do navegador do cliente, e isola 100% das strings de UI fora do JSX.
- **Alternatives considered:** Instalar `next-intl` ou `dayjs`/`luxon` (rejeitados por YAGNI: `Intl` nativo do runtime moderno + dicionários TypeScript tipados cobrem 100% dos requisitos sem adicionar dependências nem complexidade de roteamento por prefixo de idioma).

## 5. Dependência de Ícones e Animações

- **Decision:** Instalar apenas `lucide-react` (explicitamente previsto na Constituição v1.0.0) na fase de implementação. Utilizar transições CSS nativas condicionadas a `@media (prefers-reduced-motion: reduce)` em vez de adicionar `gsap` nesta etapa.
- **Rationale:** Dashboards operacionais e formulários em etapas precisam de feedback tátil rápido e bundle enxuto; CSS nativo atende com zero overhead de JS e sem risco de vazamento de ScrollTriggers.
- **Alternatives considered:** Instalar `gsap` desde o início (rejeitado conforme `SITE.md` seção 6.3: não instalar biblioteca de animação quando CSS nativo resolve).

## 6. Validação de Contratos contra Swagger (`/docs/json`)

- **Decision:** Como `http://localhost:3333/docs/json` não estava acessível durante a fase de planejamento, os contratos em `contracts/api-contracts.md` documentam os endpoints exatos informados pelo usuário com os nomes de campos padronizados em camelCase do Fastify, incluindo uma camada defensiva leve no mapeamento de resposta (`token ?? accessToken`) e uma nota explícita para validar os campos exatos no Swagger assim que a API local for iniciada na fase de implementação.
- **Rationale:** Permite avançar no desenho estrutural sem bloqueio, preservando segurança de tipos e transparência sobre o que será confirmado em tempo de execução.
- **Alternatives considered:** Bloquear todo o planejamento até o servidor local subir (rejeitado por ser desnecessário para estruturar módulos, UI e fluxos).
