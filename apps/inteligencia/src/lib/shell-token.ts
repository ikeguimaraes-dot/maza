/**
 * Verificação do token shell_session — cópia idêntica ao shell.
 * Usa Web Crypto API (Edge runtime + Node.js).
 * SHELL_PASSWORD deve ter o mesmo valor que no projeto kph-os.
 *
 * Token format: "${issuedAt}:${hmacHex}"
 */

const COOKIE_MAX_AGE_S = 7 * 24 * 60 * 60;

export async function verifyShellToken(token: string): Promise<boolean> {
  const password = process.env.SHELL_PASSWORD;
  if (!password) return false;

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

    if (hmacHex.length !== 64) return false;
    const mac = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      mac[i] = parseInt(hmacHex.slice(i * 2, i * 2 + 2), 16);
    }

    return await globalThis.crypto.subtle.verify("HMAC", key, mac, data);
  } catch {
    return false;
  }
}
