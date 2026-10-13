import type { BookRepositoryPort } from "@/lib/server/application/ports";
import type { Book } from "@/lib/server/domain/book";
import { apiOk, type ApiResult } from "@/lib/server/http/api";

export class GetNewProgressForDeviceUseCase {
  constructor(private readonly bookRepository: BookRepositoryPort) {}

  async execute(deviceId: string): Promise<ApiResult<Book[]>> {
    return apiOk(await this.bookRepository.getBooksWithNewProgressForDevice(deviceId));
  }
}
