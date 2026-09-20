import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, SESSION_COOKIE } from "@/lib/server-api";
import type { ApiEnvelope, AuthResult } from "@/lib/types";
export async function POST(request: NextRequest) { const response = await fetch(`${BACKEND_URL}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: await request.text(), cache: "no-store" }); const body = await response.json(); if (!response.ok) return NextResponse.json(body, { status: response.status }); const result=(body as ApiEnvelope<AuthResult>).data; const next=NextResponse.json({data:result.user}); next.cookies.set(SESSION_COOKIE,result.accessToken,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:7*24*60*60}); return next; }
