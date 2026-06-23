import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@kph/db/supabase/proxy";

// Rotas que bypassam a validação de sessão.
// /api/ usa CRON_SECRET próprio (learning-machine cron).
// /login é safety valve — a zona não tem página de login, mas evita loop
// caso o middleware receba um redirect de volta pra cá.
const PUBLIC_PREFIXES = [
  "/login",
  "/api/",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Exclui internals do Next.js, assets estáticos e imagens.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
