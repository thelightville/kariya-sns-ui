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

export async function GET(request: NextRequest) {
  const configuredOrigin = process.env.KARIYA_SNS_PUBLIC_ORIGIN;
  let region;
  try {
    region = configuredRegion(configuredOrigin);
  } catch {
    return unavailable();
  }

  try {
    const result = await authRuntime.exchange.start({
      region,
      normalized_return_path: safeNextPath(
        request.nextUrl.searchParams.get("next")
      ),
    });
    return NextResponse.redirect(result.authorization_url, 303);
  } catch {
    return unavailable();
  }
}
