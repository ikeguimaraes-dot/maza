# Diagnóstico Auth — Maza

> Atualizado em 2026-06-17 (Sprint 3). Versão original: 2026-06-15 (Sprint 1).
> Base: auditoria de código, commits, diffs, verificação funcional (hotfix lockdown).

---

## 1. Por que o middleware foi parar na raiz — e por que nunca funcionou

### Linha do tempo precisa

| Data | Commit | O que aconteceu |
|---|---|---|
| 2026-04-26 | `777501c` | Auth implementado: lógica de sessão em `src/proxy.ts` (arquivo de nível raiz do monolito). Build mostrava `ƒ Proxy (Middleware)` em alguma configuração — os detalhes exatos desse commit não estão disponíveis neste repositório pós-migração. |
| 2026-04-28 | `397fdc8` | Bypass temporário para testes do módulo Ponto: arquivo de middleware esvaziado para `NextResponse.next()`. Comentário: "restaurar antes de produção real". |
| 2026-04-29 | `ac63f35` | Middleware restaurado com lógica de auth. `/api/auth-debug` adicionado à lista pública para diagnóstico. |
| 2026-04-29 | `4bb77af` | Fix: `await cookies()` explicitado em `getCurrentUser()`, `cookieStore` passado como argumento. Motivo: Next.js 14+ exige `cookies()` chamado diretamente — não pode ser inferido novamente pelo callee. |
| **2026-04-30** | **`0976701`** | **"chore: desativa autenticação — acesso livre sem login."** Três mudanças simultâneas: (1) middleware simplificado para `NextResponse.next()`, (2) `requireUser()` retorna usuário bypass, (3) `createSupabaseServerClient()` usa `service_role` sem sessão. |
| 2026-05-22 | `0052892` | Migração para monorepo Turborepo. Arquivos de `src/` copiados para `apps/maza/src/`, mas o middleware (fosse `middleware.ts` ou `proxy.ts` na raiz do monolito) **não estava num padrão glob standard e não foi migrado**. |
| 2026-05-24 | `daf1d20` | `ignoreBuildErrors: true` e `ignoreDuringBuilds: true` adicionados a todos os `next.config.ts` para destravar deploys durante migração multi-zona. |
| 2026-06-12 | `bc69d38` | Hotfix lockdown: `apps/maza/src/middleware.ts` com 401 total criado. |
| 2026-06-12 | `fedc4ee` | Revert: `src/middleware.ts` deletado, sistema restaurado ao estado livre. **Sprint 3 precisa criar este arquivo com auth real.** |

### Confirmação experimental: `src/middleware.ts` funciona no Next 16

O hotfix `bc69d38` criou `apps/maza/src/middleware.ts` com `export function middleware()` e retornou 401 em toda rota — **confirmado via curl em produção**. Portanto:

- ✅ `apps/maza/src/middleware.ts` + `export function middleware()` → Next 16 reconhece e executa
- ❌ `middleware.ts` na raiz do monorepo → ignorado (o diretório raiz não é o rootDir do projeto Vercel)

> **Correção à versão Sprint 1 deste documento:** A análise anterior mencionava `src/proxy.ts` com função `proxy()` como o arquivo correto para Next 16. Isso era uma inferência não confirmada. O hotfix provou que o padrão correto é `src/middleware.ts` / `middleware()` — exatamente a convenção padrão do Next.js desde a v13.

### O erro fundamental do commit `0976701`

O commit desativou o auth via **três mudanças de camada de aplicação** (não apenas middleware). Mesmo se o middleware estivesse correto, as camadas 2 e 3 já garantiam acesso total:

| Camada | Arquivo | Bypass |
|---|---|---|
| 1 — Middleware | `apps/maza/src/middleware.ts` (inexistente hoje) | `NextResponse.next()` — qualquer rota passa |
| 2 — Auth DAL | `packages/auth/src/server.ts:99-108` | `requireUser()` retorna founder fake sem sessão |
| 3 — DB Client | `packages/db/src/supabase/server.ts:23-33` | `createSupabaseServerClient()` usa `service_role` sem cookie de sessão |

