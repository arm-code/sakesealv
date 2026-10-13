import type { BookRepositoryPort, StoragePort } from "@/lib/server/application/ports";
import type { Book } from "@/lib/server/domain/book";
import { buildProgressFileDescriptor, buildProgressLookupTitleCandidates } from "@/lib/server/domain/value-objects/progress-file";
import { apiError, apiOk, type ApiResult } from "@/lib/server/http/api";

interface GetProgressResult {
  data: Buffer;
  metadataFileName: string;
}

export class GetProgressUseCase {
  constructor(
    private readonly bookRepository: BookRepositoryPort,
    private readonly storage: StoragePort,
  ) {}

  async execute(input: { fileName: string }): Promise<ApiResult<GetProgressResult>> {
    let descriptor;
    try {
      const lookupCandidates = buildProgressLookupTitleCandidates(input.fileName);
      let book: Book | undefined;
      for (const candidate of lookupCandidates) {
        book = await this.bookRepository.getByStorageKey(candidate);
        if (book) {
          break;
        }
      }
      descriptor = buildProgressFileDescriptor(book ? book.s3_storage_key : input.fileName);
    } catch (cause) {
      return apiError("Invalid title format. Expected filename with extension.", 400, cause);
    }

    try {
      const data = await this.storage.get(`library/${descriptor.progressKey}`);
      return apiOk({ data, metadataFileName: descriptor.metadataFileName });
    } catch (cause) {
      return apiError("Progress file not found", 404, cause);
    }
  }
}
