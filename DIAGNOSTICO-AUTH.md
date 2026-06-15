# Diagnóstico Auth — KPH-OS

> Documento produzido em 2026-06-15 como requisito do Sprint 1 de Segurança.
> Base: auditoria de código (commits, diffs, arquivos de configuração) e análise
> estrutural. Não há logs de servidor disponíveis neste repositório.

---

## 1. Por que o middleware foi movido para a raiz — e por que nunca funcionou

### Linha do tempo precisa

| Data | Commit | O que aconteceu |
|---|---|---|
| 2026-04-26 | `777501c` | Auth implementado corretamente: `src/proxy.ts` com função `proxy()`, `updateSession()` de `@supabase/ssr`. Build emitia `ƒ Proxy (Middleware)` no log. **Sistema funcionava.** |
| 2026-04-28 | `397fdc8` | Bypass temporário para testes do módulo Ponto: `src/proxy.ts` esvaziado para `NextResponse.next()`. Comentário: "restaurar antes de produção real". |
| 2026-04-29 | `ac63f35` | `src/proxy.ts` restaurado com a implementação completa. `/api/auth-debug` adicionado ao `PUBLIC_PREFIXES` (a rota de diagnóstico precisava ser pública para ser útil). |
| 2026-04-29 | `4bb77af` | Fix: `await cookies()` explicitado em `getCurrentUser()` e `cookieStore` passado como argumento para `createSupabaseServerClient()`. Motivo documentado: Next.js 14+ exige que `cookies()` seja chamado diretamente e o resultado passado adiante, não inferido novamente pelo callee. |
| **2026-04-30** | **`0976701`** | **"chore: desativa autenticação — acesso livre sem login."** Três mudanças simultâneas: (1) `middleware.ts` na raiz simplificado para `NextResponse.next()`, (2) `requireUser()` passa a retornar usuário bypass, (3) `createSupabaseServerClient()` usa `service_role` sem sessão. |
| 2026-05-22 | `0052892` | Migração para monorepo Turborepo. `src/proxy.ts` **não foi migrado** para `apps/kph-os/src/proxy.ts`. Arquivo perdido na reestruturação. |
| 2026-05-24 | `daf1d20` | `ignoreBuildErrors: true` e `ignoreDuringBuilds: true` adicionados a todos os `next.config.ts` para destravar deploys durante a migração multi-zona. |
| 2026-06-12 | `bc69d38` | Hotfix lockdown: `apps/kph-os/src/middleware.ts` com 401 total. |

### O erro fundamental do commit `0976701`

O commit modificou `middleware.ts` (raiz do monolito na época), mas o arquivo que o Next 16 procura é `src/proxy.ts` com função `proxy()`. Na data do commit, `src/proxy.ts` ainda existia e ainda continha a lógica de auth real — o middleware desativado na raiz era ignorado pelo build desde o início.

**Consequência**: a desativação real não veio do middleware, mas das outras duas mudanças do mesmo commit: `requireUser()` retornando bypass e `createSupabaseServerClient()` escalando para service_role. Essas mudanças operavam na camada de aplicação, independentemente do middleware.

### Por que `src/proxy.ts` sumiu na migração de monorepo

O `git show 0052892` confirma que ~400 imports foram atualizados, mas `src/proxy.ts` não aparece no diff do commit — foi omitido. A migração copiou `src/lib/`, `src/app/`, `src/components/`, mas `src/proxy.ts` (arquivo de nível raiz do antigo monolito) não estava num padrão glob `src/**/*`. Ficou de fora.

O arquivo `packages/db/src/supabase/proxy.ts` (a função `updateSession()`) **sobreviveu** — está presente no repo hoje. O entry point do Next.js (`apps/kph-os/src/proxy.ts`) é o que está faltando.

---

## 2. Qual era o erro de sessão que motivou o bypass

### O que os commits revelam

Não há issue tracker ou mensagem explícita documentando o bug. O que os diffs mostram:

1. O fix do `await cookies()` em `4bb77af` (Apr 29) sugere que `getCurrentUser()` retornava `null` mesmo com sessão ativa, porque `cookies()` não estava sendo aguardado corretamente antes de ser passado para `createSupabaseServerClient()`.

2. Mesmo após o fix, o dev abriu `/api/auth-debug` no mesmo commit (`ac63f35`) — a rota foi adicionada ao `PUBLIC_PREFIXES` exatamente para poder ser usada sem estar logado, para diagnosticar o problema de sessão.

