# Migração HOS App → Maza

> Reescrita do backend do app mobile pra apontar pro Supabase do **Maza**
> (`iqgrvptrtphvbmvrqntm`) ao invés do Supabase legado HOS (`afxsrcezmetipzgosdvb`).
>
> O app original ficou intocado em `ref_system/hos-app-main/`. Este diretório
> (`hos-app-migrado/`) é uma cópia com TODAS as adaptações já aplicadas. Pra
> rodar no dispositivo, basta instalar deps e startar o Expo.

---

## Pré-requisitos

### 1. Migrations + buckets (já feito)

As migrations 011-018 do Maza criaram as tabelas RH (`employee_auth`,
`documents`, `tips_records`, `transport_vouchers`, `time_records`,
`vacations`, `overtime_records`, `import_logs`, `campaigns`, `job_openings`,
`candidates`, `interview_questions`, `interview_responses`) e os 4 storage
buckets (`avatars`, `documents`, `campaign-images`, `interview-videos`).
As policies de storage também já estão aplicadas.

### 2. ⚠ Seed manual de `employee_auth`

O ETL HOS → Maza migrou os 78 funcionários e dados financeiros (holerites,
banco de horas, gorjetas, VT) — **mas não migrou as senhas**. A tabela
`employee_auth` foi criada vazia no Maza.

Antes do app funcionar pra qualquer colaborador, rodar um destes 2 caminhos:

**Opção A — todos usam "Primeiro Acesso" no app:** os colaboradores abrem
o app, vão em "Primeiro Acesso", digitam CPF + nova senha. Funciona porque
`primeiroAcesso()` busca `employees.cpf` e cria o `employee_auth` com o
`employee_id` correto. Não precisa de SQL nenhum.

**Opção B — seed em batch (admins):** rodar este SQL no SQL Editor do
Supabase pra criar `employee_auth` pra todos com senha padrão `123456`:

```sql
-- ⚠ Senha plaintext "123456" pra todos. Forçar troca no primeiro login
--    seria bom — TODO no auth.ts.
INSERT INTO employee_auth (cpf, password_hash, employee_id, is_active)
SELECT cpf, '123456', id, true
FROM employees
WHERE cpf IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM employee_auth ea WHERE ea.cpf = employees.cpf)
ON CONFLICT (cpf) DO NOTHING;
```

Recomendo **Opção A**: cada colaborador escolhe a própria senha.

---

## O que mudou em cada arquivo

### `src/lib/supabase.ts`
- URL: `iqgrvptrtphvbmvrqntm.supabase.co` (era `afxsrcezmetipzgosdvb`).
- Service role key trocada pela do Maza.
- Mantido `autoRefreshToken/persistSession/detectSessionInUrl: false` —
  o app continua autenticando manualmente via `employee_auth`.

### `src/lib/types.ts`
- `Employee.full_name` → `nome` + `sobrenome` separados.
- `Employee.cargo` → `funcao`.
- `Employee.empresa` agora vem de JOIN `units → brands.name` (no `auth.ts`),
  não é mais coluna direta em `employees`.
- Novos campos opcionais: `telefone`, `photo_url`, `score`.
- Novo helper `getDisplayName(emp)` retorna `${nome} ${sobrenome}.trim()` —
  usar onde antes se usava `full_name`.
- `Candidate.status` (decisão RH: `pendente|aprovado|reprovado`) ≠
  `Candidate.interview_status` (ciclo do app: `pendente|em_andamento|concluido`).
  O app só toca em `interview_status`.
- `InterviewQuestion.video_path` → `video_url`, `ordem` → `order_num`,
  `question_text` adicionado.

### `src/lib/auth.ts`
- `login`: query employees agora usa `nome, sobrenome, funcao, departamento`
  (era `full_name, role, department`) + JOIN com `units(brand_id, brands(name))`
  pra resolver `empresa`.
- `login`: atualiza `employee_auth.last_login` (best-effort).
- `login`: respeita `employee_auth.is_active = false` (bloqueia acesso).
- `primeiroAcesso`: insere com `employee_id` (FK NOT NULL no Maza — antes
  o schema HOS permitia `employee_id` null).

### `src/screens/HomeScreen.tsx`
- Query `payslips`: `competencia, liquido` (era `periodo, valor_liquido`),
  ordenada por `competencia DESC`. Usa `.maybeSingle()` (não `.single()`).
