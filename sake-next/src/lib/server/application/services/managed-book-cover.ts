// Recortado a lo que usa GetLibraryCoverUseCase (Fase 3f) y, desde 3h,
// DeleteTrashedLibraryBookUseCase/PurgeExpiredTrashUseCase
// (deleteManagedBookCoversForStorageKey, puerto de
// ManagedBookCoverService.deleteForBookStorageKey — función suelta, sin la
// clase completa). El resto del original `ManagedBookCoverService.ts` (801
// líneas: descarga/genera portadas gestionadas desde Z-Library/proveedores
// externos, usa fetch + mirrors) pertenece a la mini-fase de gestión de
// portadas (upload/import), fuera de alcance aquí.
import type { StoragePort } from "@/lib/server/application/ports";
import { createChildLogger, toLogError } from "@/lib/server/infrastructure/logging/logger";

const LIBRARY_COVER_STORAGE_PREFIX = "covers/";
const MANAGED_COVER_FILE_NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpg|png|gif|webp|avif)$/i;

export function buildManagedBookCoverStorageKey(fileName: string): string {
  return `${LIBRARY_COVER_STORAGE_PREFIX}${fileName}`;
}

export function isValidManagedBookCoverFileName(fileName: string): boolean {
  return MANAGED_COVER_FILE_NAME_REGEX.test(fileName);
}

export function buildManagedBookCoverPrefix(bookStorageKey: string): string {
  return `${LIBRARY_COVER_STORAGE_PREFIX}${bookStorageKey}.`;
}

const coverServiceLogger = createChildLogger({ service: "ManagedBookCoverService" });

export async function deleteManagedBookCoversForStorageKey(storage: StoragePort, bookStorageKey: string): Promise<void> {
  try {
    const objects = await storage.list(buildManagedBookCoverPrefix(bookStorageKey));
    for (const object of objects) {
      try {
        await storage.delete(object.key);
      } catch (error: unknown) {
        coverServiceLogger.warn(
          { event: "library.cover.delete.failed", bookStorageKey, coverKey: object.key, error: toLogError(error) },
          "Managed cover delete failed, continuing",
        );
      }
    }
  } catch (error: unknown) {
    coverServiceLogger.warn({ event: "library.cover.list.failed", bookStorageKey, error: toLogError(error) }, "Managed cover lookup failed, continuing");
  }
}
