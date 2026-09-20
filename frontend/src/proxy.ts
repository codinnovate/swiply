import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/server-api";
export function proxy(request:NextRequest){const authenticated=Boolean(request.cookies.get(SESSION_COOKIE)?.value);if(request.nextUrl.pathname.startsWith("/app")&&!authenticated)return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname)}`,request.url));if((request.nextUrl.pathname==="/login"||request.nextUrl.pathname==="/register")&&authenticated)return NextResponse.redirect(new URL("/app",request.url));return NextResponse.next();}
export const config={matcher:["/app/:path*","/login","/register"]};
