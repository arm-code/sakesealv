import { request } from "@/lib/client/api-client";

export const ZLibraryAuthApi = {
  passwordLogin: (email: string, password: string) =>
    request<{ success: 1 | 0; user: { name: string } }>("/api/zlibrary/passwordLogin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  tokenLogin: (userId: string, userKey: string) =>
    request<{ success: true }>("/api/zlibrary/login", {
      method: "POST",
      body: JSON.stringify({ userId, userKey }),
    }),

  logout: () => request<{ success: true }>("/api/zlibrary/logout"),
};
