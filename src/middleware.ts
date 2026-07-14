import { NextRequest, NextResponse } from "next/server";
import {
  authenticatedHomeLocation,
  loginRedirectLocation,
} from "@/lib/authRedirects.mjs";

// K-SNS UI auth cookie — httpOnly JWT set by /api/auth/login (see ADR-0019 §6).
const AUTH_COOKIE = "sns_token";

// Public paths that never require authentication.
const PUBLIC_PATHS = ["/login"];

const CONFIGURED_ORIGIN = process.env.KARIYA_SNS_PUBLIC_ORIGIN;
const ALLOW_LOOPBACK_ORIGIN =
  process.env.KARIYA_SNS_ALLOW_LOOPBACK_ORIGIN === "1";

function trustedRedirect(location: string | null) {
  if (!location) {
    return new NextResponse("K-SNS authentication redirect is unavailable.", {
      status: 503,
    });
  }
  return NextResponse.redirect(location, 307);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (!isPublic && !token) {
    return trustedRedirect(
      loginRedirectLocation(pathname, CONFIGURED_ORIGIN, {
        allowLoopback: ALLOW_LOOPBACK_ORIGIN,
      })
    );
  }

  if (isPublic && token) {
    return trustedRedirect(
      authenticatedHomeLocation(CONFIGURED_ORIGIN, {
        allowLoopback: ALLOW_LOOPBACK_ORIGIN,
      })
    );
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all paths except static assets and API auth routes
  // (API routes perform their own auth handling).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|api/ksns).*)"],
};
