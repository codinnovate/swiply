import "server-only";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "swiply_session";
export const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:3000/api").replace(/\/$/, "");

export async function serverApi(path: string, init: RequestInit = {}) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return fetch(`${BACKEND_URL}${path}`, { ...init, headers: { ...init.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, cache: "no-store" });
}
