"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, KeyRound } from "lucide-react";
import { Button } from "@kph/ui/button";
import { Input } from "@kph/ui/input";
import { Label } from "@kph/ui/label";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (res.ok) {
      window.location.href = next;
      return;
    }

    const data = await res.json().catch(() => ({})) as { error?: string };
    setError(data.error ?? "Senha incorreta.");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        color: "var(--text)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          padding: 32,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>
            KPH <span style={{ color: "var(--brand)" }}>OS</span>
          </div>
          <p
            style={{
              marginTop: 6,
              color: "var(--text-3)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            Operações · Acesso restrito
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <Label htmlFor="password">
              <KeyRound
                className="inline mr-1.5 h-3.5 w-3.5"
                style={{ verticalAlign: "middle" }}
              />
              Senha de acesso
            </Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
              autoFocus
              autoComplete="current-password"
            />
          </div>

          <Button
            type="submit"
            disabled={loading || !password}
            className="mt-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Entrar"
            )}
          </Button>
        </form>

        {error && (
          <p
            style={{
              marginTop: 16,
              fontSize: 12,
              color: "var(--destructive)",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}

        <p
          style={{
            marginTop: 24,
            fontSize: 10,
            color: "var(--text-3)",
            textAlign: "center",
            letterSpacing: 0.4,
          }}
        >
          Gate de desenvolvimento · Auth real em sprint dedicado
        </p>
      </div>
    </div>
  );
}
