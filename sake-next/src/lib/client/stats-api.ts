import { request } from "@/lib/client/api-client";
import type { ReadingActivityStats } from "@/lib/types/stats";

export const StatsApi = {
  readingActivity: (days = 365) => request<ReadingActivityStats>(`/api/stats/reading-activity?days=${days}`),
};
