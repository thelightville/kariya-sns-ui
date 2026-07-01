import { NextRequest, NextResponse } from "next/server";

// Alpha 1 stub — always "succeeds" so the SOC shell can be exercised without
// a live K-SNS auth endpoint. Real auth will POST credentials to the K-SNS
// C-009 auth endpoint (`POST /api/v1/auth/token`, per ADR-0019 §6) and set
// `sns_token` to the JWT returned there instead of this placeholder value.
const AUTH_COOKIE = "sns_token";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    );
  }

  // TODO(Alpha 2): replace with a real call to the K-SNS auth endpoint and
  // store the returned JWT verbatim instead of this placeholder token.
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, "alpha1-stub-session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return response;
}
