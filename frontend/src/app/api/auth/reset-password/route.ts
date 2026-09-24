import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/server-api";

export async function POST(request: NextRequest) {
  const response = await fetch(`${BACKEND_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
    cache: "no-store",
  });
  return NextResponse.json(await response.json(), { status: response.status });
}
