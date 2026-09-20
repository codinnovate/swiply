import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/server-api";
export async function POST(){const response=NextResponse.json({data:{success:true}});response.cookies.set(SESSION_COOKIE,"",{httpOnly:true,path:"/",maxAge:0});return response;}
