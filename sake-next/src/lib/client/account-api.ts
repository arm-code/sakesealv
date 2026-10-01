import { request } from "@/lib/client/api-client";
import type { AuthApiKey, CurrentUser } from "@/lib/types/auth";

export const AccountApi = {
  getCurrentUser: () => request<{ success: true; user: CurrentUser }>("/api/auth/me"),

  listApiKeys: () => request<{ success: true; apiKeys: AuthApiKey[] }>("/api/auth/api-keys"),

  revokeApiKey: (id: number) => request<void>(`/api/auth/api-keys/${id}`, { method: "DELETE" }),

  logout: () => request<{ success: true }>("/api/auth/logout", { method: "POST" }),

  logoutAll: () => request<{ success: true }>("/api/auth/logout-all", { method: "POST" }),

  setBasicAuthPassword: (password: string) =>
    request<{ success: true; hasBasicAuthPassword: true }>("/api/auth/basic-password", {
      method: "PUT",
      body: JSON.stringify({ password }),
    }),

  removeBasicAuthPassword: () =>
    request<{ success: true; hasBasicAuthPassword: false }>("/api/auth/basic-password", { method: "DELETE" }),
};
