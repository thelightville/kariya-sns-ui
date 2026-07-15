import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  authRuntime,
  clearedHostLocalSessionCookie,
  configuredRegion,
} from "@/server/auth/runtimeComposition.mjs";

function clearCookie(response: NextResponse) {
  const cookie = clearedHostLocalSessionCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}

export async function POST(request: NextRequest) {
  const handle = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!handle) return clearCookie(NextResponse.json({ ok: true }));

  try {
    const region = configuredRegion(process.env.KARIYA_SNS_PUBLIC_ORIGIN);
    await authRuntime.sessions.logout(handle, region);
    return clearCookie(NextResponse.json({ ok: true }));
  } catch {
    return clearCookie(
      NextResponse.json(
        { error: "K-SNS session authority is unavailable." },
        {
          status: 503,
          headers: {
            "cache-control": "no-store",
            "referrer-policy": "no-referrer",
          },
        }
      )
    );
  }
}
