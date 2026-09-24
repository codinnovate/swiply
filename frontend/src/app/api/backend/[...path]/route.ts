import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, SESSION_COOKIE } from "@/lib/server-api";

const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

async function handler(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!methods.has(request.method)) return new NextResponse(null, { status: 405 });
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).origin;
    if (origin && origin !== appOrigin) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Invalid request origin" } },
        { status: 403 },
      );
    }
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sign in to continue" } },
      { status: 401 },
    );
  }
  const { path } = await context.params;
  const target = new URL(`${BACKEND_URL}/${path.join("/")}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const workspace = request.headers.get("x-workspace-id");
  if (workspace) headers["X-Workspace-Id"] = workspace;
  const contentType = request.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "The API is not reachable. Wait a moment and try again.",
        },
      },
      { status: 503 },
    );
  }
  const emptyBody = [204, 205, 304].includes(upstream.status);
  const payload = emptyBody ? null : await upstream.arrayBuffer();
  const contentTypeHeader = upstream.headers.get("content-type");
  const responseHeaders =
    contentTypeHeader && !emptyBody ? { "Content-Type": contentTypeHeader } : undefined;
  if (upstream.status === 401) {
    const response = new NextResponse(payload, { status: 401, headers: responseHeaders });
    response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }
  return new NextResponse(payload, { status: upstream.status, headers: responseHeaders });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
