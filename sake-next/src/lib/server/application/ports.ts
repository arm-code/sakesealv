import type { LibraryShelf, RuleGroup } from "@/lib/types/library";
import type {
  CreateUserAccountInput,
  CreateUserApiKeyInput,
  CreateUserSessionInput,
  UserAccount,
  UserApiKey,
  UserSession,
} from "@/lib/server/domain/auth";
import type { Book, UpdateBookMetadataInput } from "@/lib/server/domain/book";
import type { BookProgressHistory } from "@/lib/server/domain/book-progress-history";
import type { Device } from "@/lib/server/domain/device";
import type { PluginRelease, UpsertPluginReleaseInput } from "@/lib/server/domain/plugin-release";
import type { MetadataProviderId } from "@/lib/types/metadata-provider";
import type { ApiResult } from "@/lib/server/http/api";

export interface UserRepositoryPort {
  count(): Promise<number>;
  getById(id: number): Promise<UserAccount | undefined>;
  getByUsername(username: string): Promise<UserAccount | undefined>;
  create(input: CreateUserAccountInput): Promise<UserAccount>;
  setBasicAuthPasswordHash(userId: number, passwordHash: string | null, updatedAt: string): Promise<void>;
  touchLastLogin(id: number, at: string): Promise<void>;
}

export interface UserSessionRepositoryPort {
  create(input: CreateUserSessionInput): Promise<UserSession>;
  getActiveByTokenHash(tokenHash: string, nowIso: string): Promise<UserSession | undefined>;
  touchLastUsed(id: number, at: string): Promise<void>;
  revokeByTokenHash(tokenHash: string, revokedAt: string): Promise<void>;
  revokeAllActiveByUserId(userId: number, revokedAt: string): Promise<void>;
}

export interface UserApiKeyRepositoryPort {
  create(input: CreateUserApiKeyInput): Promise<UserApiKey>;
  getActiveByKeyHash(keyHash: string, nowIso: string): Promise<UserApiKey | undefined>;
  listActiveByUserId(userId: number): Promise<UserApiKey[]>;
  revokeActiveByDeviceId(userId: number, deviceId: string, revokedAt: string): Promise<void>;
  revokeById(userId: number, id: number, revokedAt: string): Promise<boolean>;
  touchLastUsed(id: number, at: string): Promise<void>;
}

export interface ShelfRepositoryPort {
  list(): Promise<LibraryShelf[]>;
  listByIds(ids: number[]): Promise<LibraryShelf[]>;
  getById(id: number): Promise<LibraryShelf | undefined>;
  create(input: { name: string; icon: string; ruleGroup: RuleGroup }): Promise<LibraryShelf>;
  update(id: number, input: { name: string; icon: string; ruleGroup: RuleGroup }): Promise<LibraryShelf | undefined>;
  reorder(shelfIds: number[]): Promise<void>;
  delete(id: number): Promise<void>;
  getBookShelfIds(bookId: number): Promise<number[]>;
  getBookShelfIdsForBooks(bookIds: number[]): Promise<Record<number, number[]>>;
  setBookShelfIds(bookId: number, shelfIds: number[]): Promise<void>;
}

// Recortado a lo que usan ListLibraryUseCase/GetLibraryBookDetailUseCase/
// GetLibraryBookContentUseCase/SetBookShelvesUseCase (Fase 3f — núcleo),
// ProgressBookResolver/GetProgressUseCase/UpdateBookRatingUseCase/
// ListLibraryRatingsUseCase/UpdateLibraryBookStateUseCase (Fase 3g), los 4
// use-cases de papelera + PurgeExpiredTrashUseCase (Fase 3h), y desde 3i
// Upload/ImportLibraryBookCoverUseCase (updateMetadata). El resto del
// original (getAllForStats, getByZLibId*, getByStorageKeyIncludingTrashed,
// getByTitle*, create, updateHardcoverId, resetDownloadStatus,
// touchProgressUpdatedAt, getNotDownloadedByDevice,
// getBooksWithNewProgressForDevice, count) pertenece a mini-fases futuras
// (adquisición, dispositivos, estadísticas).
export interface BookRepositoryPort {
  getAll(): Promise<Book[]>;
  getById(id: number): Promise<Book | undefined>;
  getByIdIncludingTrashed(id: number): Promise<Book | undefined>;
  getByStorageKey(storageKey: string): Promise<Book | undefined>;
  hasOtherBookWithStorageKey(storageKey: string, excludeBookId: number): Promise<boolean>;
  listStorageKeysWithExternalReferences(storageKeys: string[], excludeBookIds: number[]): Promise<string[]>;
  updateMetadata(id: number, metadata: UpdateBookMetadataInput): Promise<Book>;
  updateProgress(bookId: number, progressKey: string, progressPercent: number | null, progressUpdatedAt?: string | null): Promise<void>;
  updateRating(bookId: number, rating: number | null): Promise<void>;
  updateState(
    bookId: number,
    state: {
      readAt?: string | null;
      archivedAt?: string | null;
      progressPercent?: number | null;
      progressBeforeRead?: number | null;
      excludeFromNewBooks?: boolean;
    },
  ): Promise<void>;
  getTrashed(): Promise<Book[]>;
  moveToTrash(id: number, deletedAt: string, trashExpiresAt: string): Promise<void>;
  restoreFromTrash(id: number): Promise<void>;
  getExpiredTrash(nowIso: string): Promise<Book[]>;
  delete(id: number): Promise<void>;
}

