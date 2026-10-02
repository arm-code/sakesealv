import type { LibraryShelf, RuleGroup } from "@/lib/types/library";
import type {
  CreateUserAccountInput,
  CreateUserApiKeyInput,
  CreateUserSessionInput,
  UserAccount,
  UserApiKey,
  UserSession,
} from "@/lib/server/domain/auth";
import type { Book } from "@/lib/server/domain/book";
import type { Device } from "@/lib/server/domain/device";
import type { PluginRelease, UpsertPluginReleaseInput } from "@/lib/server/domain/plugin-release";

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
// GetLibraryBookContentUseCase/SetBookShelvesUseCase (Fase 3f — núcleo:
// listar/ver/leer/asignar estantes). El resto del original (getAllForStats,
// getByIdIncludingTrashed, getByZLibId*, getByStorageKey*, getByTitle*,
// hasOtherBookWithStorageKey, listStorageKeysWithExternalReferences, create,
// updateMetadata, updateHardcoverId, delete, resetDownloadStatus,
// updateProgress, touchProgressUpdatedAt, updateRating, updateState,
// getNotDownloadedByDevice, getBooksWithNewProgressForDevice, getTrashed,
// moveToTrash, restoreFromTrash, getExpiredTrash, count) pertenece a
// mini-fases futuras (progreso/rating, papelera, adquisición, dispositivos).
export interface BookRepositoryPort {
  getAll(): Promise<Book[]>;
  getById(id: number): Promise<Book | undefined>;
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

// Recortado a lo único que usa DeleteDeviceUseCase.
export interface DeviceProgressDownloadRepositoryPort {
  deleteByDeviceId(deviceId: string): Promise<void>;
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
