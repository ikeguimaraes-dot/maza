import { requireUser } from "@kph/auth/server";
import { currentPeriodo, lastNPeriodos } from "@/lib/metas/types";
import { loadCross } from "@/lib/inteligencia/cross";
import { CrossClient } from "./cross-client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ periodo?: string }>;
};

export default async function CrossPage({ searchParams }: Props) {
  await requireUser();
  const sp = await searchParams;
  const periodo =
    sp.periodo && /^\d{4}-\d{2}$/.test(sp.periodo)
      ? sp.periodo
      : currentPeriodo();

  const [payload, periodoOptions] = await Promise.all([
    loadCross(periodo),
    Promise.resolve(lastNPeriodos(12, currentPeriodo())),
  ]);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <header style={{ marginBottom: 18 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Inteligência · Cross
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            margin: "6px 0 4px",
            color: "var(--text)",
            letterSpacing: -0.4,
            fontFamily: "var(--font-fraunces, serif)",
          }}
        >
          Comparativo cross-marca
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
          KPIs financeiros lado a lado por marca. Delta vs mês anterior (MoM).
        </p>
      </header>

      <CrossClient
        payload={payload}
        periodo={periodo}
        periodoOptions={periodoOptions}
      />
    </div>
  );
}