- Query `time_records`: igual, mas usa `.maybeSingle()`.
- Query `absences`: campo `data` (era `date`).
- Query do pódio: `id, nome, sobrenome, photo_url, score`. UI usa
  `getDisplayName(emp)` e `emp.nome` no display.
- Card "Olá": exibe `employee?.funcao` (era `cargo`).
- `formatCurrency` aceita string|number (NUMERIC vem como string do PostgREST).

### `src/screens/FinanceiroScreen.tsx`
- Tipo `Payslip` reescrito pra refletir Maza.
- `total_vencimentos` e `total_descontos` calculados client-side somando
  os componentes (Maza não tem esses campos consolidados; foram removidos).
- `inss_base`/`irrf_base` removidos da UI; `fgts_base` e `faixa_irrf` exibidos.
- Query ordena por `competencia` (era `periodo`).
- `handleVerPDF` aceita URL completa (preferencial: pdf_url do server) OU
  fallback pra signed URL no bucket `documents` (não mais `holerites`/`payslips`).
- Render de `tips_records`: `valor_ponto * pontos_liquidos`.
- Render de `transport_vouchers`: `valor_empresa` + `dias_uteis × valor_diario`.
- Helper `num()` converte string|number|null → number 0.

### `src/screens/DocumentosScreen.tsx`
- Estado novo `unitId` carregado via `SELECT employees.unit_id WHERE id = empId`.
- Insert agora envia `unit_id` (FK NOT NULL no Maza).
- `getDocumentType()` removido — substituído por **modal de seleção** com
  os 6 valores válidos (RG/CPF/CTPS/contrato/exame/outro). UX: pickar arquivo
  → escolher tipo → upload.
- `getIcon` agora recebe `DocType` enum (não strings livres).

### `src/screens/RegistroScreen.tsx`
- Tipo `Absence`: `data/tipo/motivo` (era `date/type/reason`).
- Tipo `Warning`: `data/nivel/descricao` (era `date/level/description`).
- Query absences/warnings ordena por `data`.
- Render absence/warning ajustado pros novos nomes de campo.
- Paleta de cores em `Warning`: agora cobre tanto os valores antigos
  (leve/moderada/grave) quanto os do Maza (verbal/escrita/suspensao).
- `formatCurrency` aceita string|number; `Number(item.valor_ponto)` no
  cálculo do total de gorjeta.

### `src/screens/FeriasScreen.tsx`
- Query mantém `time_records WHERE ferias_dias > 0`.
- Adicionado: também busca `vacations` (módulo Férias do painel Maza) e
  mescla — mostra os dois tipos de registro (importação Totvs + agendamentos
  no painel).

### `src/screens/CampanhasScreen.tsx`
- Lógica de filtro reescrita pro multi-tenant Maza:
  1. Resolve o `brand_id` do user via JOIN `employees → units → brand_id`.
  2. Filtra `campaigns` com `brand_id IS NULL OR brand_id = <user_brand>`.
  3. Filtra janela de datas com `starts_at IS NULL OR ≤ hoje` e
     `ends_at IS NULL OR ≥ hoje`.
  4. Filtra departamento client-side (`target='all'` OR `target='department'
     AND target_value = employee.departamento`).
  5. `target='company'` antigo desaparece — multi-tenancy via `brand_id`.
- `image_url` agora é resolvido via `supabase.storage.from('campaign-images').getPublicUrl()`
  quando vier como path (bucket é public read).

### `src/screens/CandidateLoginScreen.tsx`
- Bloqueio de entrevista já realizada usa `interview_status === 'concluido'`
  (era `status === 'concluido'`). `status` agora é decisão RH; o app não toca.

### `src/screens/InterviewScreen.tsx`
- `update candidates set interview_status='em_andamento'` (era `status`).
- `interview_questions.order('order_num')` (era `ordem`).
- `loadQuestionVideo` usa `question.video_url` (era `video_path`); se for
  `null`, mostra o `question_text` em texto grande no lugar do player.

### `src/screens/InterviewCompleteScreen.tsx`
- `update candidates set interview_status='concluido'` (era `status`).

### `App.tsx`
- Sem mudança. Importa só `COLORS` e screens — todos os screens já estão adaptados.