3. No dia seguinte (`0976701`), o auth foi desativado com a mensagem "remove redirect para /login" — o app continuava redirecionando para `/login` mesmo após o fix.

### Hipótese técnica (baseada no código)

O ciclo de falha era:

```
usuário acessa /dashboard
    ↓
src/proxy.ts chama updateSession(request)
    ↓
updateSession() chama supabase.auth.getUser() — valida JWT contra servidor Auth
    ↓
getUser() retorna null  ← ponto de falha
    ↓
proxy.ts redireciona para /login?next=/dashboard
    ↓
usuário loga, obtém cookie sb-iqgrvptrtphvbmvrqntm-auth-token
    ↓
retorna para /dashboard
    ↓
proxy.ts chama updateSession() novamente com os novos cookies
    ↓
getUser() retorna null novamente  ← ciclo infinito
```

**Por que `getUser()` retornava null mesmo com cookie válido?**

A causa mais provável é uma incompatibilidade entre Next 16 e `@supabase/ssr` no padrão de renovação de cookies. Em Next 16 (app router com React 19), a função `setAll()` do cookie handler é chamada pelo supabase-ssr durante `getUser()` para atualizar o token de acesso expirado. Se `setAll()` lançava uma exceção (o código a envolve em `try/catch` silencioso), o token renovado não era escrito de volta na resposta, e na próxima request o access token estava expirado novamente.

Confirmação no código atual em `packages/db/src/supabase/server.ts:56-63`:
```ts
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

O comentário "proxy.ts cuida do refresh" implica que o desenvolvedor sabia que o refresh de token dependia do proxy — mas o proxy foi perdido na migração.

### Conclusão sobre o bug original

O auth nunca falhou por um problema no Supabase ou na lógica de sessão em si. A sequência foi:
1. Bug real: possível incompatibilidade de cookie refresh em Next 16 + `@supabase/ssr` (a investigar na reativação)
2. Workaround: bypass em `requireUser()` + `createSupabaseServerClient()`
3. Efeito colateral: `src/proxy.ts` com lógica de auth real ficou no repo, mas irrelevante
4. Migração para monorepo: `src/proxy.ts` perdido, bypass perpetuado

---

## 3. Como o sistema funcionou em produção sem middleware

### Caminho completo de uma request (pré-lockdown)

```
Browser → kph-os.vercel.app/dashboard
    ↓
[Vercel Edge] — nenhum middleware/proxy ativo (arquivo estava em lugar errado)
    ↓
[Next.js] Router — renderiza (dashboard)/page.tsx
    ↓
page.tsx: import requireUser() de @kph/auth/server
    ↓
requireUser():
  1. chama getCurrentUser()
  2. getCurrentUser() chama createSupabaseServerClient(cookieStore)
  3. createSupabaseServerClient(): verifica se existe cookie "auth-token"
     ↓ SEM cookie de sessão (usuário anônimo):
     ├── retorna createServiceClient() ← SUPABASE_SERVICE_ROLE_KEY
     └── getCurrentUser() recebe cliente service_role
         ↓
         supabase.auth.getSession() retorna null (sem sessão)
         getCurrentUser() retorna null
         ↓
  requireUser() recebe null → retorna bypass user:
  { id: "00000000-0000-0000-0000-000000000001", role: "founder" }
    ↓
[página renderizada como "founder"] com client service_role nas queries
    ↓
RLS completamente ignorado (service_role bypassa)
    ↓
