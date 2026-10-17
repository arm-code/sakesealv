import type { DeviceDownloadRepositoryPort } from "@/lib/server/application/ports";
import { apiOk, type ApiResult } from "@/lib/server/http/api";

export class RemoveDeviceDownloadUseCase {
  constructor(private readonly deviceDownloadRepository: DeviceDownloadRepositoryPort) {}

  async execute(input: { bookId: number; deviceId: string }): Promise<ApiResult<{ success: true }>> {
    await this.deviceDownloadRepository.deleteByBookIdAndDeviceId(input.bookId, input.deviceId);
    return apiOk({ success: true });
  }
}
