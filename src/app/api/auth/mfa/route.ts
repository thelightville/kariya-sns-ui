import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "sns_token";
const AUTH_BASE = process.env.KARIYA_CLOUD_AUTH_BASE_URL ?? "";
const IS_PROD = process.env.NODE_ENV === "production";

type AuthResponse = {
  access_token?: string;
  role?: string;
  user?: {
    email?: string;
    role?: string;
    tenant_id?: string;
  };
  detail?: string;
};

function authUrl(path: string) {
  if (!AUTH_BASE) {
    return null;
  }
  const base = AUTH_BASE.endsWith("/") ? AUTH_BASE.slice(0, -1) : AUTH_BASE;
  return `${base}${path}`;
}

function setSessionCookie(response: NextResponse, accessToken: string) {
  response.cookies.set(AUTH_COOKIE, accessToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
}

export async function POST(request: NextRequest) {
  const target = authUrl("/cloud/mfa/verify");
  if (!target) {
    return NextResponse.json(
      { error: "Authentication service is not configured" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const mfaToken = typeof body?.mfa_token === "string" ? body.mfa_token : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!mfaToken || !code) {
    return NextResponse.json(
      { error: "MFA token and code are required" },
      { status: 400 }
    );
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "MFA code must be 6 digits" },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfa_token: mfaToken, code }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "Authentication service is unavailable" },
      { status: 503 }
    );
  }

  const data = (await upstream.json().catch(() => ({}))) as AuthResponse;
  if (!upstream.ok) {
    return NextResponse.json(
      { error: data.detail || "MFA verification failed" },
      { status: upstream.status }
    );
  }
  if (!data.access_token) {
    return NextResponse.json(
      { error: "Authentication service did not return a session" },
      { status: 502 }
    );
  }

  const response = NextResponse.json({
    ok: true,
    role: data.role ?? data.user?.role ?? null,
    user: data.user ?? null,
  });
  setSessionCookie(response, data.access_token);
  return response;
}
