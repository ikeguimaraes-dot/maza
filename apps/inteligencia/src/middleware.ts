import { type NextRequest, NextResponse } from "next/server";
import { verifyShellToken } from "@/lib/shell-token";

// /api/ usa CRON_SECRET próprio (learning-machine cron) — não precisa de shell_session.
const PUBLIC_PREFIXES = ["/login", "/api/"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("shell_session")?.value ?? "";
  const valid = await verifyShellToken(token);

  if (!valid) {
    // Quando acessado via proxy do shell o origin já é o do shell —
    // redireciona para /login no mesmo origin para não sair do domínio.
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
