"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Info,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { buttonVariants } from "@kph/ui/button";
import { formatBRL } from "@/lib/format";
import {
  cmvSeverity,
  primeSeverity,
  receitaSeverity,
  type Severity,
  type WbrAlertaDetalhe,
  type WbrBrandKpi,
  type WbrPayload,
  type WbrTrendPoint,
} from "@/lib/inteligencia/wbr-shared";
import { calcIntelligenceScore } from "@/lib/inteligencia/intelligence-score";
import type { WbrInsight } from "./actions";
import { SEV_FG, SEV_BG } from "@/lib/tokens";
import { scoreColorClass } from "@kph/core";

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y?.slice(2)}`;
}

function shiftDateIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function WbrClient({
  refDate,
  payload,
  insight,
}: {
  refDate: string;
  payload: WbrPayload | null;
  insight?: WbrInsight | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setRef(newRef: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("ref", newRef);
    router.push(`/inteligencia/wbr?${params.toString()}`);
  }

  if (!payload) {
    return (
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <p style={{ color: "var(--text-3)", fontSize: 13 }}>
          Não foi possível carregar os dados.
        </p>
      </div>
    );
  }

  const periodLabel = `${formatDateBR(payload.weekStart)} – ${formatDateBR(payload.weekEnd)}`;
  const intelligenceScore = calcIntelligenceScore(payload);

  return (
    <div>
      {/* Week navigator + period label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
          Semana <strong style={{ color: "var(--text-2)" }}>{periodLabel}</strong>
          {" · "}referência {payload.monthCompetencia.slice(0, 7)}
        </p>

        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setRef(shiftDateIso(refDate, -7))}
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={refDate}
            onChange={(e) => setRef(e.target.value)}
            aria-label="Data de referência da semana"
            style={{
              fontSize: 12,
              border: "none",
              background: "transparent",
              color: "var(--text)",
              padding: "4px 6px",
            }}
          />
          <button
            type="button"
            onClick={() => setRef(shiftDateIso(refDate, 7))}
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setRef(new Date().toISOString().slice(0, 10))}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Hoje
          </button>
        </div>
      </div>

      {/* KPH Intelligence Score */}
      <IntelligenceScoreCard score={intelligenceScore} />

      {/* AI Insight */}
      {insight && <WbrInsightPanel insight={insight} />}

      {/* KPIs do grupo */}
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          marginBottom: 18,
        }}
      >
        <KpiCard
          label="Receita semana"
          value={formatBRL(payload.total_receita)}
          icon={<TrendingUp size={14} />}
        />
        <KpiCard
          label="Eventos semana"
          value={String(payload.total_eventos)}
          icon={<CalendarDays size={14} />}
        />
        <KpiCard
          label="Headcount ativo"
          value={String(payload.total_headcount)}
          icon={<Users size={14} />}
        />
        <KpiCard
          label="Alertas críticos"
          value={String(payload.total_alertas_criticos)}
          icon={<AlertTriangle size={14} />}
          tone={payload.total_alertas_criticos > 0 ? "danger" : "ok"}
        />
      </div>

      {/* Tabela por marca */}
      {payload.brands.length === 0 ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            fontSize: 13,
            color: "var(--text-3)",
          }}
        >
          Nenhuma marca acessível. Verifique permissões.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {payload.brands.map((b) => (
            <BrandCard key={b.brand_id} kpi={b} />
          ))}
        </div>
      )}

      {/* Trend chart — últimas 8 semanas */}
      {payload.trend && payload.trend.length > 0 && (
        <TrendChart trend={payload.trend} brands={payload.brands} />
      )}

      <p
        style={{
          fontSize: 11,
          color: "var(--text-3)",
          marginTop: 18,
          lineHeight: 1.55,
        }}
      >
        Receita realizada vem de <code>cash_flow_entries</code> filtrado por
        data_lancamento da semana. Receita projetada é o mensal proporcional
        (÷4,33). CMV%, prime cost e EBITDA são snapshots do mês corrente
        (v_dre_consolidado). Headcount, eventos e alertas são instantâneos.
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger";
}) {
  const fg =
    tone === "danger"
      ? SEV_FG.danger
      : tone === "warn"
      ? SEV_FG.warn
      : tone === "ok"
      ? SEV_FG.ok
      : "var(--text)";
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: fg,
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function BrandCard({ kpi }: { kpi: WbrBrandKpi }) {
  const [alertasOpen, setAlertasOpen] = useState(kpi.alertas_criticos > 0);
  const sevReceita = receitaSeverity(kpi.receita_gap_pct);
  const sevCmv = cmvSeverity(kpi.cmv_pct, kpi.cmv_meta);
  const sevPrime = primeSeverity(kpi.prime_cost_pct, kpi.prime_cost_meta);
  const semReceita = kpi.receita_realizada === 0 && kpi.receita_mensal_dre != null && kpi.receita_mensal_dre > 0;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 18,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 28,
              borderRadius: 4,
              background: kpi.brand_color ?? "var(--brand)",
            }}
          />
          <h2
            style={{
              fontSize: 17,
              fontWeight: 700,
              margin: 0,
              color: "var(--text)",
              letterSpacing: -0.3,
            }}
          >
            {kpi.brand_name}
          </h2>
          {kpi.alertas_criticos > 0 && (
            <button
              type="button"
              onClick={() => setAlertasOpen((v) => !v)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 99,
                background: SEV_BG.danger,
                color: SEV_FG.danger,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                border: "none",
                cursor: "pointer",
              }}
            >
              <AlertTriangle size={11} />
              {kpi.alertas_criticos} crítico{kpi.alertas_criticos === 1 ? "" : "s"}
              {alertasOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          )}
        </div>
      </div>

      {/* Painel de alertas expandível */}
      {alertasOpen && kpi.alertas_detalhe.length > 0 && (
        <div
          style={{
            marginBottom: 14,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {kpi.alertas_detalhe.map((a, i) => (
            <AlertaItem key={i} alerta={a} />
          ))}
        </div>
      )}

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <Metric
          label="Receita realizada"
          value={formatBRL(kpi.receita_realizada)}
          severity="ok"
          hint={`vs projetado ${formatBRL(kpi.receita_projetada)}`}
          extra={
            semReceita
              ? `Mês corrente (DRE): ${formatBRL(kpi.receita_mensal_dre)}`
              : undefined
          }
        />
        <Metric
          label="Gap projeção"
          value={
            kpi.receita_gap_pct == null
              ? "—"
              : `${kpi.receita_gap_pct >= 0 ? "+" : ""}${kpi.receita_gap_pct}%`
          }
          severity={sevReceita}
          hint={`${formatBRL(kpi.receita_gap_abs)} abs.`}
        />
        <Metric
          label="CMV%"
          value={kpi.cmv_pct == null ? "—" : `${kpi.cmv_pct}%`}
          severity={sevCmv}
          hint={kpi.cmv_meta != null ? `meta ${kpi.cmv_meta}%` : "sem meta"}
        />
        <Metric
          label="Prime cost"
          value={kpi.prime_cost_pct == null ? "—" : `${kpi.prime_cost_pct}%`}
          severity={sevPrime}
          hint={
            kpi.prime_cost_meta != null
              ? `meta ${kpi.prime_cost_meta}%`
              : "sem meta"
          }
        />
        <Metric
          label="EBITDA%"
          value={kpi.ebitda_pct == null ? "—" : `${kpi.ebitda_pct}%`}
          severity={
            kpi.ebitda_pct == null ? "ok" : kpi.ebitda_pct >= 18 ? "ok" : kpi.ebitda_pct >= 12 ? "warn" : "danger"
          }
          hint="snapshot mês"
        />
        <MetricHeadcount kpi={kpi} />
        <Metric
          label="Eventos"
          value={String(kpi.eventos_total)}
          severity="ok"
          hint={`${kpi.eventos_concluidos} concl. · ${kpi.eventos_em_andamento} and. · ${kpi.eventos_pendentes} pend.`}
        />
        <Metric
          label="Alertas (todos)"
          value={String(kpi.alertas_total)}
          severity={
            kpi.alertas_criticos > 0
              ? "danger"
              : kpi.alertas_total > 0
              ? "warn"
              : "ok"
          }
          hint={`${kpi.alertas_criticos} crítico${kpi.alertas_criticos === 1 ? "" : "s"}`}
        />
      </div>

      {/* Nota: receita semanal zerada mas mês tem dados */}
      {semReceita && (
        <div
          style={{
            marginTop: 10,
            padding: "6px 10px",
            background: "rgba(245,158,11,0.10)",
            border: "1px solid rgba(245,158,11,0.25)",
            borderRadius: 8,
            fontSize: 11,
            color: SEV_FG.warn,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Info size={12} />
          Nenhum lançamento de receita registrado nesta semana. Receita do mês no DRE:{" "}
          <strong>{formatBRL(kpi.receita_mensal_dre)}</strong>. Registre lançamentos no módulo Financeiro.
        </div>
      )}
    </div>
  );
}

function AlertaItem({ alerta }: { alerta: WbrAlertaDetalhe }) {
  const isCritical = alerta.severidade === "error";
  const bg = isCritical ? SEV_BG.danger : SEV_BG.warn;
  const fg = isCritical ? SEV_FG.danger : SEV_FG.warn;
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${fg}33`,
        borderRadius: 8,
        padding: "8px 12px",
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      <AlertTriangle size={13} color={fg} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              color: fg,
            }}
          >
            {alerta.tipo_alerta.replace(/_/g, " ")}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>
            {new Date(alerta.created_at).toLocaleDateString("pt-BR")}
          </span>
        </div>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-2)",
            margin: "2px 0 0",
            lineHeight: 1.45,
          }}
        >
          {alerta.mensagem}
        </p>
      </div>
    </div>
  );
}

