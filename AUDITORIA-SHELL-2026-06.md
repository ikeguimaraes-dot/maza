# AUDITORIA SHELL · KPH-OS — Junho/2026

> Fase 1+2 do superprompt de auditoria. Somente leitura — nenhuma alteração de código foi feita.
> Escopo: repositório `kph-os` (monorepo: `apps/kph-os` + `packages/{auth,db,ui}` + `supabase/migrations`).
> Auditoria executada em 2026-06-11.

---

## 0. Correções de contexto (o que o superprompt assumia vs realidade)

| Assumido | Realidade |
|---|---|
| `src/app` na raiz | Monorepo — app em `apps/kph-os/src/app`, pacotes compartilhados em `packages/` |
| CLAUDE.md com módulos documentados | **Não existe CLAUDE.md.** Só `AGENTS.md` genérico (aviso de versão do Next) e `apps/kph-os/README.md` = template padrão do Next, zero conteúdo do projeto |
| ~53 rotas no shell | Shell tem **28 páginas locais** + **7 zonas externas** (multi-zone via rewrites em `apps/kph-os/next.config.ts:1-9`): financeiro, pessoas, operacao, compras, comercial (ruptura), marca, inteligencia. O nav (`src/lib/nav-config.ts`, 82 hrefs) aponta 11 rotas locais e ~71 servidas pelas zonas |
| Link Trato 404 | **"Trato" não existe neste repo** (grep completo). Se o 404 é real, está numa zona externa — fora deste codebase |
| Cores de marca placeholder | Não encontrado placeholder no shell — design tokens KPH completos em `globals.css` (Carvão/Creme/Brasa/Pedra/Ouro). Se há placeholder, é em zona externa |
| Possível bypass de sessão | **Confirmado, e é pior que "possível"** — ver Segurança abaixo |

Rotas locais reais: marcas, eventos (CRUD), dashboard, financeiro (cockpit + relatórios), cardapio (CRUD), cliente (CRUD), campanhas, recrutamento (vagas/candidatos), orquestrador (+insights), pessoas/headcount, pessoas/agentes, inteligencia/metas, ponto, login. **Nenhuma página é stub** — todas têm implementação real.

⚠️ Atenção: páginas locais **sombreiam zonas** (rewrites são `afterFiles`): `/financeiro`, `/pessoas/headcount`, `/inteligencia/metas` existem local E têm zona com mesmo prefixo. Hoje o local vence — decisão que precisa ser explícita, não acidental.

---

## 1. SCORECARD

| Área | Nota | Justificativa (1 linha) |
|---|---|---|
| **Shell / Nav** | **7/10** | Sidebar com active state excelente, drawer mobile, seletor de unidade e notificações reais — mas zero `loading.tsx`, cmd+K é botão morto e não há skip link |
| **UI / UX** | **7/10** | Design system coeso (tokens CSS, Fraunces+Instrument, empty states contextuais) — contraste de `--text-3` no limite do AA, botões inline vs `@kph/ui` inconsistentes, tabelas sem UX mobile |
| **Segurança** | **2/10** | Auth completamente desativado em produção: middleware passa tudo, `requireUser()` devolve founder fake, sem sessão escala para service role (RLS anulado) |
| **Arquitetura** | **7/10** | Monorepo limpo, server actions consistentes (sem REST CRUD inflado), multi-zone bem resolvido (ZoneLink + rewrites) — mas build ignora erros de TS/ESLint e zero observabilidade |
| **Dívida Técnica** | **6/10** | 155 `any` (concentrados no orquestrador), 3 pares de migrations com número duplicado, 4.8MB de logs commitados, 4 testes smoke apenas, README/CLAUDE.md inexistentes |

---

## 2. TOP 10 PROBLEMAS (impacto × esforço)

### P0 — Segurança crítica

1. **Middleware com auth desativado** — `apps/kph-os/middleware.ts:5-8`
   Comentário literal: `// AUTH DESATIVADO — acesso livre sem login`. Todo o painel (DRE, folha, holerites, gorjetas, CRM) está público em kph-os.vercel.app. *Esforço: médio (depende de resolver o bug de auth original).*

2. **`requireUser()` devolve founder fake** — `packages/auth/src/server.ts:99-108`
   Sem sessão → retorna UUID `00000000-...-0001` com role `founder`. `requireRole()` (linha 111) herda o bypass: qualquer visitante anônimo "é" founder. *Esforço: baixo (fail-closed), mas só após login funcionar.*

3. **Fallback para service role sem sessão** — `packages/db/src/supabase/server.ts:23-25`
   `// AUTH DESATIVADO: sem sessão → service role para bypassar RLS`. Anula RLS inteiro para requests anônimas. Viola o princípio nº 4 do projeto. *Esforço: baixo.*

