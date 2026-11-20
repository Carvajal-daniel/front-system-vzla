<!--
Sync Impact Report
- Version change: template (unversioned) -> 1.0.0 (initial ratification)
- Modified principles:
  - [PRINCIPLE_1_NAME] -> I. Stack, Renderização e Fronteira com a API REST (INEGOCIÁVEL)
  - [PRINCIPLE_2_NAME] -> II. Interface, Mobile-First, Movimento e Acessibilidade (INEGOCIÁVEL)
  - [PRINCIPLE_3_NAME] -> III. Hidratação, Segurança e Multi-País — Brasil & Venezuela (INEGOCIÁVEL)
  - [PRINCIPLE_4_NAME] -> IV. Fluxo Spec-Kit e Portões de Qualidade (INEGOCIÁVEL)
- Removed sections:
  - [PRINCIPLE_5_NAME] (template slot consolidated into the 4 core principles defined for this project)
- Added sections:
  - Restrições Técnicas e Convenções do Repositório
  - Fluxo de Desenvolvimento e Validação
- Follow-up TODOs:
  - None in governance text. Note: `lucide-react` (standard icon library) and `gsap` (optional, only when animations are needed) are not yet installed in `package.json` and MUST be added only when required by a feature specification.
-->

# SaaS Gestão de Barbearias e Salões — Frontend Web — Constituição

## Core Principles

### I. Stack, Renderização e Fronteira com a API REST (INEGOCIÁVEL)

O projeto DEVE utilizar exclusivamente a stack oficial configurada no repositório: Next.js `16.4.6` com App Router (`app/`), React `19.3.0`, TypeScript `^5` em modo estrito (`"strict": true` em `tsconfig.json`), Tailwind CSS `4.3.3` via `@tailwindcss/turbopack` e `lucide-react` como biblioteca padrão de ícones.

- **Tokens no Tailwind v4:** Todas as definições de tema, cores, tipografia e espaçamentos DEVEM ser configuradas via `@theme` e variáveis CSS no padrão do Tailwind CSS v4 (`app/globals.css`). É PROIBIDO misturar configurações de `tailwind.config.*` do v3 ou migrar versões/ferramentas sem autorização explícita.
- **Server Components por padrão:** Layouts, páginas, seções estáticas e leitura inicial de dados DEVEM ser Server Components. A diretiva `"use client"` DEVE ser isolada estritamente nas folhas interativas (formulários, seletores de horário, modais, filtros, menus, gráficos e animações). Páginas ou layouts inteiros NÃO DEVEM ser convertidos em Client Components.
- **Fronteira estrita com a API REST externa:** É PROIBIDO duplicar regras de negócio no Next.js. NÃO DEVEM ser criados Server Actions nem Route Handlers com lógica de domínio, validação de conflito de agenda, regras financeiras, autenticação própria ou acesso direto a banco de dados. Toda regra de negócio, autenticação e persistência reside exclusivamente na API REST externa configurada via `NEXT_PUBLIC_API_URL`.
- **Conformidade com Next.js 16:** O projeto opera com `cacheComponents: true` e `partialPrefetching: true` em `next.config.ts`. Antes de usar APIs de cache, renderização, metadata ou prefetch, o desenvolvedor/agente DEVE consultar a documentação local da versão instalada em `node_modules/next/dist/docs/`.

**Justificativa:** Mantém o frontend enxuto, desacoplado do domínio de backend, com menor bundle de JavaScript no cliente e comportamento previsível sob o modelo de renderização do Next.js 16.

### II. Interface, Mobile-First, Movimento e Acessibilidade (INEGOCIÁVEL)

Toda interface (landing pages, fluxo de agendamento público e dashboards administrativos) DEVE cumprir integralmente os padrões de qualidade definidos em `SITE.md`.

