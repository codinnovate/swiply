import type { ApiEnvelope, ApiFailure } from "@/lib/types";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) { super(message); }
}

export async function api<T>(path: string, init: RequestInit = {}, workspaceId?: string | null): Promise<T> {
  const response = await fetch(`/api/backend${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(workspaceId ? { "X-Workspace-Id": workspaceId } : {}), ...init.headers },
  });
  if (!response.ok) {
    const failure = (await response.json().catch(() => null)) as ApiFailure | null;
    throw new ApiError(failure?.error.code ?? "REQUEST_FAILED", failure?.error.message ?? "Something went wrong", response.status, failure?.error.details);
  }
  if (response.status === 204) return undefined as T;
  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}

export const json = (value: unknown): RequestInit => ({ body: JSON.stringify(value) });
