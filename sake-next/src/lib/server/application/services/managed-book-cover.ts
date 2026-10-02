// Recortado a lo que usa GetLibraryCoverUseCase (Fase 3f). El resto del
// original `ManagedBookCoverService.ts` (801 líneas: descarga/genera
// portadas gestionadas desde Z-Library/proveedores externos) pertenece a la
// mini-fase de gestión de portadas (upload/import), fuera de alcance aquí.
const LIBRARY_COVER_STORAGE_PREFIX = "covers/";
const MANAGED_COVER_FILE_NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpg|png|gif|webp|avif)$/i;

export function buildManagedBookCoverStorageKey(fileName: string): string {
  return `${LIBRARY_COVER_STORAGE_PREFIX}${fileName}`;
}

export function isValidManagedBookCoverFileName(fileName: string): boolean {
  return MANAGED_COVER_FILE_NAME_REGEX.test(fileName);
}
