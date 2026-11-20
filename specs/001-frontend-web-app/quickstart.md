# Quickstart & Validation Guide: Etapa 4 — Frontend Web

**Feature**: `001-frontend-web-app` | **Date**: 2026-11-20

## 1. Pré-requisitos

- Node.js `>= 20` e `npm`.
- API Fastify em execução em `http://localhost:3333` (Swagger acessível em `http://localhost:3333/docs/json`) com CORS habilitado para `http://localhost:3000`.
- Arquivo `.env.local` na raiz do projeto contendo:
  ```env
  NEXT_PUBLIC_API_URL=http://localhost:3333
  ```

## 2. Comandos de Execução e Portões de Qualidade

```bash
# Instalar dependências (incluindo lucide-react após fase de setup)
npm install

# Desenvolvimento
npm run dev

# Portões obrigatórios da Constituição (todos devem passar sem erros)
npx tsc --noEmit
npm run lint
npm run build

# Produção local (para validação final e medição Lighthouse/Web Vitals)
npm run start
```

## 3. Cenários de Validação End-to-End

Consulte os contratos detalhados em [contracts/api-contracts.md](./contracts/api-contracts.md) e as entidades em [data-model.md](./data-model.md).

### Cenário A — Cadastro, Login e Proteção de Rotas (US2)
1. Abrir `/register`, preencher dados do Owner, nome da empresa e selecionar `America/Sao_Paulo` (ou `America/Caracas`).
2. Confirmar redirecionamento automático para `/owner`.
3. Fazer logout, tentar acessar `/owner` diretamente e confirmar redirecionamento para `/login`.
4. Entrar com usuário `COLLABORATOR`, confirmar redirecionamento para `/collaborator` e verificar que acessar `/owner` redireciona de volta para `/collaborator`.
5. Invalidar/corromper o token local e disparar uma ação: confirmar limpeza da sessão e redirecionamento automático para `/login` em resposta `401`.

### Cenário B — Painel Owner Completo (US3)
1. Em `/owner/team`, cadastrar um colaborador e testar alternância de status ativo/inativo.
2. Em `/owner/services`, criar um serviço, vincular o colaborador com comissão (ex.: `50%`) e salvar sua grade semanal (`work_schedules`).
3. Em `/owner`, criar um agendamento manual já como `CONFIRMED`, filtrar por data/colaborador/status, alterar status e testar reagendamento.
4. Em `/owner/blocks`, criar um bloqueio sobrepondo o agendamento recém-criado e verificar se o alerta `ConflictAlert` exibe os `affectedAppointments`. Excluir o bloqueio em seguida.
5. Em `/owner/settings`, alterar o `timezone` da empresa (ex.: `America/Caracas`) e clicar em copiar o link `/book/[companyId]`.

### Cenário C — Portal do Colaborador (US4)
1. Logar como `COLLABORATOR` e validar `/collaborator` (alterar status de atendimento próprio).
2. Validar `/collaborator/blocks` (criar bloqueio pessoal com conflito e visualizar `affectedAppointments`; excluir bloqueio).
3. Validar `/collaborator/schedule` e `/collaborator/services` em modo somente leitura com `tabular-nums`.

### Cenário D — Reserva Pública Mobile-First e Multi-País (US1 & US5)
1. Acessar `/book/id-inexistente` e confirmar renderização da página `not-found.tsx` sem erro técnico.
2. Acessar `/book/[companyId]` válido em viewport `375px` (e testar `320px`, `768px`, `1440px` sem scroll horizontal).
3. Alternar o seletor de idioma entre `pt-BR` e `es` e confirmar tradução integral da interface.
4. Completar o fluxo: escolher serviço → profissional ou "Qualquer disponível" → data e horário livre (exibido no `timezone` da empresa) → nome + WhatsApp `+55` (ou `+58`) → confirmar e verificar tela de confirmação.
5. Abrir DevTools Console e confirmar **zero erros ou warnings de hidratação**, alvos de toque ≥ `44px` e respeito a `prefers-reduced-motion`.
