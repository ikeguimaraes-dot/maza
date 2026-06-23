import { requireUser, isFounder } from "@kph/auth/server";
import { loadFeedback } from "./actions";
import { FeedbackClient } from "./feedback-client";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const user = await requireUser();
  const items = await loadFeedback();

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
          Inteligência · Bugs & Feedback
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
          Bugs & Feedback
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
          Reporte bugs e sugestões de melhoria para a plataforma KPH OS.
        </p>
      </header>

      <FeedbackClient initialItems={items} isFounder={isFounder(user)} />
    </div>
  );
}
