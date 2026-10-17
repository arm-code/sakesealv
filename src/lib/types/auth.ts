export interface CurrentUser {
  id: number;
  username: string;
  isDisabled: boolean;
  hasBasicAuthPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuthApiKey {
  id: number;
  deviceId: string;
  keyPreview: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export interface RegisteredDevice {
  deviceId: string;
  pluginVersion: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
  hasActiveApiKey: boolean;
}
