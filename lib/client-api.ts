export class ApiClientError extends Error {
  constructor(message: string, public code?: string, public duplicate?: { id: string; name: string; pipelineId: string; stageId: string; createdBy: string | null }) { super(message); }
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, { ...init, cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (response.status === 401 && typeof window !== "undefined" && !String(input).includes("/api/auth/login")) window.dispatchEvent(new Event("crm:session-expired"));
    throw new ApiClientError(body?.error || "Could not reach the server. Please try again.", body?.code, body?.duplicate);
  }
  return response;
}