### `src/screens/LoginScreen.tsx` e `PrimeiroAcessoScreen.tsx`
- Sem mudança no código. UI pura — chama `auth.ts` adaptado.

### `src/screens/PdfViewerScreen.tsx`
- Sem mudança (era stub `return null` no original e continua).

---

## Testar antes de publicar

Plano mínimo de teste em ordem:

1. **Login + Primeiro Acesso** com um colaborador real (CPF do banco Maza).
2. **Home**: pódio top 3, último holerite com `competencia/liquido` corretos,
   banco de horas, faltas do mês.
3. **Financeiro**: holerites com Total Vencimentos e Total Descontos batendo
   com a soma dos componentes; tap em "Ver PDF" abre.
4. **Documentos**: upload de PDF + escolha de tipo, lista mostra com label
   correto, viewer abre.
5. **Registro**: aparecem todas as 6 seções (Time records, HE, Ausências,
   Gorjetas, VT, Advertências). Badges Aprovado/Pendente em HE, paleta de
   nivel em Warning.
6. **Férias**: aparecem registros do `time_records` E do `vacations` se
   tiver agendamento.
7. **Campanhas**: só aparecem as da brand do user (ou globais), dentro da
   janela de datas, e respeitando departamento.
8. **Candidato**: login com `CAND-XXXX` → entrevista grava e envia →
   tela de conclusão. Confirmar que `candidates.interview_status='concluido'`
   ficou setado, mas `candidates.status` continua `'pendente'` (decisão RH).

---

## Como copiar para o dispositivo / rodar

```bash
# 1. Da pasta hos-app-migrado:
cd ~/Documents/hos-app-migrado    # ou onde quiser
cp -r ~/Desktop/_ORKESTRI/maza/ref_system/hos-app-migrado/* .

# 2. Instalar deps:
npm install

# 3. Rodar:
npx expo start

# 4. Scan QR code com Expo Go (Android) ou app Camera (iOS)
```

Não precisa de prebuild/EAS — funciona direto no Expo Go SDK 54.

---

## Schema reference rápido (Maza)

| Tabela | Campos críticos pro app |
|---|---|
| `employees` | `id, nome, sobrenome, cpf, funcao, departamento, email, telefone, photo_url, score, status_rh, unit_id` |
| `employee_auth` | `id, employee_id (NOT NULL), cpf UNIQUE, password_hash, is_active, last_login` |
| `payslips` | `competencia DATE, salario_base, horas_extras, adicional_noturno, gorjeta, dsr_gorjeta, desconto_inss, desconto_irrf, desconto_vale_transporte, desconto_vale_refeicao, outros_descontos, outros_acrescimos, liquido, fgts_base, fgts_mes, faixa_irrf, employee_code, status, pdf_url` |
| `tips_records` | `periodo DATE, valor_ponto, total_pontos, abatimento_pontos, pontos_liquidos (GENERATED)` |
| `transport_vouchers` | `periodo, dias_uteis, valor_diario, total_bruto, desconto_funcionario, valor_empresa, operadora` |
| `time_records` | `periodo, horas_previstas, horas_trabalhadas, saldo_banco, banco_horas_acumulado, ferias_dias, afastamentos_dias, adicional_noturno, fonte` |
| `overtime_records` | `date, hours, type ('50'\|'100'\|'banco'), reason, approved, source ('manual'\|'totvs'), periodo` |
| `absences` | `data, tipo, motivo, score_impact, atestado_path` |
| `warnings` | `data, nivel ('verbal'\|'escrita'\|'suspensao'), descricao, score_impact, documento_path` |
| `documents` | `unit_id NOT NULL, name, type ('RG'\|'CPF'\|'CTPS'\|'contrato'\|'exame'\|'outro'), storage_path, notes, uploaded_at` |
| `vacations` | `start_date, end_date, days_entitled, days_taken, abono_days, is_double_pay, status` |
| `campaigns` | `brand_id, unit_id, title, description, image_url (storage path), category, target, target_value, active, starts_at, ends_at` |
| `candidates` | `full_name, email, phone, access_code UNIQUE, status (RH), interview_status (app), job_opening_id` |
| `interview_questions` | `job_opening_id, order_num, question_text, video_url (path)` |
| `interview_responses` | `candidate_id, question_id, video_url` |
