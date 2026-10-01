import type { LibraryShelf, RuleGroup } from "@/lib/types/library";
import type {
  CreateUserAccountInput,
  CreateUserApiKeyInput,
  CreateUserSessionInput,
  UserAccount,
  UserApiKey,
  UserSession,
} from "@/lib/server/domain/auth";

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
