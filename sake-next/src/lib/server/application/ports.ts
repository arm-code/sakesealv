import type { LibraryShelf, RuleGroup } from "@/lib/types/library";
import type {
  CreateUserAccountInput,
  CreateUserApiKeyInput,
  CreateUserSessionInput,
  UserAccount,
  UserApiKey,
  UserSession,
} from "@/lib/server/domain/auth";
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
  getById(id: number): Promise<LibraryShelf | undefined>;
  create(input: { name: string; icon: string; ruleGroup: RuleGroup }): Promise<LibraryShelf>;
  update(id: number, input: { name: string; icon: string; ruleGroup: RuleGroup }): Promise<LibraryShelf | undefined>;
  reorder(shelfIds: number[]): Promise<void>;
  delete(id: number): Promise<void>;
}

// Recortado a lo que usan ListDevicesUseCase/DeleteDeviceUseCase. `upsert` y
// `getByDeviceId` son del flujo de pairing del plugin KOReader
// (CreateDeviceApiKeyUseCase) — fuera de alcance en 3b, no se portó.
export interface DeviceRepositoryPort {
  listByUserId(userId: number): Promise<Device[]>;
  getByUserIdAndDeviceId(userId: number, deviceId: string): Promise<Device | undefined>;
  deleteByUserIdAndDeviceId(userId: number, deviceId: string): Promise<boolean>;
}

// Recortado a lo único que usa DeleteDeviceUseCase.
export interface DeviceDownloadRepositoryPort {
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
