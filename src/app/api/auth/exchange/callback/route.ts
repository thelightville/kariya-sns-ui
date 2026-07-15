import { NextRequest, NextResponse } from "next/server";

import {
  authRuntime,
  configuredRegion,
  hostLocalSessionCookie,
} from "@/server/auth/runtimeComposition.mjs";

function problem(status: number) {
  return NextResponse.json(
    {
      error:
        status === 503
          ? "K-SNS Cloud authentication is unavailable."
          : "Authorization failed.",
    },
    { status, headers: { "cache-control": "no-store" } }
  );
}

export async function GET(request: NextRequest) {
  const configuredOrigin = process.env.KARIYA_SNS_PUBLIC_ORIGIN;
  if (!configuredOrigin) return problem(503);

  let region;
  try {
    region = configuredRegion(configuredOrigin);
  } catch {
    return problem(503);
  }

  const keys = [...request.nextUrl.searchParams.keys()].sort();
  if (keys.join(",") !== "code,state") return problem(400);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state) return problem(400);

  try {
    const result = await authRuntime.exchange.callback({ region, code, state });
    const response = NextResponse.redirect(
      new URL(result.normalized_return_path, configuredOrigin),
      303
    );
    const cookie = hostLocalSessionCookie(
      result.session_handle,
      result.max_age
    );
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    response.headers.set("cache-control", "no-store");
    response.headers.set("referrer-policy", "no-referrer");
    return response;
  } catch {
    return problem(400);
  }
}
