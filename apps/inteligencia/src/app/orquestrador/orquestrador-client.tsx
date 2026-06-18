"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Clock,
  Database,
  GitPullRequest,
  MessageSquare,
  RefreshCw,
  Rocket,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { HosJob, JobStatus, JobType } from "@/lib/inteligencia/orquestrador";
import type { LMReport } from "@kph/core/learning-machine";
import { scoreColorClass } from "@kph/core";
import { SEV_FG, COLORS } from "@/lib/tokens";

// ── Job type config ────────────────────────────────────────────────

type JobTypeConfig = {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
};

const JOB_TYPE_CONFIG: Record<JobType, JobTypeConfig> = {
  deploy_prod: {
    label: "Deploy produção",
    icon: <Rocket size={14} />,
    color: COLORS.ouro,
    bg: "rgba(184,151,90,0.14)",
  },
  code_review: {
    label: "Code review",
    icon: <GitPullRequest size={14} />,
    color: "#6B5BDB",
    bg: "rgba(107,91,219,0.14)",
  },
  qa_preview: {
    label: "QA preview",
    icon: <CircleDot size={14} />,
    color: "#0369A1",
    bg: "rgba(3,105,161,0.14)",
  },
  data_sync: {
    label: "Sincronização de dados",
    icon: <Database size={14} />,
    color: "#0369A1",
    bg: "rgba(3,105,161,0.14)",
  },
  alert_generated: {
    label: "Alerta gerado",
    icon: <AlertTriangle size={14} />,
    color: SEV_FG.danger,
    bg: "rgba(196,98,45,0.14)",
  },
  feedback_received: {
    label: "Feedback recebido",
    icon: <MessageSquare size={14} />,
    color: SEV_FG.warn,
    bg: "rgba(245,158,11,0.14)",
  },
  insight_generated: {
    label: "Insight gerado",
    icon: <Sparkles size={14} />,
    color: "#7C3AED",
    bg: "rgba(124,58,237,0.14)",
  },
  learning_machine_weekly: {
    label: "Learning Machine",
    icon: <Brain size={14} />,
    color: "#7C3AED",
    bg: "rgba(124,58,237,0.14)",
  },
};

const FALLBACK_CONFIG: JobTypeConfig = {
  label: "Job",
  icon: <RefreshCw size={14} />,
  color: "var(--text-3)",
  bg: "var(--surface-2)",
};

// ── Status config ──────────────────────────────────────────────────

type StatusConfig = { label: string; icon: React.ReactNode; color: string };

const STATUS_CONFIG: Record<JobStatus, StatusConfig> = {
  pending: {
    label: "Aguardando",
    icon: <Clock size={12} />,
    color: "var(--text-3)",
  },
  running: {
    label: "Executando",
    icon: <RefreshCw size={12} />,
    color: "#0369A1",
  },
  success: {
    label: "Sucesso",
    icon: <CheckCircle2 size={12} />,
    color: SEV_FG.ok,
  },
  error: {
    label: "Erro",
    icon: <XCircle size={12} />,
    color: SEV_FG.danger,
  },
};

// ── Main component ─────────────────────────────────────────────────

export function OrquestradorClient({
  jobs,
  lmReports,
}: {
  jobs: HosJob[] | null;
  lmReports: LMReport[] | null;
}) {
  if (jobs === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ textAlign: "center", padding: "60px 32px", maxWidth: 520, margin: "0 auto" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }} aria-hidden="true">🔧</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-fraunces, serif)", margin: "0 0 10px" }}>
            Nenhum job executado.
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.65, margin: 0 }}>
            O Orquestrador está aguardando deploys ou sincronizações.
            Assim que o primeiro job for executado, o histórico aparecerá aqui.
          </p>
        </div>
        <LearningMachinePanel reports={lmReports} />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            padding: "40px 16px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            fontSize: 13,
            color: "var(--text-3)",
          }}
        >
          Nenhum job registrado ainda.
        </div>
        <LearningMachinePanel reports={lmReports} />
      </div>
    );
  }

  // Group by type for summary
  const byType = new Map<string, number>();
  for (const job of jobs) {
    byType.set(job.type, (byType.get(job.type) ?? 0) + 1);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Summary pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Array.from(byType.entries()).map(([type, count]) => {
          const cfg = JOB_TYPE_CONFIG[type as JobType] ?? FALLBACK_CONFIG;
          return (
            <div
              key={type}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 99,
                background: cfg.bg,
                color: cfg.color,
                border: `1px solid ${cfg.color}30`,
              }}
            >
              {cfg.icon}
              {cfg.label}
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                ×{count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Job list */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text)",
          }}
        >
          Execuções recentes ({jobs.length})
        </div>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Tipo", "Status", "Resultado", "Data"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "8px 14px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-3)",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    borderBottom: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Learning Machine panel */}
      <LearningMachinePanel reports={lmReports} />
    </div>
  );
}

