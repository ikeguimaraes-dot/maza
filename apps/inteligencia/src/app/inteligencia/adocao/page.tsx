import { requireUser } from "@kph/auth/server";
import { loadAdocaoData } from "./actions";
import { AdocaoClient } from "./adocao-client";

export const dynamic = "force-dynamic";

export default async function AdocaoPage() {
  await requireUser();
  const data = await loadAdocaoData();

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
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
          Inteligência · Adoção
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
          Adoção da plataforma
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
          Módulos mais acessados, usuários ativos semanais e histórico de navegação.
        </p>
      </header>

      <AdocaoClient data={data} />
    </div>
  );
}
