import { requireUser } from "@kph/auth/server";
import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { InsightPanel } from "@/components/intelligence/InsightPanel";

export const dynamic = "force-dynamic";

type DreRow = {
  brand_name?: string;
  mes?: number;
  ano?: number;
  receita_bruta?: number;
  cmv?: number;
  cmv_pct?: number;
  ebitda?: number;
  ebitda_pct?: number;
};

async function getDreResumo(): Promise<DreRow[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const mesAtual = new Date().getMonth() + 1;
    const anoAtual = new Date().getFullYear();
    const { data } = await (supabase as any)
      .from("v_dre_consolidado")
      .select("brand_name, mes, ano, receita_bruta, cmv, cmv_pct, ebitda, ebitda_pct")
      .eq("mes", mesAtual)
      .eq("ano", anoAtual)
      .order("receita_bruta", { ascending: false });
    return (data ?? []) as DreRow[];
  } catch {
    return [];
  }
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const PCT = (v?: number) => v != null ? `${v.toFixed(1)}%` : "—";

export default async function FinanceiroPage() {
  await requireUser();
  const rows = await getDreResumo();

  const totalReceita = rows.reduce((s, r) => s + (r.receita_bruta ?? 0), 0);
  const totalEbitda = rows.reduce((s, r) => s + (r.ebitda ?? 0), 0);
  const cmvMedio = rows.length > 0 ? rows.reduce((s, r) => s + (r.cmv_pct ?? 0), 0) / rows.length : null;
  const ebitdaPct = totalReceita > 0 ? (totalEbitda / totalReceita) * 100 : null;

  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const mesLabel = new Date().toLocaleString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text)", letterSpacing: -0.6, margin: 0 }}>
          Financeiro
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>
          DRE consolidado · {mesLabel}
        </p>
      </header>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 28 }}>
        <KpiCard label="Receita Bruta (mês)" value={BRL.format(totalReceita)} />
        <KpiCard
          label="CMV Médio"
          value={cmvMedio != null ? PCT(cmvMedio) : "—"}
          alert={cmvMedio != null && cmvMedio > 32}
          warn={cmvMedio != null && cmvMedio > 28 && cmvMedio <= 32}
        />
        <KpiCard
          label="EBITDA"
          value={ebitdaPct != null ? `${BRL.format(totalEbitda)} (${PCT(ebitdaPct)})` : "—"}
          alert={ebitdaPct != null && ebitdaPct < 12}
          warn={ebitdaPct != null && ebitdaPct < 18 && ebitdaPct >= 12}
        />
        <KpiCard label="Marcas com dados" value={String(rows.length)} />
      </div>

      {/* Per-brand table */}
      {rows.length > 0 && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
            marginBottom: 28,
          }}
        >
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                {["Marca", "Receita Bruta", "CMV %", "EBITDA", "EBITDA %"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: h === "Marca" ? "left" : "right",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                      color: "var(--text-3)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const cmvAlert = (r.cmv_pct ?? 0) > 32;
                const cmvWarn = !cmvAlert && (r.cmv_pct ?? 0) > 28;
                const ebitdaAlert = (r.ebitda_pct ?? 0) < 12;
                const ebitdaWarn = !ebitdaAlert && (r.ebitda_pct ?? 0) < 18;
                return (
                  <tr
                    key={i}
                    style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}
                  >
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text)" }}>
                      {r.brand_name ?? "—"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-2)" }}>
                      {BRL.format(r.receita_bruta ?? 0)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: cmvAlert ? "#EF4444" : cmvWarn ? "#F59E0B" : "var(--text-2)" }}>
                      {PCT(r.cmv_pct)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-2)" }}>
                      {BRL.format(r.ebitda ?? 0)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: ebitdaAlert ? "#EF4444" : ebitdaWarn ? "#F59E0B" : "#22C55E" }}>
                      {PCT(r.ebitda_pct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {rows.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-3)", fontSize: 14 }}>
          Sem dados de DRE para {mesLabel}. Os dados serão exibidos assim que a integração com o ERP enviar o fechamento do mês.
        </div>
      )}

      <InsightPanel
        module="financeiro"
        context={{
          mes: mesAtual,
          ano: anoAtual,
          receita_bruta_total: totalReceita,
          cmv_medio_pct: cmvMedio,
          ebitda_total: totalEbitda,
          ebitda_pct: ebitdaPct,
          marcas: rows.map((r) => ({
            nome: r.brand_name,
            receita: r.receita_bruta,
            cmv_pct: r.cmv_pct,
            ebitda_pct: r.ebitda_pct,
          })),
        }}
        title="Insight Financeiro"
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  alert,
  warn,
}: {
  label: string;
  value: string;
  alert?: boolean;
  warn?: boolean;
}) {
  const color = alert ? "#EF4444" : warn ? "#F59E0B" : "var(--text)";
  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid ${alert ? "rgba(239,68,68,0.3)" : warn ? "rgba(245,158,11,0.3)" : "var(--border)"}`,
        borderRadius: 8,
        padding: "18px 20px",
      }}
    >
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-3)", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: -0.4 }}>{value}</div>
    </div>
  );
}
