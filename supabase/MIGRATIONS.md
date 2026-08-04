# Migrations — Notas de Histórico

Banco: Supabase `iqgrvptrtphvbmvrqntm` (compartilhado por todo o monorepo).
Aplicação: manual via `supabase db query --linked --file <arquivo>` — **nunca** `db push`.
Os arquivos nesta pasta são o registro do que já foi aplicado, não uma fila pendente.

## Duplicatas de numeração (pré-fusão, já aplicadas — NÃO renomear)

Antes da fusão Orkestri, o repo maza acumulou números duplicados. Todos os
arquivos abaixo **já foram aplicados ao banco**; renomeá-los agora só quebraria
a rastreabilidade com o histórico do git. Ficam como estão:

| Número | Arquivo A | Arquivo B |
|---|---|---|
| 008 | `008_events.sql` | `008_self_select_ponto.sql` |
| 035 | `035_gorjetas.sql` | `035_hos_insights.sql` |
| 065 | `065_lorean.sql` | `065_job_descriptions.sql` |
| 066 | `066_lorean_venda.sql` | `066_gorjeta_distribuicao.sql` |
| 072 | `072_deploy_prod_auto_approve.sql` | `072_score_policy_kernel.sql` |

Ambos os arquivos de cada par foram aplicados. A ordem real de aplicação está
no histórico do git (data do commit de cada arquivo).

## 074–079: importadas do repo maza-inteligencia (fusão Orkestri, jun/2026)

O repo `maza-inteligencia` mantinha migrations próprias numeradas 065–070,
**colidindo** com as do maza. Na fusão foram renumeradas para 074–079 —
o conteúdo é idêntico ao original e **todas já estavam aplicadas ao banco**:

| Novo nome | Nome original (repo inteligencia) |
|---|---|
| `074_maza_alerts.sql` | `065_maza_alerts.sql` |
| `075_maza_intelligence_score.sql` | `066_maza_intelligence_score.sql` |
| `076_maza_insights.sql` | `067_maza_insights.sql` |
| `077_agent_runs.sql` | `068_agent_runs.sql` |
| `078_learning_machine_reports.sql` | `069_learning_machine_reports.sql` |
| `079_seed_agent_runs.sql` | `070_seed_agent_runs.sql` |

## Regra daqui pra frente

Próxima migration: **080**. Numeração única e sequencial nesta pasta —
nenhum app do monorepo mantém pasta de migrations própria.