- **Mobile-first real:** O layout DEVE ser projetado primeiro para larguras de `320px` a `390px` e escalar até `1440px` sem qualquer scroll horizontal acidental (tabelas ou blocos largos rolam apenas dentro do próprio contêiner). Alturas de tela cheia DEVEM usar `dvh`/`svh`.
- **Ergonomia de toque e navegação:** Todos os alvos de toque interativos DEVEM ter no mínimo `44px × 44px`. Dashboards no mobile DEVEM oferecer navegação inferior (*bottom tab bar*) com até 5 itens principais, preservada por layouts aninhados.
- **Tipografia e números:** Tamanhos de fonte relevantes DEVEM usar tipografia fluida com `clamp()` e `text-balance` em títulos para evitar quebras disformes em `320px`. A classe/propriedade `tabular-nums` é OBRIGATÓRIA em horários, durações, preços, contadores e percentuais.
- **Acessibilidade WCAG 2.2 AA:** Contraste mínimo de `4.5:1` para texto normal e `3:1` para texto grande (inclusive sobre imagens), HTML semântico (`header`, `nav`, `main`, `section`, `footer`), um único `<h1>` por página, foco visível, operação completa por teclado, `aria-label` em botões só com ícone e informação nunca transmitida apenas por cor.
- **Estados completos em telas de dados:** Toda tela ou bloco dependente de dados DEVE implementar explicitamente os quatro estados: carregamento (*skeleton* via `<Suspense>` ou `loading.tsx`), estado vazio (com mensagem clara e ação de recuperação/criação), erro (com recuperação via `error.tsx` por segmento) e sucesso.
- **Movimento responsável:** O respeito a `prefers-reduced-motion` é OBRIGATÓRIO (desativando parallax, pin, scroll suave e loops decorativos). Quando animações GSAP forem utilizadas, DEVEM residir em Client Components isolados, usar `gsap.context()` e `gsap.matchMedia()` com escopo restrito e reversão completa na desmontagem para garantir idempotência em React Strict Mode e navegação entre rotas.

**Justificativa:** Barbearias e salões operam majoritariamente em smartphones sob iluminação variada; previsibilidade tátil, clareza numérica e resiliência de estados impactam diretamente conversão e operação diária.

### III. Hidratação, Segurança e Multi-País — Brasil & Venezuela (INEGOCIÁVEL)

O frontend DEVE garantir renderização determinística entre servidor e cliente, isolamento rigoroso de credenciais e suporte nativo à operação multi-país.

- **Zero erros de hidratação:** O HTML produzido pelo servidor e a primeira renderização no cliente DEVEM ser idênticos. É PROIBIDO ler `window`, `document`, `localStorage`, `matchMedia`, `Math.random()`, `Date.now()` ou formatar datas/horários dependentes do ambiente do navegador durante a renderização inicial.
- **Formatação explícita por empresa:** Datas, horários, durações e valores monetários DEVEM ser formatados exclusivamente com `Intl.DateTimeFormat` e `Intl.NumberFormat` recebendo explicitamente o `locale` e o `timezone` da empresa/tenant, nunca dependendo do fuso ou idioma implícito do navegador.
- **Segurança de variáveis e props:** Nenhum segredo, chave privada ou variável de ambiente sem prefixo `NEXT_PUBLIC_` DEVE ser exposto ao bundle do cliente. Props passadas de Server Components para Client Components DEVEM ser estritamente serializáveis e conter apenas os campos necessários à exibição.
- **Suporte nativo Multi-País e Idioma (Brasil & Venezuela):** O frontend DEVE suportar nativamente Brasil (`pt-BR`, DDI `+55`) e Venezuela (`es`, DDI `+58`), incluindo máscaras/formatação de telefone, moeda, fuso horário e textos da interface. Todos os textos, rótulos, mensagens de validação e labels de UI DEVEM ficar isolados e desacoplados dos componentes (em módulos/dicionários dedicados), sendo PROIBIDO espalhar strings hardcoded de idioma diretamente no JSX dos componentes.

**Justificativa:** Divergências de fuso horário entre servidor e cliente quebram fluxos de agendamento e geram falhas de hidratação; desacoplar textos e formatos permite operar Brasil e Venezuela no mesmo código sem retrabalho.

### IV. Fluxo Spec-Kit e Portões de Qualidade (INEGOCIÁVEL)

Nenhuma feature, correção ou refatoração pode ser considerada concluída sem seguir o fluxo Spec-Kit e passar integralmente pelos portões automatizados de verificação do projeto.

- **Verificações obrigatórias por entrega:** Toda entrega DEVE executar e passar sem erros:
  1. `npx tsc --noEmit` (checagem estrita de tipos TypeScript).
  2. `npm run lint` (ESLint `^9` com `eslint-config-next`).
  3. `npm run build` (build de produção do Next.js).
