import type { BookRepositoryPort, StoragePort } from "@/lib/server/application/ports";
import { deleteManagedBookCoversForStorageKey } from "@/lib/server/application/services/managed-book-cover";
import { apiOk, type ApiResult } from "@/lib/server/http/api";

interface PurgeExpiredTrashResult {
  success: true;
  purgedBookIds: number[];
}

// Sin ruta HTTP ni cron todavía: en el original se dispara desde
// hooks.server.ts en cada request si ya pasó el intervalo de purga — el
// mismo hueco de arquitectura de "cómo arrancan jobs de fondo en el
// self-hosted de Next.js" que el sync del plugin (Fase 3c) y Hardcover,
// sigue sin resolver. Se deja wireado en composition.ts, listo para
// invocarse manualmente (o desde el mecanismo que se decida) cuando se
// retome esa decisión.
export class PurgeExpiredTrashUseCase {
  constructor(
    private readonly bookRepository: BookRepositoryPort,
    private readonly storage: StoragePort,
  ) {}

  async execute(nowIso = new Date().toISOString()): Promise<ApiResult<PurgeExpiredTrashResult>> {
    const expiredBooks = await this.bookRepository.getExpiredTrash(nowIso);
    const externallyReferencedStorageKeys = new Set(
      await this.bookRepository.listStorageKeysWithExternalReferences(
        expiredBooks.map((book) => book.s3_storage_key),
        expiredBooks.map((book) => book.id),
      ),
    );
    const cleanedStorageKeys = new Set<string>();
    const purgedBookIds: number[] = [];

    for (const book of expiredBooks) {
      const shouldCleanStorage = !externallyReferencedStorageKeys.has(book.s3_storage_key) && !cleanedStorageKeys.has(book.s3_storage_key);
      if (shouldCleanStorage) {
        try {
          await this.storage.delete(`library/${book.s3_storage_key}`);
        } catch {
          // Ignore missing file/object during purge.
        }

        if (book.progress_storage_key) {
          try {
            await this.storage.delete(`library/${book.progress_storage_key}`);
          } catch {
            // Ignore missing progress object during purge.
          }
        }

        await deleteManagedBookCoversForStorageKey(this.storage, book.s3_storage_key);
        cleanedStorageKeys.add(book.s3_storage_key);
      }

      await this.bookRepository.delete(book.id);
      purgedBookIds.push(book.id);
    }

    return apiOk({ success: true, purgedBookIds });
  }
}
