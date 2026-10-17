import { request } from "@/lib/client/api-client";

export interface AuthStatus {
  success: true;
  hasAccount: boolean;
  needsBootstrap: boolean;
  registrationOpen: boolean;
}

export const AuthApi = {
  status: () => request<AuthStatus>("/api/auth/status"),

  login: (input: { username: string; password: string }) =>
    request<{ success: true }>("/api/auth/login", { method: "POST", body: JSON.stringify(input) }),

  bootstrap: (input: { username: string; password: string }) =>
    request<{ success: true }>("/api/auth/bootstrap", { method: "POST", body: JSON.stringify(input) }),
};