A reativação precisa reverter as **três camadas**.

---

## 2. Qual era o erro de sessão que motivou o bypass

### O que os commits revelam

Não há issue tracker ou mensagem explícita documentando o bug. O que os diffs mostram:

1. O fix do `await cookies()` em `4bb77af` (Apr 29) sugere que `getCurrentUser()` retornava `null` mesmo com sessão ativa — `cookies()` não estava sendo aguardado antes de ser passado para `createSupabaseServerClient()`.

2. Mesmo após o fix, `/api/auth-debug` foi criado no mesmo commit (`ac63f35`) para diagnosticar o problema — a rota foi adicionada ao `PUBLIC_PREFIXES` para ser usada sem login.

3. No dia seguinte (`0976701`), o auth foi desativado — o app continuava redirecionando para `/login` mesmo após o fix.

### Hipótese técnica (baseada no código)

O ciclo de falha era:

```
usuário acessa /dashboard
    ↓
middleware chama updateSession(request)
    ↓
updateSession() chama supabase.auth.getUser() — valida JWT contra servidor Auth
    ↓
getUser() retorna null  ← ponto de falha
    ↓
middleware redireciona para /login?next=/dashboard
    ↓
usuário loga, obtém cookie sb-iqgrvptrtphvbmvrqntm-auth-token
    ↓
retorna para /dashboard — mesmo ciclo
```

**Por que `getUser()` retornava null mesmo com cookie válido?**

Causa mais provável: incompatibilidade entre Next 16 + React 19 e `@supabase/ssr` no padrão de renovação de cookies. O `setAll()` do `server.ts` envolve a escrita em `try/catch` silencioso:

```ts
// packages/db/src/supabase/server.ts:55-63
setAll(cookiesToSet) {
  try {
    for (const { name, value, options } of cookiesToSet) {
      cookieStore.set(name, value, options);
    }
  } catch {
    // Server Component: cookies não podem ser escritos. proxy.ts
    // cuida do refresh. Ignorar é seguro.
  }
}
```

O comentário `"proxy.ts cuida do refresh"` implica que o desenvolvedor sabia que **o token refresh só pode acontecer no middleware** — Server Components não podem escrever cookies. Quando o middleware foi perdido na migração de monorepo, o refresh parou de funcionar, e `getUser()` passou a retornar null depois que o access token (1h de validade) expirava.

### Conclusão

O bug original não era em si do Supabase. Era: o middleware precisa existir e chamar `updateSession()` para escrever tokens renovados na response. Sem middleware → tokens expiram → `getUser()` retorna null → ciclo de redirect infinito.

**Isso significa que o mesmo bug vai acontecer novamente se o middleware for criado sem chamar `updateSession()`** — como uma versão só com `redirect("/login")` sem refresh de token.

---

## 3. Como implementar auth corretamente em `src/middleware.ts`

### Princípio fundamental

Em Next.js App Router, **apenas o middleware pode escrever cookies na response**. Server Components e Server Actions tentam escrever mas falham silenciosamente (por design — o `try/catch` em `server.ts` já trata isso). Portanto:

1. O middleware **deve** chamar `updateSession()` para renovar o token antes que o Server Component leia a sessão
2. O Server Component (`getCurrentUser()`) pode chamar `getSession()` com confiança — o token já foi renovado pelo middleware
3. `requireUser()` pode confiar no resultado de `getCurrentUser()`

### `updateSession()` já está pronta — não recriar

`packages/db/src/supabase/proxy.ts` tem a implementação correta:

```ts
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  // ... cria serverClient com cookies.setAll() que escreve na response ...
  const { data: { user } } = await supabase.auth.getUser();
  return { response, user };  // ← retorna response COM os Set-Cookie headers
}
```

