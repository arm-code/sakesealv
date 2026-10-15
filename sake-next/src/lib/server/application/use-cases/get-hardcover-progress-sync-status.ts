import type { HardcoverProgressSyncStatus } from "@/lib/types/integrations";
import { apiOk, type ApiResult } from "@/lib/server/http/api";
import { HardcoverProgressSettingsRepository } from "@/lib/server/infrastructure/repositories/hardcover-progress-settings-repository";
import { HardcoverProgressSyncJobRepository } from "@/lib/server/infrastructure/repositories/hardcover-progress-sync-job-repository";

function isDemoMode(): boolean {
  return /^(1|true|yes|on)$/i.test(process.env.SAKE_DEMO_MODE?.trim() ?? "");
}

export class GetHardcoverProgressSyncStatusUseCase {
  constructor(
    private readonly settings: HardcoverProgressSettingsRepository,
    private readonly jobs: HardcoverProgressSyncJobRepository,
    private readonly tokenConfigured: boolean
  ) {}

  async execute(): Promise<ApiResult<HardcoverProgressSyncStatus>> {
    const [stored, counts] = await Promise.all([this.settings.get(), this.jobs.counts()]);
    const demoMode = isDemoMode();
    return apiOk({
      tokenConfigured: this.tokenConfigured,
      enabled: stored?.enabled ?? false,
      available: this.tokenConfigured && !demoMode,
      demoMode,
      lastSuccessfulSyncAt: stored?.lastSuccessfulSyncAt ?? null,
      counts
    });
  }
}
