import { NextRequest, NextResponse } from "next/server";

// K-SNS UI auth cookie — httpOnly JWT set by /api/auth/login (see ADR-0019 §6).
const AUTH_COOKIE = "sns_token";

// Public paths that never require authentication.
const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (!isPublic && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublic && token) {
    return NextResponse.redirect(new URL("/overview", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all paths except static assets and API auth routes
  // (API routes perform their own auth handling).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|api/ksns).*)"],
};
