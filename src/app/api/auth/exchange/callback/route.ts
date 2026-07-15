import { NextRequest, NextResponse } from "next/server";

import {
  authRuntime,
  configuredRegion,
  hostLocalSessionCookie,
} from "@/server/auth/runtimeComposition.mjs";

function problem(status: number) {
  return NextResponse.json(
    { error: status === 503 ? "K-SNS Cloud authentication is unavailable." : "Authorization failed." },
    { status, headers: { "cache-control": "no-store" } }
  );
}

export function createCallbackHandler(runtime, configuredOrigin) {
  return async function callback(request: NextRequest) {
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
      const result = await runtime.exchange.callback({ region, code, state });
      const target = new URL(result.normalized_return_path, configuredOrigin);
      const response = NextResponse.redirect(target, 303);
      const cookie = hostLocalSessionCookie(
        result.session_handle,
        result.max_age
      );
      response.cookies.set(cookie.name, cookie.value, cookie.options);
      response.headers.set("cache-control", "no-store");
      response.headers.set("referrer-policy", "no-referrer");
      return response;
    } catch (error) {
      return problem(
        error instanceof Error && error.message === "cloud_authority_unavailable"
          ? 503
          : 400
      );
    }
  };
}

export async function GET(request: NextRequest) {
  return createCallbackHandler(
    authRuntime,
    process.env.KARIYA_SNS_PUBLIC_ORIGIN
  )(request);
}
