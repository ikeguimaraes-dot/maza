"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Search, Menu } from "lucide-react";
import { useAuth } from "@maza/auth/context";
import { NotificationBell } from "@/components/shell/NotificationBell";
import { CommandPalette } from "@/components/shell/CommandPalette";

function firstName(email: string | null | undefined): string {
  if (!email) return "operador";
  const local = email.split("@")[0] ?? "";
  const first = local.split(".")[0] ?? local;
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "operador";
}

/**
 * Nome a exibir no greeting. Prioriza o display_name vindo do
 * user_metadata (definido no Auth → Users do Supabase). Se ausente,
 * deriva um nome legível a partir do e-mail.
 */
function greetName(user: { displayName?: string | null; email?: string | null } | null | undefined): string {
  const fromMeta = user?.displayName?.trim();
  if (fromMeta) {
    // Pega só o primeiro nome ("Karine Azevedo Corrêa" → "Karine")
    return fromMeta.split(/\s+/)[0]!;
  }
  return firstName(user?.email);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function fmtDate(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });
}

const PATH_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/operacao": "Operação",
  "/pessoas": "Pessoas",
  "/cardapio": "Cardápio",
  "/compras": "Compras",
  "/cliente": "Cliente & Experiência",
  "/inteligencia": "Inteligência",
  "/marca": "Marca & Cultura",
};

export function TopBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const title = PATH_LABELS[pathname] ?? "Maza";
  const name = greetName(user);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="shell-topbar" style={{
      height: 64, flexShrink: 0,
      display: "flex", alignItems: "center", gap: 16,
      padding: "0 20px",
      borderBottom: "1px solid var(--border)",
      background: "var(--bg)",
    }}>
      <button
        className="shell-hamburger"
        onClick={() => window.dispatchEvent(new Event("maza:toggleSidebar"))}
        title="Abrir menu"
        style={{
          display: "none", alignItems: "center", justifyContent: "center",
          width: 36, height: 36, borderRadius: 8,
          background: "transparent", border: "1px solid var(--border)",
          color: "var(--text)", cursor: "pointer"
        }}
      >
        <Menu size={18} />
      </button>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div
          className="shell-topbar-title"
          style={{
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "var(--text-3)",
            fontFamily: "var(--font-ui)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontWeight: 300,
              color: "var(--text)",
              fontSize: "0.9375rem",
              letterSpacing: "-0.01em",
            }}
          >
            {greeting()}, {name}
          </span>
          {" · "}
          {title}
        </div>
        <div
          className="shell-topbar-date"
          style={{ fontSize: "0.6875rem", color: "var(--text-3)", fontFamily: "var(--font-ui)" }}
        >
          {fmtDate()}
        </div>
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />

      <button
        className="shell-topbar-search"
        title="Buscar (Cmd/Ctrl+K)"
        onClick={() => setCmdOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "8px 12px",
          background: "var(--surface)",
          border: "1px solid var(--border-soft, rgba(245,240,232,0.08))",
          borderRadius: "var(--r-md, 6px)",
          color: "var(--text-3)", fontSize: "0.75rem", cursor: "pointer",
          transition: "border-color var(--t, 180ms ease), color var(--t, 180ms ease)",
          fontFamily: "var(--font-ui)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--border-hover, rgba(245,240,232,0.16))";
          e.currentTarget.style.color = "var(--text-2, #C4BDB4)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border-soft, rgba(245,240,232,0.08))";
          e.currentTarget.style.color = "var(--text-3)";
        }}
      >
        <Search size={14} />
        <span>Buscar</span>
        <span style={{
          marginLeft: 6, padding: "1px 6px",
          background: "var(--surface-2)",
          border: "1px solid var(--border-soft, rgba(245,240,232,0.08))",
          borderRadius: "var(--r-sm, 4px)",
          fontFamily: "var(--font-ui)", fontSize: "0.625rem", color: "var(--text-3)",
          letterSpacing: "0.02em",
        }}>⌘K</span>
      </button>

      <NotificationBell />
    </header>
  );
}
