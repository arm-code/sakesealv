import { request } from "@/lib/client/api-client";
import type { QueueStatusResponse } from "@/lib/types/queue-status";

export const QueueApi = {
  status: () => request<QueueStatusResponse>("/api/queue"),
};