4. **Usuários de bypass seedados e hardcoded** — `supabase/migrations/039_seed_bypass_user.sql:24`, `apps/kph-os/src/lib/pessoas/ponto-actions.ts:65-66`, `apps/kph-os/src/lib/pessoas/actions.ts:1268-1269`
   Registros de ponto/RH sendo atribuídos a contas de teste ("Mariana Costa"). Dados reais já podem estar contaminados. *Esforço: baixo (código) + auditoria de dados.*

### P1 — Segurança alta

5. **`/api/auth-debug` público expõe cookies de sessão** — `apps/kph-os/src/app/api/auth-debug/route.ts`
   Retorna preview (60 chars) de cada cookie `sb-*`, URL do Supabase e prefixo da anon key, sem nenhum gate. O próprio comentário diz "Remover após resolver o bug de auth". *Esforço: trivial (deletar ou gate por env).*

6. **`/api/intelligence/insight` sem auth consumindo Anthropic** — `apps/kph-os/src/app/api/intelligence/insight/route.ts:24`
   POST público que chama Claude com `ANTHROPIC_API_KEY` — abuso de créditos/DoS financeiro. *Esforço: trivial.*

7. **Webhook do orquestrador sem verificação de assinatura** — `apps/kph-os/src/app/api/orchestrator/webhook/route.ts:11`
   Qualquer um pode forjar `deployment.succeeded` e disparar auto-approve de jobs. O webhook do GitHub (`github-webhook/route.ts:12-23`) já faz HMAC — copiar o padrão. Bônus: `escalate/route.ts:37-41` passa se `CRON_SECRET` estiver vazio (`'' === ''`) — fail-closed. *Esforço: baixo.*

8. **RLS `USING (true)` em tabelas sensíveis** — `043_employee_auth.sql:24` (hashes de senha mobile!), `045_theo_tickets.sql:25`, `047_candidates.sql:30`, `048_candidatos_maya.sql:29`, `073_kph_learning_proposals.sql:37,47`; view `tips_records` sem `security_invoker` em `044_mobile_views.sql`
   Corrigir via **migration aditiva nova** (DROP POLICY IF EXISTS + CREATE com `kph_has_role_for_brand`/`kph_can_write_*`), nunca ALTER. *Esforço: médio.*

### P1 — Qualidade estrutural

9. **Build ignora erros de TypeScript e ESLint** — `apps/kph-os/next.config.ts:13-14`
   `typescript: { ignoreBuildErrors: true }, eslint: { ignoreDuringBuilds: true }` — o gate "tsc + eslint exit 0" dos módulos E1-E4 não está sendo aplicado no deploy. *Esforço: baixo (hoje `tsc --noEmit` passa limpo, então é só religar).*

10. **Zero `loading.tsx` em 28 rotas + cmd+K morto + error do orquestrador cru** — `src/app/(dashboard)/**` (nenhum loading.tsx), `components/shell/TopBar.tsx:101-133` (botão ⌘K sem modal), `orquestrador/error.tsx:3-14` (despeja `error.stack` em `<pre>` na tela)
    Impacto direto na percepção de qualidade, especialmente no iPhone com rede ruim. *Esforço: baixo, alto retorno visual.*

**Menções honrosas (não entraram no top 10):** migrations com número duplicado (008/035/072 — não renumerar as já aplicadas; adotar convenção daqui pra frente); `audit_result.txt` + `lint_output.log` = 4.8MB commitados sem `.gitignore`; 155 `any` (20 só em `lib/orquestrador/actions.ts`); crons checam `CRON_SECRET` só em `NODE_ENV === 'production'`; 4 testes smoke como única cobertura.

---

## 3. PROPOSTA UI/UX DO SHELL

### a) Quick wins (< 2h cada)

| Item | Detalhe | Onde |
|---|---|---|
| Skeletons | `loading.tsx` para eventos, cliente, cardapio, financeiro, dashboard usando tokens existentes (`--surface-2` + pulse) | `src/app/(dashboard)/*/loading.tsx` |
| Command palette ⌘K | Botão já existe no TopBar — ligar a um modal `cmdk` alimentado pelo `NAV_CONFIG` (82 destinos prontos) | `TopBar.tsx:101` + novo `CommandPalette.tsx` |
| Error do orquestrador | Reusar o padrão polido de `(dashboard)/error.tsx` (que é bom) | `orquestrador/error.tsx` |
| Skip link | `<a href="#main" class="sr-only">` antes do nav | `(dashboard)/layout.tsx` |
| Contraste `--text-3` | `#8A8278` sobre `#1A1A18` ≈ 4.2:1 — clarear um passo (ex.: `#9A9288`) mantém Pedra e ganha folga AA | `globals.css` |
| Badge de marca ativa | O seletor de unidade já existe na Sidebar — ecoar a unidade ativa como chip no TopBar (contexto sempre visível no mobile, onde a sidebar fica fechada) | `TopBar.tsx` |
| not-found.tsx global | Não existe — 404 padrão do Next quebra a imersão | `src/app/not-found.tsx` |
| Active state em children | Já excelente em itens raiz; conferir consistência nos subitens do DRE | `Sidebar.tsx:536-554` |

