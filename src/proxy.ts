import { NextRequest, NextResponse } from "next/server";
import {
  authenticatedHomeLocation,
  loginRedirectLocation,
} from "@/lib/authRedirects.mjs";
import {
  AUTH_COOKIE_NAME,
  authRuntime,
  configuredRegion,
} from "@/server/auth/runtimeComposition.mjs";

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

function loginRedirect(pathname: string) {
  return trustedRedirect(
    loginRedirectLocation(pathname, CONFIGURED_ORIGIN, {
      allowLoopback: ALLOW_LOOPBACK_ORIGIN,
    })
  );
}

async function activeSession(token: string | undefined) {
  if (!token) return false;
  try {
    const region = configuredRegion(CONFIGURED_ORIGIN);
    await authRuntime.sessions.authorize(token, region);
    return true;
  } catch {
    return false;
  }
}

async function authorizeRequest(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isActive = await activeSession(token);

  if (!isPublic && !isActive) return loginRedirect(pathname);

  if (isPublic && isActive) {
    return trustedRedirect(
      authenticatedHomeLocation(CONFIGURED_ORIGIN, {
        allowLoopback: ALLOW_LOOPBACK_ORIGIN,
      })
    );
  }

  return NextResponse.next();
}

export function proxy(request: NextRequest) {
  return authorizeRequest(request);
}

export const config = {
  // API auth and BFF routes perform the same fresh Cloud authority check at
  // their own server boundary; static assets never see session material.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|api/ksns).*)"],
};