function MetricHeadcount({ kpi }: { kpi: WbrBrandKpi }) {
  const [open, setOpen] = useState(false);
  const hasBreakdown = kpi.headcount_breakdown.length > 0;
  return (
    <div
      style={{
        background: SEV_BG.ok,
        border: `1px solid ${SEV_FG.ok}33`,
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: SEV_FG.ok,
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        Headcount
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginTop: 4,
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {kpi.headcount_ativo}
        </span>
        {hasBreakdown && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              fontSize: 10,
              color: "var(--text-3)",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              padding: "2px 4px",
            }}
          >
            por dept {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
        ativo
      </div>
      {open && hasBreakdown && (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {kpi.headcount_breakdown.map((d) => (
            <div
              key={d.departamento}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "var(--text-2)",
              }}
            >
              <span>{d.departamento}</span>
              <span style={{ fontWeight: 700 }}>{d.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Fallback palette when brand has no color
const BRAND_COLORS = [
  "#D4A574", "#8B6914", "#5C3D1E", "#A0845C",
  "#6B8FA3", "#7B6E5D", "#4A7C59", "#9B7DB6",
];

function TrendChart({
  trend,
  brands,
}: {
  trend: WbrTrendPoint[];
  brands: WbrBrandKpi[];
}) {
  // Build recharts data: [{ week_label, [brand_id]: receita, ... }]
  const data = trend.map((point) => {
    const row: Record<string, string | number> = { week_label: point.week_label };
    for (const b of point.brands) {
      if (b.receita != null) row[b.brand_id] = b.receita;
    }
    return row;
  });

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 20,
        marginTop: 16,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: 4,
        }}
      >
        Tendência de receita — últimas 8 semanas
      </div>
      <div
        style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 16 }}
      >
        Receita realizada por marca (cash_flow_entries)
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="week_label"
            tick={{ fontSize: 11, fill: "var(--text-3)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--text-3)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              v === 0
                ? "R$0"
                : v >= 1000
                ? `R$${(v / 1000).toFixed(0)}k`
                : `R$${v}`
            }
            width={52}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: unknown, name: unknown) => {
              const num = typeof value === "number" ? value : 0;
              const key = typeof name === "string" ? name : "";
              const brand = brands.find((b) => b.brand_id === key);
              return [
                new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                }).format(num),
                brand?.brand_name ?? key,
              ];
            }}
            labelStyle={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => {
              const brand = brands.find((b) => b.brand_id === value);
              return (
                <span style={{ fontSize: 11, color: "var(--text-2)" }}>
                  {brand?.brand_name ?? value}
                </span>
              );
            }}
          />
          {brands.map((b, i) => (
            <Line
              key={b.brand_id}
              type="monotone"
              dataKey={b.brand_id}
              stroke={b.brand_color ?? BRAND_COLORS[i % BRAND_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function IntelligenceScoreCard({
  score,
}: {
  score: ReturnType<typeof calcIntelligenceScore>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 18px",
        marginBottom: 18,
        display: "flex",
        alignItems: "center",
        gap: 18,
        flexWrap: "wrap",
      }}
    >
      {/* Score number */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontSize: 48,
            fontWeight: 700,
            fontFamily: "var(--font-fraunces, serif)",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
          className={scoreColorClass(score.score)}
        >
          {score.score}
        </span>
        <span style={{ fontSize: 18, color: "var(--text-3)", fontWeight: 400 }}>
          /100
        </span>
      </div>

      {/* Label + delta */}
      <div style={{ flex: 1, minWidth: 160 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: "var(--text-3)",
            marginBottom: 2,
          }}
        >
          KPH Intelligence Score
        </div>
        {score.delta != null && (
          <div
            style={{
              fontSize: 12,
              color: score.delta >= 0 ? SEV_FG.ok : SEV_FG.danger,
              fontWeight: 600,
            }}
          >
            {score.delta >= 0 ? "+" : ""}
            {score.delta} vs semana anterior
          </div>
        )}
      </div>

      {/* Breakdown toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
          whiteSpace: "nowrap",
        }}
      >
        Ver breakdown
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {/* Breakdown panel */}
      {open && (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            borderTop: "1px solid var(--border)",
            paddingTop: 12,
            marginTop: 4,
          }}
        >
          {score.breakdown.map((dim) => (
            <div
              key={dim.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
              }}
            >
              {/* Score bar */}
              <div
                style={{
                  width: 120,
                  height: 6,
                  borderRadius: 3,
                  background: "var(--border)",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${dim.score}%`,
                    height: "100%",
                    borderRadius: 3,
                    background:
                      dim.score >= 70
                        ? "#B8975A"
                        : dim.score >= 40
                        ? "#D97706"
                        : "#C4622D",
                  }}
                />
              </div>
              <span
                style={{
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 700,
                  color: "var(--text-2)",
                  width: 26,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {dim.score}
              </span>
              <span style={{ color: "var(--text-3)", flexShrink: 0 }}>
                {dim.label}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-3)",
                  fontStyle: "italic",
                }}
              >
                {dim.detail}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 10,
                  color: "var(--text-3)",
                  flexShrink: 0,
                }}
              >
                peso {dim.weight}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WbrInsightPanel({ insight }: { insight: WbrInsight }) {
  const hora = new Date(insight.gerado_em).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section
      aria-live="polite"
      style={{
        borderLeft: "3px solid #B8975A",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeftColor: "#B8975A",
        borderLeftWidth: 3,
        borderRadius: 12,
        padding: "14px 18px",
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "#B8975A",
            background: "rgba(184,151,90,0.14)",
            border: "1px solid rgba(184,151,90,0.35)",
            borderRadius: 99,
            padding: "2px 8px",
          }}
        >
          IA
        </span>
        <span
          style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}
        >
          Análise CFO · gerado às {hora}
        </span>
      </div>
      <p
        style={{
          fontSize: 13,
          color: "var(--text-2)",
          margin: 0,
          lineHeight: 1.7,
          whiteSpace: "pre-line",
        }}
      >
        {insight.text}
      </p>
    </section>
  );
}

function Metric({
  label,
  value,
  severity,
  hint,
  extra,
}: {
  label: string;
  value: string;
  severity: Severity;
  hint?: string;
  extra?: string;
}) {
  return (
    <div
      style={{
        background: SEV_BG[severity],
        border: `1px solid ${SEV_FG[severity]}33`,
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: SEV_FG[severity],
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text)",
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          style={{
            fontSize: 10,
            color: "var(--text-3)",
            marginTop: 2,
          }}
        >
          {hint}
        </div>
      )}
      {extra && (
        <div
          style={{
            fontSize: 10,
            color: SEV_FG.warn,
            marginTop: 3,
            fontStyle: "italic",
          }}
        >
          {extra}
        </div>
      )}
    </div>
  );
}