Já existem e estão bons (não refazer): dark mode (é dark-only por design), empty states (`EmptyState.tsx` com copy contextual), drawer mobile com backdrop, notificações com polling 30s, transições (`--t: 180ms` + reduced-motion).

### b) Estruturais

1. **Tabelas mobile** — `overflow-x-auto` funciona mas é UX pobre no iPhone; criar variante card-list para `<768px` no `packages/ui/src/ui/table.tsx` (você opera muito via iPhone — é o item estrutural de maior retorno pessoal).
2. **Padronização de botões** — eliminar botões com `style={{}}` inline (ex.: `EmptyState.tsx:78-103`, `eventos/page.tsx:87-92`) em favor de `@kph/ui/button`; tokenizar os hex soltos (`#22C55E` em `Sidebar.tsx:278`, `#0a0a0a`, `#EF4444` → `--color-success/--color-danger`).
3. **Seletor global de marca/unidade** — promover o seletor da Sidebar a contexto global (cookie/URL param) respeitado pelas zonas externas — hoje cada zona pode divergir de contexto.
4. **Notificações cross-zone** — o bell só vê o schema local; definir contrato (tabela `kph_alerts` já tem TODO em `lib/discord/alert-notifier.ts:3`) para zonas publicarem alertas no mesmo feed.
5. **KPI cards unificados** — `MetricCard.tsx` (premium, Fraunces+Ouro) vs cards inline de eventos/financeiro — adotar MetricCard como padrão.

---

## 4. PRÓXIMOS 3 SPRINTS

### Sprint 1 — Segurança (fechar a porta)
**Objetivo: kph-os.vercel.app exige login real e RLS volta a valer.**
1. Diagnosticar o bug de auth original que motivou o bypass (o `auth-debug` existe para isso — usar e depois deletar).
2. Reativar verificação de sessão no `middleware.ts` com matcher cobrindo `(dashboard)` + APIs sensíveis.
3. `requireUser()` fail-closed (redirect /login); remover fallback service-role do `createSupabaseServerClient()`; remover UUIDs de bypass de `ponto-actions.ts`/`actions.ts`.
4. Migration aditiva `074_security_hardening.sql`: DROP POLICY IF EXISTS + policies reais para employee_auth, candidates, candidatos_maya, theo_tickets, kph_learning_proposals; `CREATE OR REPLACE VIEW tips_records ... WITH (security_invoker = true)`; desativar conta `bypass@kph.os` (aditivo: revogar, não deletar).
5. Gate/delete `/api/auth-debug`; auth em `/api/intelligence/insight`; HMAC no `/api/orchestrator/webhook`; fail-closed quando `CRON_SECRET` ausente.
6. Religar `typescript`/`eslint` no build (`next.config.ts`).
7. Auditar dados gravados com user de bypass (ponto, RH) — relatório, sem alterar dados.
⚠️ Dependência: credenciais reais dos usuários (a "credencial compartilhada" citada) — trocar senhas após reativar auth.

### Sprint 2 — Polimento do shell
**Objetivo: shell impecável no iPhone.**
- Todos os quick wins da seção 3a (skeletons, ⌘K, error orquestrador, skip link, contraste, badge de marca, not-found).
- Estruturais 1 e 2 (tabelas mobile + padronização de botões/tokens).
- Higiene: `.gitignore` para `*.log`/`audit*`, remover os 4.8MB commitados, README real, criar **CLAUDE.md** documentando monorepo + zonas + princípios (o superprompt assumiu que existia — está custando contexto a cada sessão).

### Sprint 3 — Próximo módulo do roadmap
**Objetivo: avançar Inteligência (sugestão) — é o módulo com maior base já pronta no shell.**
- `/inteligencia/metas` já existe local; orquestrador + insights + scores (migrations 070-073) já dão a fundação.
- Escopo sugerido: WBR (`/inteligencia/wbr`), Adoção e Cross-módulo consumindo as views existentes; tipagem do orquestrador (matar os 51 `any` de `lib/orquestrador/`) como pré-requisito.
- Alternativa: se a prioridade comercial for outra (Cliente/Cardápio já têm CRUD local — "remanescente" pode significar evolução, não criação), decidir antes de fechar escopo. **Decisão de negócio: sua.**

---

## 5. VEREDITO

O shell é **bom** — design system real, navegação multi-zone bem resolvida, padrões consistentes, zero stubs. Mas está rodando **sem autenticação em produção com dados de folha, ponto e financeiro**. Nada do Sprint 2/3 importa antes do Sprint 1.

*Fim da Fase 2. Aguardando GO para execução.*
