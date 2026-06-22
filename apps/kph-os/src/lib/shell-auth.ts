import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { CurrentUser } from "@kph/auth/server";
import { verifyShellToken } from "./shell-token";

/**
 * Stub de usuário para o gate de desenvolvimento.
 * Substitui o CurrentUser do Supabase enquanto o auth real não está ativo.
 * NÃO usar para qualquer lógica que dependa de identidade real.
 */
export const SHELL_USER: CurrentUser = {
  id: "shell-gate",
  email: "ike@kph.os",
  roles: [{ role: "founder", unitId: null, brandId: null, groupId: null }],
};

/**
 * Equivalente ao requireUser() do @kph/auth/server, mas valida o cookie
 * shell_session em vez da sessão Supabase.
 * Redireciona para /login se o cookie estiver ausente ou inválido.
 */
export async function requireShellSession(): Promise<CurrentUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get("shell_session")?.value ?? "";
  const valid = await verifyShellToken(token);
  if (!valid) redirect("/login");
  return SHELL_USER;
}
