import type { WebappLogFeedPort, WebappLogObservation } from "@/lib/server/application/ports";
import { apiOk, type ApiResult } from "@/lib/server/http/api";

export class ObserveWebappLogsUseCase {
  constructor(private readonly webappLogFeed: WebappLogFeedPort) {}

  async execute(): Promise<ApiResult<WebappLogObservation>> {
    return apiOk(this.webappLogFeed.observe());
  }
}