// ── Job row ────────────────────────────────────────────────────────

function JobRow({ job }: { job: HosJob }) {
  const typeCfg = JOB_TYPE_CONFIG[job.type] ?? FALLBACK_CONFIG;
  const statusCfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
  const dt = new Date(job.created_at);
  const dtStr = `${dt.toLocaleDateString("pt-BR")} ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  const resultStr = job.result
    ? Object.entries(job.result)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(" · ")
        .slice(0, 60)
    : job.payload
    ? Object.entries(job.payload)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(" · ")
        .slice(0, 60)
    : "—";

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 8,
            background: typeCfg.bg,
            color: typeCfg.color,
          }}
        >
          {typeCfg.icon}
          {typeCfg.label}
        </div>
      </td>
      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            fontWeight: 600,
            color: statusCfg.color,
          }}
        >
          {statusCfg.icon}
          {statusCfg.label}
        </div>
      </td>
      <td
        style={{
          padding: "10px 14px",
          fontSize: 11,
          color: "var(--text-3)",
          fontFamily: "var(--font-geist-mono)",
          maxWidth: 280,
        }}
      >
        {resultStr}
      </td>
      <td
        style={{
          padding: "10px 14px",
          fontSize: 11,
          color: "var(--text-3)",
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {dtStr}
      </td>
    </tr>
  );
}

// ── Learning Machine Panel ─────────────────────────────────────────

async function triggerLMReport() {
  const res = await fetch("/api/cron/learning-machine");
  if (!res.ok) throw new Error("Falha ao gerar análise");
  return res.json();
}

function LearningMachinePanel({ reports }: { reports: LMReport[] | null }) {
  const latest = reports?.[0] ?? null;
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [triggerResult, setTriggerResult] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  function handleGenerate() {
    setTriggerResult(null);
    setTriggerError(null);
    startTransition(async () => {
      try {
        const r = await triggerLMReport();
        setTriggerResult(
          `Análise gerada — Semana ${r.week as number}/${r.year as number} · Score ${r.score as number ?? "—"}/100`,
        );
      } catch (e) {
        setTriggerError(
          e instanceof Error ? e.message : "Erro ao gerar análise",
        );
      }
    });
  }

  const score = latest?.insights?.score_operacional ?? null;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <Brain size={16} color="#7C3AED" />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", flex: 1 }}>
          Learning Machine — Última Análise
        </span>
        {latest && (
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            Sem {latest.week_number}/{latest.year}
          </span>
        )}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "5px 14px",
            borderRadius: 8,
            border: "1px solid #7C3AED40",
            background: isPending ? "var(--surface-2)" : "rgba(124,58,237,0.10)",
            color: isPending ? "var(--text-3)" : "#7C3AED",
            cursor: isPending ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {isPending ? "Gerando…" : "Gerar análise agora"}
        </button>
      </div>

      {/* Trigger feedback */}
      {triggerResult && (
        <div style={{ padding: "8px 18px", background: `${SEV_FG.ok}14`, borderBottom: "1px solid var(--border)", fontSize: 12, color: SEV_FG.ok }}>
          ✓ {triggerResult}
        </div>
      )}
      {triggerError && (
        <div style={{ padding: "8px 18px", background: `${SEV_FG.danger}14`, borderBottom: "1px solid var(--border)", fontSize: 12, color: SEV_FG.danger }}>
          ✗ {triggerError}
        </div>
      )}

      {/* No data state */}
      {!latest ? (
        <div style={{ padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }} aria-hidden="true">🤖</div>
          <p style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600, margin: "0 0 6px", fontFamily: "var(--font-fraunces, serif)" }}>
            Nenhuma análise gerada ainda.
          </p>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.6 }}>
            Clique em "Gerar análise agora" para criar o primeiro relatório,<br />
            ou aguarde o cron de sexta-feira às 08:00 BRT.
          </p>
        </div>
      ) : (
        <div style={{ padding: "16px 18px" }}>
          {/* Score + headline */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 40, fontWeight: 700, fontFamily: "var(--font-fraunces, serif)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }} className={scoreColorClass(score)}>
                {score ?? "—"}
              </span>
              <span style={{ fontSize: 16, color: "var(--text-3)" }}>/100</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--text-3)", marginBottom: 2 }}>
                Score Operacional
              </div>
              {latest.insights?.headline && (
                <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, lineHeight: 1.4 }}>
                  {latest.insights.headline}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>
              <span><strong style={{ color: "var(--text)" }}>{latest.total_runs}</strong> execuções</span>
              <span><strong style={{ color: "var(--text)" }}>{latest.active_agents}</strong> ativos</span>
              <span><strong style={{ color: "var(--text)" }}>{latest.inactive_agents}</strong> inativos</span>
            </div>
          </div>

          {/* Expand/collapse */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-3)",
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "5px 12px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginBottom: expanded ? 16 : 0,
            }}
          >
            {expanded ? "Recolher" : "Ver análise completa"}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {expanded && latest.insights && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Agentes em destaque */}
              {latest.insights.agentes_destaque?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                    Agentes em destaque
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {latest.insights.agentes_destaque.map((a, i) => (
                      <div
                        key={i}
                        title={a.motivo}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: 99,
                          background: `${SEV_FG.ok}1F`,
                          color: SEV_FG.ok,
                          border: `1px solid ${SEV_FG.ok}40`,
                          cursor: "help",
                        }}
                      >
                        {a.nome}
                        <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 4 }}>
                          · {a.categoria}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agentes dormentes */}
              {latest.insights.agentes_dormentes?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                    Agentes dormentes
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {latest.insights.agentes_dormentes.map((a, i) => (
                      <div
                        key={i}
                        title={a.recomendacao}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: 99,
                          background: "rgba(245,158,11,0.12)",
                          color: SEV_FG.warn,
                          border: "1px solid rgba(245,158,11,0.25)",
                          cursor: "help",
                        }}
                      >
                        {a.nome}
                        <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 4 }}>
                          · {a.dias_sem_uso}d
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gaps identificados */}
              {latest.insights.gaps_identificados?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                    Gaps identificados
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {latest.insights.gaps_identificados.map((g, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          fontSize: 12,
                          padding: "6px 10px",
                          borderRadius: 8,
                          background: "rgba(239,68,68,0.06)",
                          border: "1px solid rgba(239,68,68,0.15)",
                        }}
                      >
                        <span style={{ fontWeight: 700, color: SEV_FG.danger, flexShrink: 0 }}>{g.area}</span>
                        <span style={{ color: "var(--text-2)", flex: 1 }}>{g.descricao}</span>
                        <span style={{ color: "var(--text-3)", flexShrink: 0, fontSize: 11 }}>→ {g.agente_sugerido}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Próximos passos */}
              {latest.insights.proximos_passos?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                    Próximos passos
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {latest.insights.proximos_passos.map((p, i) => {
                      const prioColor =
                        p.prioridade === "alta" ? SEV_FG.danger :
                        p.prioridade === "media" ? SEV_FG.warn : "var(--text-3)";
                      const prioBg =
                        p.prioridade === "alta" ? `${SEV_FG.danger}1A` :
                        p.prioridade === "media" ? "rgba(245,158,11,0.10)" : "var(--surface-2)";
                      return (
                        <div
                          key={i}
                          style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 7px",
                              borderRadius: 99,
                              background: prioBg,
                              color: prioColor,
                              flexShrink: 0,
                              textTransform: "capitalize",
                            }}
                          >
                            {p.prioridade}
                          </span>
                          <span style={{ color: "var(--text)", flex: 1 }}>{p.acao}</span>
                          <span style={{ color: "var(--text-3)", fontSize: 11, flexShrink: 0 }}>
                            {p.agente_responsavel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Insight da semana */}
              {latest.insights.insight_da_semana && (
                <div
                  style={{
                    borderLeft: "3px solid #7C3AED",
                    paddingLeft: 12,
                    fontSize: 13,
                    color: "var(--text-2)",
                    lineHeight: 1.7,
                    fontStyle: "italic",
                  }}
                >
                  {latest.insights.insight_da_semana}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Timeline of past reports */}
      {reports && reports.length > 1 && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "12px 18px",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
            Histórico
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {reports.slice(1).map((r) => {
              const s = r.insights?.score_operacional ?? null;
              const c = s == null ? "var(--text-3)" : s >= 70 ? "#B8975A" : s >= 40 ? "#D97706" : "#C4622D";
              return (
                <div
                  key={r.id}
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 8,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text-2)",
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "var(--text-3)" }}>Sem {r.week_number}/{r.year}</span>
                  {s != null && (
                    <span style={{ fontWeight: 700, color: c, fontVariantNumeric: "tabular-nums" }}>
                      {s}/100
                    </span>
                  )}
                  <span style={{ color: "var(--text-3)" }}>{r.total_runs} runs</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
