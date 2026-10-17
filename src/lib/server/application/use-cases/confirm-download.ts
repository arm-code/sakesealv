import type { DeviceDownloadRepositoryPort } from "@/lib/server/application/ports";
import type { DeviceDownload } from "@/lib/server/domain/device";
import { apiOk, type ApiResult } from "@/lib/server/http/api";

export class ConfirmDownloadUseCase {
  constructor(private readonly deviceDownloadRepository: DeviceDownloadRepositoryPort) {}

  async execute(input: { deviceId: string; bookId: number }): Promise<ApiResult<DeviceDownload>> {
    return apiOk(await this.deviceDownloadRepository.create({ deviceId: input.deviceId, bookId: input.bookId }));
  }
}
