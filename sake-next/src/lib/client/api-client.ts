import { applyAuthResponseSignals } from "@/lib/client/apply-auth-response-signals";

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    applyAuthResponseSignals(response);
    throw new Error(data.error ?? "Request failed");
  }
  return data;
}

export function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
