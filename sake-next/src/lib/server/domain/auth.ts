export interface UserAccount {
  id: number;
  username: string;
  passwordHash: string;
  basicAuthPasswordHash: string | null;
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface CreateUserAccountInput {
  username: string;
  passwordHash: string;
}

export interface UserSession {
  id: number;
  userId: number;
  tokenHash: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  userAgent: string | null;
  ipAddress: string | null;
}

export interface CreateUserSessionInput {
  userId: number;
  tokenHash: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface UserApiKey {
  id: number;
  userId: number;
  deviceId: string;
  scope: string;
  keyPrefix: string;
  keyHash: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface CreateUserApiKeyInput {
  userId: number;
  deviceId: string;
  scope: string;
  keyPrefix: string;
  keyHash: string;
  createdAt: string;
  expiresAt?: string | null;
}

export interface SessionAuthActor {
  type: "session";
  user: UserAccount;
  sessionId: number;
}

export interface ApiKeyAuthActor {
  type: "api_key";
  user: UserAccount;
  apiKeyId: number;
  deviceId: string;
  scope: string;
}

export type AuthActor = SessionAuthActor | ApiKeyAuthActor;
