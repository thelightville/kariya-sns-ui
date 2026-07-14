import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "sns_token";
const API_BASE = process.env.K_SNS_BASE_URL ?? "";
const TENANT_ID = process.env.K_SNS_TENANT_ID ?? "";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function buildTargetUrl(request: NextRequest, path: string[]) {
  if (!API_BASE) {
    return null;
  }

  const base = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  const suffix = path.map(encodeURIComponent).join("/");
  const target = new URL(`${base}/${suffix}`);

  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });

  return target;
}

function buildHeaders(request: NextRequest, token: string) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lower) && lower !== "cookie") {
      headers.set(key, value);
    }
  });

  headers.set("Authorization", `Bearer ${token}`);
  if (TENANT_ID && !headers.has("X-Tenant-ID")) {
    headers.set("X-Tenant-ID", TENANT_ID);
  }

  return headers;
}

async function proxy(request: NextRequest, context: RouteContext) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return jsonError("Unauthorized: sign in to K-SNS and try again.", 401);
  }

  const { path = [] } = await context.params;
  const target = buildTargetUrl(request, path);
  if (!target) {
    return jsonError("K-SNS backend is not configured.", 503);
  }

  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const headers = buildHeaders(request, token);

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

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) {
    responseHeaders.set("content-type", contentType);
  }
  responseHeaders.set("cache-control", "no-store");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
