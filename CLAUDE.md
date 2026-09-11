# Orkestri — Monorepo MAZA

## Auth

O shell (`apps/maza`) usa Supabase Auth real desde jun/2026 — não é mais gate de
senha única. `src/middleware.ts` chama `updateSession()` de
`@maza/db/supabase/proxy`, valida a sessão via `getUser()` e redireciona pra
`/login` quando não autenticado. `lib/shell-token.ts` foi removido do repo;
`lib/shell-auth.ts` ainda existe mas é código morto (stub sem import em
nenhum lugar).

Use `requireUser()` / `requireRole()` de `@maza/auth/server` em Server
Components/Actions pra resolver sessão e roles.

---


Sistema operacional de inteligência da Maza.
Repo: `github.com/ikeguimaraes-dot/orkestri` (ex maza, fundido com maza-inteligencia em jun/2026).

## ⚠️ Antes de qualquer execução

Sempre confirme `pwd` e `git remote -v`. O clone correto é
Projeto Maza em monorepo local.
Ignore completamente os diretórios `_OLD_*_DELETAR`.

## Estrutura

```
apps/
  maza/         Shell — Vercel projeto "maza" (rootDir apps/maza), multi-zones:
                  /financeiro, /pessoas, /operacao, /compras, /comercial, /marca,
                  /inteligencia, /orquestrador, /mise são proxiados via rewrites
                  para os apps-célula. NÃO remover assetPrefix/rewrites sem entender isso.
                  Inteligência NÃO é um app separado — foi absorvida em
                  apps/maza/src/app/(dashboard)/inteligencia/ na fusão de jun/2026.
                  Handler do Learning Machine: apps/maza/src/app/api/cron/
                  learning-machine — existe, mas sem cron ativo disparando
                  (ver Regras > Crons).
packages/
  core/           @maza/core — KERNEL. score-policy.ts e learning-machine.ts vivem
                  SOMENTE aqui. Nunca criar cópias locais nos apps.
  auth/ db/ ui/   @maza/auth, @maza/db, @maza/ui — pacotes fonte TS (transpilePackages).
supabase/
  migrations/     Pasta ÚNICA de migrations. Numeração sequencial — conferir
                  supabase/MIGRATIONS.md pro próximo número livre (082 é a
                  última aplicada, conferido em 2026-09-09). Duplicatas
                  históricas documentadas ali — não renomear aplicadas.
```

## Regras

- **Migrations**: via `supabase db query --linked --file` — NUNCA `db push`. Numeração sequencial — ver `supabase/MIGRATIONS.md` pro próximo número livre.
- **score-policy / learning-machine**: alterações só em `packages/core`. Os dois apps importam `@maza/core` e `@maza/core/learning-machine`. A notificação Discord da LM é injetada pelo caller (`opts.notify`) — o core não conhece Discord.
- **Crons**: NENHUM configurado hoje. Havia um `vercel.json` na raiz do repo com 10 crons (orchestrator, learning-machine, daily-summary, lorean-import), mas o rootDir do projeto Vercel é `apps/*` — esse arquivo era ignorado no deploy real e foi removido em 2026-09-11 pra não passar falsa sensação de cron ativo. Pra ativar de fato, criar `apps/maza/vercel.json` (ainda não existe).
- **Deploys**: produção do shell historicamente sai via CLI `--prebuilt` (bot) — a Vercel pode não buildar o main. Antes de mexer em deploy, rode `npm run build` (turbo, 2 apps) e `npm run type-check` localmente.
- **Build local**: o Turbopack root está fixado nos next.config (`turbopack.root`) por causa de lockfile perdido na HOME — não remover.
- Segredos nunca inline — só env vars referenciadas por nome.
- Idempotência: executar 2× nunca duplica. Sucesso só com confirmação no banco.
- Event handlers nunca em Server Components — extrair Client Component.

## Supabase

Projeto principal: `dncqjezvndoxeqpklefy` (nome "maza" no dashboard,
compartilhado pelos 2 apps e células). Confirmado via `supabase projects list`
em 2026-09-11.
Serena (isolado): `fgntcrxuhfwcauvahaiz`.

⚠️ `iqgrvptrtphvbmvrqntm` (nome "kph-os-dev") aparece em código/docs antigos
por herança do clone original do repo — é de **outro grupo**, não usar.

## Unidades e CNPJs

Cada unidade tem MAIS DE UM CNPJ. Razão social NÃO indica unidade — só o CNPJ.

| CNPJ | Razão Social | Unidade |
|---|---|---|
| 39268770000155 | IKY RESTAURANTES LTDA | Yoshimori |
| 36332164000163 | YOSHIMORI RESTAURANTE LTDA | Yoshimori |
| 63116533000153 | MZ DELIVERY LTDA | IKY Delivery |
| 63092631000106 | IKY DELIVERY LTDA | IKY Delivery |

Atenção: "IKY" aparece nas duas unidades — IKY RESTAURANTES é a Yoshimori.
A fonte de verdade é a tabela `unit_cnpjs` no Supabase, não `units.cnpj`
(legada).

## Rotas locais que sombreiam zonas

Rewrites do shell são `afterFiles`, então uma página local vence a zona com o
mesmo prefixo. Colisões conhecidas:

- `/financeiro` — RESOLVIDO em 2026-09-10 (página local removida).
- `/orquestrador` — sombreamento total; a zona aponta pra `INTELIGENCIA_APP_URL`.
- `/pessoas/headcount`
- `/inteligencia/metas`

Antes de criar página local sob um prefixo de zona, verifique se já existe
zona configurada pra ele em `apps/maza/next.config.ts`.
