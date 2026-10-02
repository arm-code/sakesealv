import { request } from "@/lib/client/api-client";
import type { AppVersionResponse } from "@/lib/types/app-version";

export const AppVersionApi = {
  get: () => request<AppVersionResponse>("/api/app/version"),
};
