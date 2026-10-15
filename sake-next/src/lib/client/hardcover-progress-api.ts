import { request } from "@/lib/client/api-client";
import type { HardcoverProgressSyncStatus, TriggerHardcoverProgressSyncResponse } from "@/lib/types/integrations";

export const HardcoverProgressApi = {
  getStatus: () => request<HardcoverProgressSyncStatus>("/api/integrations/hardcover/progress"),

  setEnabled: (enabled: boolean) =>
    request<HardcoverProgressSyncStatus>("/api/integrations/hardcover/progress", {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),

  syncNow: () => request<TriggerHardcoverProgressSyncResponse>("/api/integrations/hardcover/progress/sync", { method: "POST" }),
};
