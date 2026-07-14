import { NextRequest, NextResponse } from "next/server";
import {
  AUTHENTICATED_HOME_PATH,
  loginRedirectLocation,
} from "@/lib/authRedirects.mjs";

// K-SNS UI auth cookie — httpOnly JWT set by /api/auth/login (see ADR-0019 §6).
const AUTH_COOKIE = "sns_token";

// Public paths that never require authentication.
const PUBLIC_PATHS = ["/login"];

function relativeRedirect(location: string) {
  return new NextResponse(null, {
    status: 307,
    headers: { Location: location },
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (!isPublic && !token) {
    return relativeRedirect(loginRedirectLocation(pathname));
  }

  if (isPublic && token) {
    return relativeRedirect(AUTHENTICATED_HOME_PATH);
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all paths except static assets and API auth routes
  // (API routes perform their own auth handling).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|api/ksns).*)"],
};
