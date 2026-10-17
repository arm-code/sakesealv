import type { BookRepositoryPort, DeviceProgressDownloadRepositoryPort } from "@/lib/server/application/ports";
import type { DeviceProgressDownload } from "@/lib/server/domain/device";
import { apiError, apiOk, type ApiResult } from "@/lib/server/http/api";

export class ConfirmProgressDownloadUseCase {
  constructor(
    private readonly bookRepository: BookRepositoryPort,
    private readonly deviceProgressDownloadRepository: DeviceProgressDownloadRepositoryPort,
  ) {}

  async execute(input: { deviceId: string; bookId: number }): Promise<ApiResult<DeviceProgressDownload>> {
    const book = await this.bookRepository.getById(input.bookId);
    if (!book) {
      return apiError("Book not found", 404);
    }
    if (!book.progress_updated_at) {
      return apiError("Book has no progress update to confirm", 409);
    }

    const record = await this.deviceProgressDownloadRepository.upsertByDeviceAndBook({
      deviceId: input.deviceId,
      bookId: input.bookId,
      progressUpdatedAt: book.progress_updated_at,
    });

    return apiOk(record);
  }
}
