import { NextRequest, NextResponse } from "next/server";

import { safeNextPath } from "@/lib/safeNextPath.mjs";
import {
  authRuntime,
  configuredRegion,
} from "@/server/auth/runtimeComposition.mjs";

function unavailable() {
  return NextResponse.json(
    { error: "K-SNS Cloud authentication is unavailable." },
    { status: 503, headers: { "cache-control": "no-store" } }
  );
}

export function createStartHandler(runtime, configuredOrigin) {
  return async function start(request: NextRequest) {
    let region;
    try {
      region = configuredRegion(configuredOrigin);
    } catch {
      return unavailable();
    }
    const normalized_return_path = safeNextPath(
      request.nextUrl.searchParams.get("next")
    );
    try {
      const result = await runtime.exchange.start({
        region,
        normalized_return_path,
      });
      return NextResponse.redirect(result.authorization_url, 303);
    } catch {
      return unavailable();
    }
  };
}

export async function GET(request: NextRequest) {
  return createStartHandler(
    authRuntime,
    process.env.KARIYA_SNS_PUBLIC_ORIGIN
  )(request);
}