Todos os dados de todas as marcas retornados
```

### Três camadas de bypass simultâneas

| Camada | Arquivo | Efeito |
|---|---|---|
| Middleware | `apps/kph-os/src/middleware.ts` | Passava tudo (`NextResponse.next()`) — o bloqueio foi nosso primeiro commit de segurança |
| Auth DAL | `packages/auth/src/server.ts:99-108` | `requireUser()` retorna founder fake quando sem sessão |
| DB Client | `packages/db/src/supabase/server.ts:23-25` | `createSupabaseServerClient()` usa service_role sem sessão, anulando RLS |

As três camadas precisam ser revertidas na reativação. O middleware (camada 1) foi substituído pelo lockdown atual.

---

## 4. O que `/api/auth-debug` expunha e se há indício de acesso

### Conteúdo exposto pela rota

```ts
// apps/kph-os/src/app/api/auth-debug/route.ts (GET, sem auth)
{
  envCheck: {
    hasUrl: true,
    urlPreview: "https://iqgrvptrtphvbmvrqntm.supabase.c",  // 40 chars da URL pública
    hasAnonKey: true,
    anonKeyPreview: "eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...",  // 30 chars da anon key
  },
  supabaseCookies: [
    // Para cada cookie com nome contendo "supabase" ou começando com "sb-":
    { name: "sb-iqgrvptrtphvbmvrqntm-auth-token", len: 2847, preview: "<60 chars do JWT>" }
  ],
  allCookieNames: ["sb-...", ...],  // todos os nomes de cookie da request
  user: { status: "null" }  // sem sessão → null
}
```

### Avaliação de risco

**URL e anon key (primeiros 30-40 chars):** Baixo risco — ambas são variáveis `NEXT_PUBLIC_*`, expostas no bundle do cliente de qualquer forma. Um atacante que inspecione o JavaScript já as tem completas.

**Preview de 60 chars de cookies `sb-*`:** Risco moderado em teoria. Na prática: com auth desativado desde 30/04, nenhum usuário real gerou um cookie de sessão válido após essa data. Qualquer cookie de período anterior já estaria expirado (tokens Supabase expiram em 1 hora; refresh tokens em 60 dias — o bypass foi habilitado há 46 dias da data desta auditoria, portanto mesmo cookies antigos já teriam expirado). Os 60 chars de um JWT base64 não são suficientes para reconstituir ou reutilizar o token.

**Status de sessão (`user.status`):** Expunha se havia um usuário logado na request. Com auth desativado, a resposta seria sempre `{ status: "null" }`.

### Indício de acesso externo

**Não é possível confirmar ou refutar** a partir do código-fonte. Esta análise dependeria dos Vercel Request Logs (disponíveis no dashboard) ou dos Supabase Edge Function Logs. O que podemos afirmar:

- A rota existiu publicamente de **2026-04-29 a 2026-06-12** (44 dias)
- Não estava referenciada em nenhuma documentação pública ou sitemap
- O padrão de URL (`/api/auth-debug`) não é óbvio, mas é adivinável
- O conteúdo retornado era de baixo valor real (sem tokens válidos, sem dados de usuário)

**Ação recomendada antes da reativação do auth:** deletar ou gate a rota por variável de ambiente (`ADMIN_DEBUG_ENABLED=true`). Está no escopo do Sprint 1, pós-OK #2.

---

## 5. Estado atual e pré-requisitos para reativação (pós OK #2)

### O que está feito (commits 78f12ff, bc69d38, pós-OK #1)

- [x] Lockdown 401 no ar em kph-os.vercel.app (src/middleware.ts)
- [x] ESLint e TypeScript gates religados (eslint.config.mjs + next.config.ts sem bypasses)
- [x] Migration 080_security_hardening.sql gerada (aguardando aplicação manual)

### O que precisa acontecer antes da reativação (Sprint 1, pós-OK #2)

1. **Criar `apps/kph-os/src/proxy.ts`** com a função `proxy()` usando `updateSession()` de `@kph/db/supabase/proxy` — esse é o arquivo que Next 16 procura. O arquivo não existe no monorepo atual.

2. **Reverter `requireUser()`** de bypass para `redirect("/login")` quando sem sessão.

3. **Reverter `createSupabaseServerClient()`** — remover o fallback para service_role sem sessão.

4. **Revogar conta `bypass@kph.os`** via migration aditiva (desativar, não deletar — para não quebrar FK em registros históricos).

5. **Remover UUIDs de bypass hardcoded** em `src/lib/pessoas/ponto-actions.ts:65-66` e `src/lib/pessoas/actions.ts:1268-1269`.

6. **Deletar `/api/auth-debug`** ou gate por env var.

7. **Adicionar auth em `/api/intelligence/insight`** — POST público consome Anthropic API.

8. **Verificar a hipótese do bug de cookie refresh** antes de colocar em produção: testar localmente com `NEXT_PUBLIC_SUPABASE_*` reais, confirmar que o ciclo login→getUser→null foi resolvido.

9. **Aplicar migration `080_security_hardening.sql`** via `supabase db query --linked`.

10. **Trocar a credencial compartilhada** (mencionada nos bloqueios conhecidos) após o login estar funcional.

### O que a reativação NÃO precisa

- Nenhuma mudança de schema de banco
- Nenhuma alteração de RLS nas tabelas de negócio (já correto)
- Nenhuma mudança nas zonas externas (cada zona tem seu próprio auth — escopo separado)

---

*Documento mantido na raiz do repo. Atualizar conforme progresso do Sprint 1.*
