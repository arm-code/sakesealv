import type { BookRepositoryPort } from "@/lib/server/application/ports";
import { apiOk, type ApiResult } from "@/lib/server/http/api";

export class ResetDownloadStatusUseCase {
  constructor(private readonly bookRepository: BookRepositoryPort) {}

  async execute(bookId: number): Promise<ApiResult<{ success: true }>> {
    await this.bookRepository.resetDownloadStatus(bookId);
    return apiOk({ success: true });
  }
}
