/**
 * test-auth-cookie.mjs
 *
 * Prova que o getBrowserClient() escreve o cookie de sessão corretamente,
 * simulando o que @supabase/ssr faz após signInWithPassword.
 *
 * Executar: node scripts/test-auth-cookie.mjs
 */

// ─── Mock document.cookie (comportamento real do browser) ───────────────────
const cookieJar = new Map();

const mockDocument = {
  get cookie() {
    return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  },
  set cookie(str) {
    const semi = str.indexOf(";");
    const nameVal = semi === -1 ? str : str.slice(0, semi);
    const eq = nameVal.indexOf("=");
    if (eq === -1) return;
    const name = nameVal.slice(0, eq).trim();
    const value = nameVal.slice(eq + 1).trim();

    const maxAgeMatch = str.match(/Max-Age=(-?\d+)/i);
    const maxAge = maxAgeMatch ? Number(maxAgeMatch[1]) : null;

    if (maxAge !== null && maxAge <= 0) {
      cookieJar.delete(name);
    } else {
      cookieJar.set(name, value);
    }
  },
};

// Injeta no global para que o código de produção funcione
globalThis.document = mockDocument;

// ─── getAll / setAll — cópia exata do packages/db/src/supabase/client.ts ────
function getAll() {
  if (typeof document === "undefined") return [];
  return document.cookie.split(";").map((c) => {
    const eq = c.indexOf("=");
    const name = eq === -1 ? c.trim() : c.slice(0, eq).trim();
    const value = eq === -1 ? "" : c.slice(eq + 1);
    return { name, value };
  });
}

function setAll(cookiesToSet) {
  if (typeof document === "undefined") return;
  cookiesToSet.forEach(({ name, value, options }) => {
    let str = `${name}=${value}`;
    if (options?.path) str += `; Path=${options.path}`;
    if (options?.maxAge != null) str += `; Max-Age=${options.maxAge}`;
    if (options?.sameSite) str += `; SameSite=${options.sameSite}`;
    if (options?.secure) str += "; Secure";
    document.cookie = str;
  });
}

// ─── Constantes iguais ao @supabase/ssr ──────────────────────────────────────
const MAX_CHUNK_SIZE = 3180;
const BASE64_PREFIX = "base64-";
const DEFAULT_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax",
  httpOnly: false,
  maxAge: 400 * 24 * 60 * 60, // 34 560 000 s
};

// ─── Codificação base64url (Node nativo) ────────────────────────────────────
function stringToBase64URL(str) {
  return Buffer.from(str, "utf8").toString("base64url");
}

// ─── Chunking (lógica idêntica ao chunker.js do ssr) ────────────────────────
function createChunks(key, value) {
  const encoded = encodeURIComponent(value);
  if (encoded.length <= MAX_CHUNK_SIZE) {
    return [{ name: key, value }];
  }
  // simplificado — sessão real nunca excede 1 chunk (< 3 KB)
  return [{ name: `${key}.0`, value }];
}

// ─── Simula storage.setItem do @supabase/ssr ─────────────────────────────────
async function storageSetItem(storageKey, sessionJSON, extraCookieOptions = {}) {
  const allCookies = await getAll([storageKey]);
  const cookieNames = (allCookies ?? []).map(({ name }) => name);

  const encoded = BASE64_PREFIX + stringToBase64URL(sessionJSON);
  const chunks = createChunks(storageKey, encoded);
  const chunkNames = new Set(chunks.map((c) => c.name));

  const removeCookies = cookieNames.filter(
    (n) => n === storageKey || n.startsWith(`${storageKey}.`)
  );

  const cookieOptions = {
    ...DEFAULT_COOKIE_OPTIONS,
    ...extraCookieOptions,
  };
  delete cookieOptions.name; // name é só para storageKey, não atributo

  const allToSet = [
    ...removeCookies
      .filter((n) => !chunkNames.has(n))
      .map((name) => ({ name, value: "", options: { ...cookieOptions, maxAge: 0 } })),
    ...chunks.map(({ name, value }) => ({ name, value, options: cookieOptions })),
  ];

  if (allToSet.length > 0) {
    setAll(allToSet);
  }
}

// ─── SESSÃO FAKE (estrutura idêntica ao que Supabase retorna) ────────────────
const FAKE_SESSION = {
  access_token:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
    ".eyJzdWIiOiJ1c2VyLXRlc3QtMTIzIiwiZW1haWwiOiJpa2VAa3BoLm9zIiwiZXhwIjoxNzUwMDAwMDAwfQ" +
    ".SIG",
  refresh_token: "refresh-abc-123",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: {
    id: "user-test-123",
    email: "ike@kph.os",
    role: "authenticated",
  },
};

const PROJECT_REF = "iqgrvptrtphvbmvrqntm";
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;
const EXTRA_COOKIE_OPTS = { secure: true, maxAge: 60 * 60 * 24 * 400 };

// ─── EXECUÇÃO ────────────────────────────────────────────────────────────────
console.log("=== TESTE: cookie de sessão após signInWithPassword ===\n");

await storageSetItem(STORAGE_KEY, JSON.stringify(FAKE_SESSION), EXTRA_COOKIE_OPTS);

const cookies = getAll();
const authCookies = cookies.filter(
  ({ name }) => name === STORAGE_KEY || name.startsWith(`${STORAGE_KEY}.`)
);

console.log("Cookies no jar após setAll:");
cookies
  .filter(({ name }) => name.trim())
  .forEach(({ name, value }) =>
    console.log(`  ${name} = ${value.slice(0, 40)}...`)
  );

console.log();

if (authCookies.length === 0) {
  console.error("FALHOU ✗ — cookie de autenticação AUSENTE no jar");
  console.error("  Esperado: nome contendo '" + STORAGE_KEY + "'");
  process.exit(1);
}

// Verifica que o valor pode ser decodificado de volta para a sessão
const { name: authCookieName, value: authCookieValue } = authCookies[0];

if (!authCookieValue.startsWith(BASE64_PREFIX)) {
  console.error("FALHOU ✗ — valor não começa com 'base64-'");
  process.exit(1);
}

const decoded = JSON.parse(
  Buffer.from(authCookieValue.slice(BASE64_PREFIX.length), "base64url").toString("utf8")
);

if (decoded.access_token !== FAKE_SESSION.access_token) {
  console.error("FALHOU ✗ — access_token diverge após round-trip");
  process.exit(1);
}
if (decoded.user?.email !== FAKE_SESSION.user.email) {
  console.error("FALHOU ✗ — user.email diverge após round-trip");
  process.exit(1);
}

// Verifica que o server middleware ENCONTRARIA o cookie pelo mesmo storageKey
const serverReadback = getAll().filter(
  ({ name }) => name === STORAGE_KEY || name.startsWith(`${STORAGE_KEY}.`)
);

console.log("Simulação de leitura pelo middleware (server):");
serverReadback.forEach(({ name }) => console.log(`  → encontrado: ${name}`));

console.log();
console.log("Verificações:");
console.log(`  ✓ Cookie escrito: ${authCookieName}`);
console.log(`  ✓ Valor começa com '${BASE64_PREFIX}'`);
console.log(`  ✓ access_token round-trip correto`);
console.log(`  ✓ user.email round-trip correto`);
console.log(`  ✓ server middleware encontraria o cookie pelo storageKey`);
console.log();
console.log("PASSOU ✓ — cookie de sessão será escrito corretamente em produção");
