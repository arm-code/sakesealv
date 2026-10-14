import type { DeviceLogFeedPort, DeviceLogObservation, DeviceRepositoryPort } from "@/lib/server/application/ports";
import { apiError, apiOk, type ApiResult } from "@/lib/server/http/api";

export class ObserveDeviceLogsUseCase {
  constructor(
    private readonly deviceRepository: DeviceRepositoryPort,
    private readonly deviceLogFeed: DeviceLogFeedPort,
  ) {}

  async execute(input: { userId: number; deviceId: string }): Promise<ApiResult<DeviceLogObservation>> {
    const deviceId = input.deviceId.trim();
    if (!deviceId) {
      return apiError("deviceId is required", 400);
    }

    const device = await this.deviceRepository.getByUserIdAndDeviceId(input.userId, deviceId);
    if (!device) {
      return apiError(`Device "${deviceId}" was not found`, 404);
    }

    return apiOk(this.deviceLogFeed.observe(deviceId));
  }
}
