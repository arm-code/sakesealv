import type { DownloadQueuePort } from "@/lib/server/application/ports";
import { apiOk, type ApiResult } from "@/lib/server/http/api";
import type { QueueJob, QueueStatusResponse } from "@/lib/types/queue-status";

const MAX_RECENT_JOBS = 300;

// Solo la cola de descargas: el original mezcla además los jobs de sync de
// progreso de Hardcover (`HardcoverProgressQueuePort`), que sigue sin portar.
export class GetQueueStatusUseCase {
  constructor(private readonly downloadQueue: DownloadQueuePort) {}

  async execute(): Promise<ApiResult<QueueStatusResponse>> {
    const [downloadStatus, downloadJobs] = await Promise.all([this.downloadQueue.getStatus(), this.downloadQueue.getTasks()]);
    const jobs: QueueJob[] = downloadJobs
      .map((job): QueueJob => ({ ...job, id: `download:${job.id}`, type: "book-download" }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, MAX_RECENT_JOBS);

    return apiOk({ success: true, queueStatus: downloadStatus, jobs });
  }
}
