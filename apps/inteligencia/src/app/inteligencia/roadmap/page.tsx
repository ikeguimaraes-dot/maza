import { requireUser } from "@kph/auth/server";
import { loadRoadmap } from "./actions";
import { RoadmapClient } from "./roadmap-client";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  await requireUser();
  const items = await loadRoadmap();

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
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
          Inteligência · Roadmap
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
          Roadmap da plataforma
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
          Progresso dos sprints de desenvolvimento do KPH OS Inteligência.
        </p>
      </header>

      <RoadmapClient items={items} />
    </div>
  );
}
