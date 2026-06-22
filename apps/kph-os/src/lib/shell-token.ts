/**
 * Verificação do token shell_session.
 * Usa exclusivamente Web Crypto API (funciona em Edge runtime e Node.js).
 * NÃO importa de next/* — pode ser importado pelo middleware.
 *
 * Token format: "${issuedAt}:${hmacHex}"
 *   issuedAt  = Unix timestamp em segundos (quando o login ocorreu)
 *   hmacHex   = HMAC-SHA256(key=SHELL_PASSWORD, data="shell:${issuedAt}") em hex
 */

const COOKIE_MAX_AGE_S = 7 * 24 * 60 * 60; // 7 dias

export async function verifyShellToken(token: string): Promise<boolean> {
  const password = process.env.SHELL_PASSWORD;
  if (!password) return false; // fail-closed: sem env var, ninguém entra

  const colonIdx = token.indexOf(":");
  if (colonIdx === -1) return false;

  const issuedAtStr = token.slice(0, colonIdx);
  const hmacHex = token.slice(colonIdx + 1);

  const issuedAt = Number(issuedAtStr);
  if (!Number.isInteger(issuedAt) || issuedAt <= 0) return false;

  const nowS = Math.floor(Date.now() / 1000);
  if (nowS - issuedAt > COOKIE_MAX_AGE_S) return false;

  try {
    const enc = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const data = enc.encode(`shell:${issuedAtStr}`);

    // Converte hex → Uint8Array
    if (hmacHex.length !== 64) return false; // SHA-256 = 32 bytes = 64 hex chars
    const mac = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      mac[i] = parseInt(hmacHex.slice(i * 2, i * 2 + 2), 16);
    }

    // subtle.verify é timing-safe por spec
    return await globalThis.crypto.subtle.verify("HMAC", key, mac, data);
  } catch {
    return false;
  }
}
