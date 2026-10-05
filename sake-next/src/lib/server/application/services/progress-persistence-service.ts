import type { BookProgressHistoryRepositoryPort, BookRepositoryPort, DeviceProgressDownloadRepositoryPort, StoragePort } from "@/lib/server/application/ports";
import type { Book } from "@/lib/server/domain/book";
import { apiOk, type ApiResult } from "@/lib/server/http/api";
import { createChildLogger } from "@/lib/server/infrastructure/logging/logger";

export interface PersistProgressInput {
  book: Book;
  progressKey: string;
  fileData: Buffer;
  percentFinished: number;
  deviceId?: string;
  readerSessionId?: string;
}

export interface PersistProgressResult {
  progressKey: string;
}

function isMissingProgressHistoryTableError(cause: unknown): boolean {
  if (!(cause instanceof Error)) {
    return false;
  }

  const message = cause.message.toLowerCase();
  return message.includes("bookprogresshistory") && message.includes("no such table");
}

// Puerto reducido respecto al original: sin HardcoverProgressSyncPort
// (Hardcover sigue bloqueado, ver Fase 3d/3f) ni AnnotationIndexService
// (annotations todavía no existe en sake-next). Cuando se porten, se
// reintroducen como parámetros opcionales igual que en el original.
export class ProgressPersistenceService {
  private readonly serviceLogger = createChildLogger({ service: "ProgressPersistenceService" });

  constructor(
    private readonly bookRepository: BookRepositoryPort,
    private readonly bookProgressHistoryRepository: BookProgressHistoryRepositoryPort,
    private readonly storage: StoragePort,
    private readonly deviceProgressDownloadRepository: DeviceProgressDownloadRepositoryPort,
  ) {}

  async persist(input: PersistProgressInput): Promise<ApiResult<PersistProgressResult>> {
    const uploadKey = `library/${input.progressKey}`;
    await this.storage.put(uploadKey, input.fileData, "application/x-lua");
    const normalizedPercent = Number.isFinite(input.percentFinished) ? Math.max(0, Math.min(1, input.percentFinished)) : 0;
    const previousPercent = typeof input.book.progress_percent === "number" ? input.book.progress_percent : null;

    await this.bookRepository.updateProgress(input.book.id, input.progressKey, normalizedPercent);
    const needsUpdatedBook = Boolean(input.deviceId && input.deviceId.trim() !== "");
    const updatedBook = needsUpdatedBook ? await this.bookRepository.getById(input.book.id) : undefined;

    if (input.readerSessionId) {
      try {
        await this.bookProgressHistoryRepository.upsertReaderSessionSnapshot({
          bookId: input.book.id,
          progressPercent: normalizedPercent,
          readerSessionId: input.readerSessionId,
        });
      } catch (cause: unknown) {
        if (isMissingProgressHistoryTableError(cause)) {
          this.serviceLogger.warn(
            { event: "progress.history.migration_missing", bookId: input.book.id },
            "Progress history table not available yet; skipping history snapshot",
          );
        } else {
          throw cause;
        }
      }
    } else if (previousPercent === null || normalizedPercent > previousPercent) {
      try {
        await this.bookProgressHistoryRepository.appendSnapshot({ bookId: input.book.id, progressPercent: normalizedPercent });
      } catch (cause: unknown) {
        if (isMissingProgressHistoryTableError(cause)) {
          this.serviceLogger.warn(
            { event: "progress.history.migration_missing", bookId: input.book.id },
            "Progress history table not available yet; skipping history snapshot",
          );
        } else {
          throw cause;
        }
      }
    } else {
      this.serviceLogger.info(
        { event: "progress.history.skipped.no_increase", bookId: input.book.id, previousPercent, newPercent: normalizedPercent },
        "Skipped progress history snapshot because progress did not increase",
      );
    }

    this.serviceLogger.info(
      { event: "progress.uploaded", bookId: input.book.id, progressKey: input.progressKey, deviceId: input.deviceId ?? null, percentFinished: normalizedPercent },
      "Progress uploaded and book updated",
    );

    if (input.deviceId && input.deviceId.trim() !== "" && updatedBook?.progress_updated_at) {
      await this.deviceProgressDownloadRepository.upsertByDeviceAndBook({
        deviceId: input.deviceId.trim(),
        bookId: input.book.id,
        progressUpdatedAt: updatedBook.progress_updated_at,
      });
      this.serviceLogger.info(
        { event: "progress.device.confirmed", bookId: input.book.id, deviceId: input.deviceId.trim(), progressUpdatedAt: updatedBook.progress_updated_at },
        "Device progress download marker updated",
      );
    }

    return apiOk({ progressKey: input.progressKey });
  }
}
