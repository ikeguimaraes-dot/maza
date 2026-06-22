import { NextResponse } from "next/server";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 dias em segundos

export async function POST(request: Request) {
  const password = process.env.SHELL_PASSWORD;

  // Fail-closed: se a env var não estiver configurada, ninguém entra.
  if (!password) {
    return NextResponse.json(
      { error: "Auth não configurado no servidor." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const submitted = typeof body.password === "string" ? body.password : "";

  // Timing-safe: faz hash SHA-256 de ambos (tamanho fixo = 32 bytes)
  // antes de comparar — evita timing attack independente do tamanho da senha.
  const expectedHash = createHash("sha256").update(password).digest();
  const submittedHash = createHash("sha256").update(submitted).digest();
  const match = timingSafeEqual(expectedHash, submittedHash);

  if (!match) {
    // Delay mínimo pra evitar enumeração por tempo de resposta
    await new Promise((r) => setTimeout(r, 200));
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  // Token: não é a senha nem algo previsível.
  // HMAC-SHA256(key=SHELL_PASSWORD, data="shell:${issuedAt}") em hex.
  const issuedAt = Math.floor(Date.now() / 1000).toString();
  const hmac = createHmac("sha256", password)
    .update(`shell:${issuedAt}`)
    .digest("hex");
  const token = `${issuedAt}:${hmac}`;

  const res = NextResponse.json({ ok: true });
  res.cookies.set("shell_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
