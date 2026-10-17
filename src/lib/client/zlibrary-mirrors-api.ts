import { request } from "@/lib/client/api-client";

export const ZLibraryMirrorsApi = {
  get: () => request<{ urls: string[] }>("/api/integrations/zlibrary/mirrors"),

  replace: (urls: string[]) =>
    request<{ urls: string[] }>("/api/integrations/zlibrary/mirrors", {
      method: "PUT",
      body: JSON.stringify({ urls }),
    }),
};