`getUser()` valida o JWT contra o servidor Supabase Auth (não só o cookie local). Se o access token expirou, `@supabase/ssr` chama `setAll()` com os novos tokens antes de retornar — e esses tokens vão para a response via `response.cookies.set()`.

### `apps/maza/src/middleware.ts` — implementação correta

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@maza/db/supabase/proxy";

// Rotas que não exigem sessão
const PUBLIC_PREFIXES = [
  "/login",
  "/api/ponto/punch",       // colaboradores batem ponto sem sessão browser
  "/api/orchestrator/",     // webhooks externos com autenticação própria (HMAC/CRON_SECRET)
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // updateSession() faz: refresh do token + validação + retorna response com Set-Cookie
  const { response, user } = await updateSession(request);

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Exclui _next/* (assets), arquivos estáticos, e imagens
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

### Por que `updateSession()` e não `getUser()` diretamente

| Abordagem | Problema |
|---|---|
| `const user = await supabase.auth.getUser()` direto | Não tem como escrever cookies de refresh — `NextResponse.next()` não tem os Set-Cookie headers |
| `updateSession(request)` via `@maza/db/supabase/proxy` | ✅ Cria response com set-cookie correto, retorna user validado |

### Fluxo após ativação

```
Browser → /dashboard
    ↓
middleware: updateSession(request)
    ↓
  access token válido? → getUser() retorna user → NextResponse com token renovado
  access token expirado? → setAll() escreve novo token na response → getUser() retorna user
  refresh token expirado/inválido? → getUser() retorna null → redirect /login
    ↓
Server Component (dashboard/page.tsx)
    ↓
requireUser() → getCurrentUser() → getSession() (lê cookie já renovado pelo middleware)
    ↓
Renderiza com user real
```

### O que muda nos Server Components após ativação

Nada. `getCurrentUser()` já chama `getSession()` (leitura local do JWT, sem rede) e retorna o user. Mas o user agora será real — não o bypass `00000000-0000-0000-0000-000000000001`.

A única mudança comportamental: `requireUser()` vai chamar `redirect("/login")` quando não houver sessão, e o Next.js trata isso via exceção `NEXT_REDIRECT` (já tratada pelo `isNextInternal()` existente em `getCurrentUser()`).

---

## 4. Lista completa de tudo que precisa mudar

### Arquivos — criação

| Arquivo | Ação |
|---|---|
| `apps/maza/src/middleware.ts` | CRIAR — implementação da seção 3 acima |

### Arquivos — edição

| Arquivo | Linhas | O que mudar |
|---|---|---|
| `packages/auth/src/server.ts` | 98-108 | Remover bloco bypass: substituir o retorno fictício por `redirect("/login")` |
| `packages/db/src/supabase/server.ts` | 23-33 | Remover bloco `hasSession` / fallback service_role: sem sessão, retornar anon client (RLS filtra dados — não crasha) |
| `apps/maza/src/lib/pessoas/ponto-actions.ts` | 65-66 | Remover `BYPASS_USER_ID = "ac559fa1..."`. A rota `/api/ponto/punch` é pública no middleware, mas o `userId` deve vir do token HMAC ou da sessão do colaborador — definir antes de codar |
| `apps/maza/src/lib/pessoas/actions.ts` | 1269 | Remover `const BYPASS_USER_ID = "ac559fa1..."` e seus usos no escopo |
| `apps/maza/src/app/api/intelligence/insight/route.ts` | POST handler | Adicionar `requireUser()` antes de chamar Anthropic — hoje é 100% público, consome API paga sem auth |
| `apps/maza/src/app/api/auth-debug/route.ts` | inteiro | DELETAR o arquivo — a rota não tem valor em produção |

> **Nota sobre `ponto-actions.ts`:** O UUID `ac559fa1-f10b-4ec4-9f4b-fafbc881a884` é diferente do bypass UUID da DAL (`00000000...`). É possivelmente o ID real de um usuário de testes no Supabase. Confirmar antes de remover — pode afetar registros históricos de ponto.

### Migrations SQL (somente geração — aplicar via `supabase db query --linked --file`)

| Arquivo | Status | Conteúdo |
|---|---|---|
| `supabase/migrations/080_security_hardening.sql` | ⏳ Gerada, aguarda aplicação | RLS hardening, audit_log, índices de segurança |
| `supabase/migrations/081_disable_bypass_user.sql` | ❌ A gerar | Desabilitar a conta técnica de bypass — aditivo, não DELETE (preserve FK em registros históricos) |

### Variáveis de ambiente

Nenhuma nova env var é necessária para a reativação. O middleware usa:
- `NEXT_PUBLIC_SUPABASE_URL` — já configurada no Vercel
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — já configurada no Vercel

`SUPABASE_SERVICE_ROLE_KEY` continua necessária para `createServiceClient()` usado em server actions legítimas (audit_log, jobs internos). Não remover.

### Rotas com autenticação própria (não alterar no Sprint 3)

| Rota | Auth atual | Ação |
|---|---|---|
| `/api/orchestrator/escalate` | Bearer `CRON_SECRET` (linha 38) | OK — manter fora dos PUBLIC_PREFIXES, mas confirmar fail-closed se env var ausente |
| `/api/orchestrator/webhook` | A verificar se tem HMAC | Verificar antes de expor |
| `/api/ponto/punch` | Sem auth browser (colaboradores) | Manter como rota pública no middleware |
| `/api/cron/*` | Vercel cron (IP filtering) | Verificar `CRON_SECRET` em cada handler |

### Sequência de execução recomendada para o Sprint 3

1. **Pré-teste local** — antes de qualquer commit: criar `src/middleware.ts`, rodar localmente com Supabase real, verificar que login → dashboard funciona sem loop de redirect.
2. **Commit 1** — `src/middleware.ts` + revert `requireUser()` + revert `server.ts` (as três camadas juntas — implantar parcialmente deixa o sistema inconsistente).
3. **Commit 2** — remover bypass UUIDs de `ponto-actions.ts` e `actions.ts` (após confirmar comportamento correto do ponto).
4. **Commit 3** — deletar `auth-debug`, adicionar auth em `insight`, migration 081.
5. **Pós-deploy** — aplicar migrations 080 e 081 via `supabase db query --linked --file`.
6. **Trocar credencial compartilhada** — após auth funcional.

---

## Apêndice A — Como o sistema funcionou sem middleware (contexto)

Caminho completo de uma request pré-lockdown, com as três camadas de bypass:

```
Browser → /dashboard (anônimo)
    ↓
Nenhum middleware ativo
    ↓
page.tsx → requireUser()
    ↓
getCurrentUser() → createSupabaseServerClient()
    ↓
createSupabaseServerClient(): cookie "auth-token" ausente → service_role
    ↓
supabase.auth.getSession() → null (sem sessão)
getCurrentUser() → null
    ↓
requireUser(): null → retorna bypass { id: "00000000...", role: "founder" }
    ↓
Queries com client service_role → RLS ignorado → todos os dados retornados
```

---

## Apêndice B — `/api/auth-debug` e o que expunha

A rota existiu publicamente de **2026-04-29 a 2026-06-12** (44 dias). Expunha:
- Preview da URL Supabase e anon key (ambas `NEXT_PUBLIC_*` — já expostas no bundle do cliente)
- Preview de 60 chars de cookies `sb-*` (insuficiente para reconstituir token)
- Status de sessão (sempre `{ status: "null" }` com auth desativado)

Risco avaliado como baixo em função do conteúdo, mas a rota não tem valor em produção. **Deletar antes do Sprint 3 ir ao ar.**

---

*Documento na raiz do repo. Próxima atualização: pós-validação local (pré-condição do Sprint 3).*