export interface CreateBookProgressHistorySnapshot {
  bookId: number;
  progressPercent: number;
}

export interface BookProgressHistoryRepositoryPort {
  appendSnapshot(input: CreateBookProgressHistorySnapshot): Promise<BookProgressHistory>;
  upsertReaderSessionSnapshot(input: CreateBookProgressHistorySnapshot & { readerSessionId: string }): Promise<BookProgressHistory>;
  getByBookId(bookId: number): Promise<BookProgressHistory[]>;
}

// Recortado a lo que usan ListDevicesUseCase/DeleteDeviceUseCase. `upsert` y
// `getByDeviceId` son del flujo de pairing del plugin KOReader
// (CreateDeviceApiKeyUseCase) — fuera de alcance en 3b, no se portó.
export interface DeviceRepositoryPort {
  listByUserId(userId: number): Promise<Device[]>;
  getByUserIdAndDeviceId(userId: number, deviceId: string): Promise<Device | undefined>;
  deleteByUserIdAndDeviceId(userId: number, deviceId: string): Promise<boolean>;
}

// Recortado a lo que usan DeleteDeviceUseCase (deleteByDeviceId) y
// GetLibraryBookDetailUseCase (getByBookId, Fase 3f). El resto del original
// (getAll/getByDevice/create/ensureByDeviceAndBook/deleteByBookIdAndDeviceId/
// delete + wrappers static) pertenece al flujo de descarga a dispositivos,
// fuera de alcance todavía.
export interface DeviceDownloadRepositoryPort {
  getByBookId(bookId: number): Promise<{ deviceId: string }[]>;
  deleteByDeviceId(deviceId: string): Promise<void>;
}

// deleteByDeviceId es lo único que usa DeleteDeviceUseCase.
// upsertByDeviceAndBook lo usa ProgressPersistenceService (Fase 3g) para
// marcar que un dispositivo confirmó la última actualización de progreso de
// un libro — en 3g nunca se ejecuta en la práctica (PutWebReaderProgress no
// pasa deviceId), pero el servicio es compartido con el sync de progreso de
// dispositivos KOReader (diferido, ver Fase 3g en el handoff), así que se
// porta completo en vez de recortarlo.
export interface DeviceProgressDownloadRepositoryPort {
  deleteByDeviceId(deviceId: string): Promise<void>;
  upsertByDeviceAndBook(input: { deviceId: string; bookId: number; progressUpdatedAt: string }): Promise<void>;
}

export interface PluginReleaseRepositoryPort {
  upsert(input: UpsertPluginReleaseInput): Promise<PluginRelease>;
  setLatestVersion(version: string): Promise<void>;
  getLatest(): Promise<PluginRelease | undefined>;
  getByVersion(version: string): Promise<PluginRelease | undefined>;
  listAll(): Promise<PluginRelease[]>;
}

export interface StorageObjectInfo {
  key: string;
  size: number;
  lastModified?: Date;
}

export interface StoragePort {
  put(key: string, body: Buffer | Uint8Array | NodeJS.ReadableStream, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  exists?(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<StorageObjectInfo[]>;
}

export interface ZLibraryMirrorSettingsPort {
  get(): Promise<readonly string[]>;
  replace(urls: readonly string[]): Promise<readonly string[]>;
}

export interface MigrationStatusSnapshot {
  currentMigrationTag: string | null;
  expectedMigrationTag: string;
  currentMigrationIndex: number | null;
  expectedMigrationIndex: number;
}

export interface MigrationStatusPort {
  getSnapshot(): Promise<MigrationStatusSnapshot>;
}

export interface MetadataQuery {
  title?: string | null;
  author?: string | null;
  isbn?: string | null;
  language?: string | null;
  googleBooksId?: string | null;
  openLibraryKey?: string | null;
  hardcoverId?: string | null;
  limit?: number;
}

export interface MetadataCoverCandidate {
  url: string;
  width?: number;
  height?: number;
  source: string;
}

export interface MetadataCandidate {
  providerId: MetadataProviderId;
  providerScore: number;
  identifiers: {
    isbn10: string | null;
    isbn13: string | null;
    asin: string | null;
    googleBooksId: string | null;
    openLibraryKey: string | null;
    hardcoverId: string | null;
  };
  title: string;
  subtitle: string | null;
  authors: string[];
  description: string | null;
  descriptionFormat: "text" | "html" | "markdown";
  subjects: string[];
  series: string | null;
  seriesIndex: number | null;
  publisher: string | null;
  publishedDate: { year: number | null; month: number | null; day: number | null };
  language: string | null;
  pageCount: number | null;
  covers: MetadataCoverCandidate[];
  rating: { average: number | null; count: number | null };
  sourceUrl: string | null;
}

export interface MetadataProviderCapabilities {
  touchedFields: ReadonlySet<string>;
  hasCover: boolean;
  hasRating: boolean;
  requiresIsbn: boolean;
}

export interface MetadataProviderPort {
  readonly id: MetadataProviderId;
  readonly capabilities: MetadataProviderCapabilities;
  lookup(query: MetadataQuery): Promise<ApiResult<MetadataCandidate[]>>;
}
