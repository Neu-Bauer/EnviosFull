# EnviosFull

Versão enxuta, só do módulo **Full** (Gestor de Envios Full), extraída do projeto
`gestor-de-estoque`. Pensada para rodar com o banco de dados real da empresa,
separada dos demais módulos do projeto original (Malha/Pallet, RMA, Recebimento,
Superadmin), que continuam existindo só no projeto-mãe.

## O que entrou

- **Backend**: autenticação (login, usuários, cargos/permissões), o módulo Full
  em si (envios, SKUs, motoristas, veículos) e o gerenciador de máscaras de
  bipagem por SKU (tela própria, protegida por senha extra).
- **Frontend**: tela de login e a tela do Gestor de Envios Full. Sem sidebar
  multi-módulo — só existe esse destino depois do login.
- **Banco**: multi-tenant (mantido de propósito — mesma estrutura testada do
  projeto original, com um único tenant cadastrado pela empresa).

## O que ficou de fora

Pallet/Malha, RMA, Recebimento, Superadmin, catálogo de módulos, central de
notificações — tudo isso continua só no repositório `gestor-de-estoque`.

## Primeira configuração

1. `cp backend/.env.example backend/.env` e preencha `DATABASE_URL` (Postgres)
   e `JWT_SECRET`.
2. `cd backend && npm install`
3. `npx prisma migrate deploy` — cria as tabelas na base nova.
   **Tire um backup do banco antes**, se ele já tiver outras tabelas/sistemas.
4. `npx prisma db seed` — cria o tenant, o cargo ADMIN e o usuário `admin`
   (senha definida em `SEED_ADMIN_SENHA`, troque no primeiro login).
5. `npm run dev` — sobe o backend (porta 3001 por padrão).
6. `cp frontend/.env.example frontend/.env` com `VITE_API_URL` apontando pro
   backend, depois `cd frontend && npm install && npm run dev`.

## Migração dos dados reais

Ainda pendente: um script para copiar Motorista/Veículo/MascaraSku/InboundFull/
InboundSku do banco antigo (projeto `gestor-de-estoque`) para este, mapeando
tudo para o tenant criado pelo seed. Fica para quando o acesso ao banco da
empresa estiver definido.
