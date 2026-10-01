import assert from 'node:assert/strict';

// One intentional failed login with a reserved, non-deliverable test identity.
// No real credentials or existing browser session are used.
const base = process.argv[2];
assert.ok(base, 'Usage: node scripts/test-login-availability.mjs https://your-host');
const login = new URL('/login', base);
const page = await fetch(login, { signal: AbortSignal.timeout(30_000) });
assert.equal(page.status, 200, 'Login page must be available');
const html = await page.text();
const chunks = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
let action;
for (const chunk of chunks) {
  const url = new URL(chunk, login);
  assert.equal(url.origin, login.origin, 'Only inspect same-origin application chunks');
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  assert.ok(response.ok, 'Login script must load');
  const source = await response.text();
  action = source.match(/createServerReference\)\("([a-f0-9]+)"[^;]*?"signIn"\)/)?.[1];
  if (action) break;
}
assert.ok(action, 'Could not locate the published signIn action; review the test protocol');
const response = await fetch(login, {
  method: 'POST',
  headers: { Origin: login.origin, 'Content-Type': 'text/plain;charset=UTF-8', 'Next-Action': action },
  body: JSON.stringify([{ email: 'codex-login-check@example.invalid', password: 'Synthetic-test-only-123', remember: false, next: '/' }]),
  signal: AbortSignal.timeout(30_000),
});
const body = await response.text();
assert.equal(response.status, 200, 'Login action must respond');
assert.ok(body.includes('E-mail ou senha incorretos.'), 'Expected credential validation, received: ' + body.slice(0,500));
console.log('PASS: unauthenticated login reaches credential validation, without infrastructure error.');
