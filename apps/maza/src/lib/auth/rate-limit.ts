import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createServiceClient } from "@maza/db/supabase/server";

const LOGIN_ACTION = "password_login";
const RESET_ACTION = "password_reset";

function getSecret(): string | null {
  return process.env.AUTH_RATE_LIMIT_SECRET ?? null;
}

async function identifierHash(email: string): Promise<string> {
  const secret = getSecret();
  if (!secret) {
    console.error("[auth-rate-limit] missing_secret");
    throw new Error("AUTH_RATE_LIMIT_SECRET não configurado");
  }
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return createHmac("sha256", secret)
    .update(`${email.trim().toLowerCase()}|${ip}`)
    .digest("hex");
}

async function assertAllowed(email: string, action: string): Promise<boolean> {
  const admin = createServiceClient();
  if (!admin) {
    console.error("[auth-rate-limit] missing_service_configuration");
    throw new Error("Rate limiting indisponível");
  }
  const key = await identifierHash(email);
  const { data, error, status } = await admin.rpc("auth_rate_limit_check" as never, {
    p_identifier_hash: key,
    p_action: action,
  } as never);
  if (error) {
    // Log only protocol metadata: never email, IP, tokens or provider messages.
    console.error("[auth-rate-limit] check_failed", { status, code: error.code });
    throw new Error("Rate limiting indisponível");
  }
  return data === true;
}

export async function recordLoginFailure(email: string): Promise<void> {
  const admin = createServiceClient();
  if (!admin) {
    console.error("[auth-rate-limit] missing_service_configuration");
    throw new Error("Rate limiting indisponível");
  }
  const key = await identifierHash(email);
  const { error } = await admin.rpc("auth_rate_limit_fail" as never, {
    p_identifier_hash: key,
    p_action: LOGIN_ACTION,
  } as never);
  if (error) throw new Error("Rate limiting indisponível");
}

export async function clearLoginFailures(email: string): Promise<void> {
  const admin = createServiceClient();
  if (!admin) return;
  const key = await identifierHash(email);
  await admin.rpc("auth_rate_limit_clear" as never, {
    p_identifier_hash: key,
    p_action: LOGIN_ACTION,
  } as never);
}

export function assertLoginAllowed(email: string): Promise<boolean> {
  return assertAllowed(email, LOGIN_ACTION);
}

export function assertPasswordResetAllowed(email: string): Promise<boolean> {
  return assertAllowed(email, RESET_ACTION);
}

export async function recordPasswordResetAttempt(email: string): Promise<void> {
  const admin = createServiceClient();
  if (!admin) {
    console.error("[auth-rate-limit] missing_service_configuration");
    throw new Error("Rate limiting indisponível");
  }
  const key = await identifierHash(email);
  const { error } = await admin.rpc("auth_rate_limit_fail" as never, {
    p_identifier_hash: key,
    p_action: RESET_ACTION,
  } as never);
  if (error) throw new Error("Rate limiting indisponível");
}
