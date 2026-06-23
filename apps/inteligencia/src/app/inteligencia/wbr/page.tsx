import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@kph/auth/server";
import { currentWeekIso, loadWbr } from "@/lib/inteligencia/wbr";
import { generateWbrInsight } from "./actions";
import { WbrClient } from "./wbr-client";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ ref?: string }> };

export default async function WbrPage({ searchParams }: Props) {
  await requireUser();
  const sp = await searchParams;
  const ref = sp?.ref ?? currentWeekIso();

  const data = await loadWbr(ref);

  // Gerar insight com timeout de 5s — não deve travar a página
  let insight = null;
  if (data) {
    try {
      insight = await Promise.race([
        generateWbrInsight(data),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
    } catch {
      insight = null;
    }
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <Link
        href="/inteligencia"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--text-3)",
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} />
        Inteligência
      </Link>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Inteligência · WBR
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            margin: "6px 0 0",
            color: "var(--text)",
            letterSpacing: -0.4,
            fontFamily: "var(--font-fraunces, serif)",
          }}
        >
          Weekly Business Review
        </h1>
      </div>

      <WbrClient refDate={ref} payload={data} insight={insight} />
    </div>
  );
}
