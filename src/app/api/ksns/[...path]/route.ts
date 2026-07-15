import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  buildBffContext,
  stripInboundAuthorityHeaders,
  validateBffContext,
} from "@/server/backend/bffContext.mjs";
import {
  AUTH_COOKIE_NAME,
  authRuntime,
  configuredRegion,
} from "@/server/auth/runtimeComposition.mjs";

const API_BASE = process.env.K_SNS_BASE_URL ?? "";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "cache-control": "no-store" } }
  );
}

function buildTargetUrl(path: string[]) {
  if (!API_BASE) return null;
  const base = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  const suffix = path.map(encodeURIComponent).join("/");
  const target = new URL(`${base}/${suffix}`);
  return ["http:", "https:"].includes(target.protocol) ? target : null;
}

async function proxyToKsns(request: NextRequest, context: RouteContext) {
  const handle = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!handle) return jsonError("Unauthorized.", 401);

  let authority;
  let region;
  try {
    region = configuredRegion(process.env.KARIYA_SNS_PUBLIC_ORIGIN);
    authority = await authRuntime.sessions.authorize(handle, region);
  } catch {
    return jsonError("K-SNS session authority is unavailable.", 503);
  }

  const { path = [] } = await context.params;
  const target = buildTargetUrl(path);
  if (!target) return jsonError("K-SNS backend is unavailable.", 503);

  const requestId = randomBytes(32).toString("base64url");
  const contextHeaders = validateBffContext(
    buildBffContext(authority, region, requestId)
  );
  const headers = stripInboundAuthorityHeaders(request.headers);
  for (const [name, value] of Object.entries(contextHeaders)) {
    headers.set(name, value);
  }

  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
    });
  } catch {
    return jsonError("K-SNS backend is unavailable.", 502);
  }

  const responseHeaders = new Headers({ "cache-control": "no-store" });
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);
  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyToKsns(request, context);
}
export async function POST(request: NextRequest, context: RouteContext) {
  return proxyToKsns(request, context);
}
export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyToKsns(request, context);
}
export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyToKsns(request, context);
}
export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyToKsns(request, context);
}
