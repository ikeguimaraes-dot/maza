import { requireUser } from "@kph/auth/server";
import { loadJobs } from "@/lib/inteligencia/orquestrador";
import { loadLMReports } from "@kph/core/learning-machine";
import { OrquestradorClient } from "./orquestrador-client";

export const dynamic = "force-dynamic";

export default async function OrquestradorPage() {
  await requireUser();

  const [jobs, lmReports] = await Promise.all([
    loadJobs(),
    loadLMReports(4),
  ]);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Orquestrador
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
          Orquestrador de jobs
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
          Execuções de deploy, sincronização, alertas e integrações automáticas.
        </p>
      </header>

      <OrquestradorClient jobs={jobs} lmReports={lmReports} />
    </div>
  );
}
