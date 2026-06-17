import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@kph/db/supabase/proxy";

// Routes that bypass the session cookie check.
// API routes use their own auth mechanisms (Bearer token, CRON_SECRET, HMAC).
const PUBLIC_PREFIXES = [
  "/login",
  "/api/",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // updateSession() validates the JWT against Supabase Auth and refreshes
  // the token pair if the access token is expired. This is the ONLY place
  // in the Next.js request cycle that can write Set-Cookie headers for
  // token refresh — Server Components cannot write cookies.
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
    // Skip Next.js internals, static files, and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