- **Código limpo e tipado:** É PROIBIDO manter `any` injustificado, código morto, `console.log` de depuração, dependências não utilizadas ou placeholders visuais não sinalizados.
- **Medição honesta:** Metas de performance (`SITE.md`: Lighthouse Performance ≥ 90, Acessibilidade ≥ 95, Boas Práticas ≥ 95, SEO ≥ 90; LCP ≤ 2,5 s, CLS ≤ 0,1, INP ≤ 200 ms) só podem ser declaradas atingidas quando efetivamente medidas em build de produção (`npm run build` + `npm run start`); caso contrário, DEVEM ser reportadas como "não medido".

**Justificativa:** Impede regressões silenciosas de tipagem, lint, hidratação ou empacotamento de produção antes que qualquer módulo avance no ciclo de entrega.

## Restrições Técnicas e Convenções do Repositório

- **Versões fixadas (`package.json`):** `next@16.4.6`, `react@19.3.0`, `react-dom@19.3.0`, `tailwindcss@4.3.3`, `@tailwindcss/turbopack@4.3.3`, `typescript@^5`, `eslint@^9`, `eslint-config-next@16.4.6`. Gerenciador de pacotes: `npm` (`package-lock.json`).
- **Estrutura de pastas:** App Router na raiz (`app/`, sem `src/`), alias `@/*` apontando para `./*` conforme `tsconfig.json`. Organização modular enxuta (`components/ui/`, `components/sections/`, `components/motion/`, `lib/`), colocalizando arquivos específicos de uma única rota junto dela.
- **Recursos otimizados do Next.js:** Imagens DEVEM usar `next/image` com `sizes` adequados, `alt` descritivo e fallback visual em CSS no contêiner; fontes DEVEM usar `next/font` com `display: swap` e variável CSS; SEO DEVE usar Metadata API (`metadata`/`generateMetadata`), aplicando `noindex` em rotas autenticadas e dashboards.
- **Dependências:** Antes de adicionar qualquer pacote novo, verificar se Web APIs, CSS ou recursos nativos do Next.js resolvem. Máximo de uma biblioteca de animação no projeto. `lucide-react` e `gsap` (se necessário) só devem ser instalados no módulo que efetivamente os introduzir.
- **Proibição de migrações unilaterais:** NÃO migrar roteador, versão do Tailwind, gerenciador de pacotes ou estrutura de pastas sem aprovação explícita.

## Fluxo de Desenvolvimento e Validação

1. **Especificação e Planejamento (Spec-Kit):** Toda nova funcionalidade segue `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`, validando aderência a esta Constituição desde a fase de plano (*Constitution Check*).
2. **Revisão de Fronteiras Server/Client:** Antes de encerrar qualquer tarefa, confirmar que cada `"use client"` está no menor componente folha possível e que nenhuma regra de domínio foi duplicada no Next.js.
3. **Validação Técnica e Visual:** Executar `npx tsc --noEmit`, `npm run lint` e `npm run build`. Quando houver acesso ao navegador, validar responsividade em `320px`, `375px`, `768px` e `1440px`, ausência de erros/warnings de hidratação no console, navegação por teclado, contraste AA, estados de dados e comportamento com `prefers-reduced-motion`.

## Governance

- **Supremacia:** Esta Constituição prevalece sobre práticas ad-hoc e orienta todos os artefatos do Spec-Kit (`spec.md`, `plan.md`, `tasks.md`) e revisões de código. Em caso de conflito com `SITE.md` em aspectos de domínio, multi-país ou fronteira de API, prevalece esta Constituição; em critérios visuais, tipográficos, de movimento e acessibilidade, `SITE.md` atua como guia complementar detalhado.
- **Procedimento de Emenda:** Alterações nesta Constituição exigem proposta explícita, aprovação do responsável pelo produto/projeto, atualização do número de versão e registro das mudanças no *Sync Impact Report* (que deve ser removido antes do commit final após revisão humana).
- **Política de Versionamento (SemVer):**
  - `MAJOR`: Remoção ou redefinição incompatível de princípios ou regras inegociáveis.
  - `MINOR`: Adição de novo princípio/seção ou expansão material de diretrizes existentes.
  - `PATCH`: Esclarecimentos, ajustes de redação ou refinamentos não semânticos.
- **Verificação de Conformidade:** Todo plano técnico (`/speckit-plan`) e revisão de entrega DEVE checar explicitamente os 4 princípios fundamentais; qualquer exceção temporária exige justificativa documentada e aprovação explícita.

**Version**: 1.0.0 | **Ratified**: 2026-11-20 | **Last Amended**: 2026-11-20
