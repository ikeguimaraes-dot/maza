import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { NAV_CONFIG } from "@/lib/nav-config";

export const dynamic = "force-static";

const CORS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Hash de conteúdo (não timestamp) — só muda quando NAV_CONFIG muda,
// permitindo a zona detectar atualização de menu entre builds do shell.
const VERSAO = createHash("sha256").update(JSON.stringify(NAV_CONFIG)).digest("hex").slice(0, 8);

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export function GET() {
  return NextResponse.json(
    {
      versao: VERSAO,
      shellUrl: process.env.NEXT_PUBLIC_SHELL_URL ?? null,
      groups: NAV_CONFIG,
    },
    { headers: { ...CORS, "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
