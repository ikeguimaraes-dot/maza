import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../types/database";

/**
 * Mantém a sessão Supabase em sincronia entre request e response.
 * Chamado pelo proxy.ts a cada request — a versão moderna do que era
 * o middleware do Next ≤ 15.
 *
 * Se as env vars não estão setadas (modo dev sem Supabase), retorna user=null
 * e o proxy redireciona pra /login. UI não quebra.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { response, user: null };
  }

  const projectRef = new URL(url).hostname.split(".")[0] ?? "";
  const authCookieName = `sb-${projectRef}-auth-token`;
  const backupCookieName = "kph_auth_session_backup";
  const backup = request.cookies.get(backupCookieName)?.value;
  if (!request.cookies.get(authCookieName)?.value && backup) {
    request.cookies.set(authCookieName, backup);
    response = NextResponse.next({ request });
    response.cookies.set(authCookieName, backup, {
      path: "/", httpOnly: true, sameSite: "lax", secure: false,
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Padrão oficial @supabase/ssr: atualiza request + cria nova response com
        // cookies persistidos. Server Components vêem o cookie atualizado via
        // request; browser recebe o cookie via Set-Cookie na response.
        const safeCookies = cookiesToSet.filter(
          ({ name, value, options }) =>
            !name.includes("auth-token") ||
            (value.length > 0 && (options?.maxAge == null || options.maxAge > 0)),
        );
        safeCookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        safeCookies.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        const renewed = safeCookies.find(({ name }) => name === authCookieName);
        if (renewed) {
          response.cookies.set(backupCookieName, renewed.value, {
            path: "/", httpOnly: true, sameSite: "lax", secure: false,
            maxAge: 60 * 60 * 24 * 30,
          });
        }
      },
    },
  });

  // getClaims() valida a assinatura do JWT e usa o JWKS em cache quando
  // disponível. Isso evita uma chamada remota ao Auth a cada troca de zona,
  // que fazia falhas transitórias serem interpretadas como logout.
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;

  return {
    response,
    user: subject ? { id: subject } : null,
    authError: error,
  };
}
