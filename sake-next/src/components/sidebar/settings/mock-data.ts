import type { AuthApiKey, CurrentUser, RegisteredDevice } from "@/lib/types/auth";
import type {
  KoreaderPluginReleasesResponse,
  KoreaderPluginUpstreamVersionResponse,
} from "@/lib/types/plugin";
import type { HardcoverProgressSyncStatus } from "@/lib/types/integrations";
import type { AppVersionResponse } from "@/lib/types/app-version";

// Datos de ejemplo para poder construir y revisar la UI del modal de Settings
// antes de que la Fase 3 conecte las rutas /api reales.

export const mockAppVersion: AppVersionResponse = {
  version: "0.1.0-dev",
  gitTag: null,
  commitSha: null,
  releasedAt: null,
  database: {
    status: "up_to_date",
    currentMigrationTag: "0025_zlibrary_mirror_settings",
    expectedMigrationTag: "0025_zlibrary_mirror_settings",
    needsMigration: false,
  },
};

export const mockCurrentUser: CurrentUser = {
  id: 1,
  username: "demo",
  isDisabled: false,
  hasBasicAuthPassword: false,
  lastLoginAt: new Date().toISOString(),
  createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
};

export const mockApiKeys: AuthApiKey[] = [
  {
    id: 1,
    deviceId: "kindle-paperwhite-01",
    keyPreview: "sake_live_••••7f3a",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    expiresAt: null,
  },
];

export const mockDevices: RegisteredDevice[] = [
  {
    deviceId: "kindle-paperwhite-01",
    pluginVersion: "1.4.0",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    lastSeenAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    hasActiveApiKey: true,
  },
];

export const mockPluginReleases: KoreaderPluginReleasesResponse = {
  latestVersion: "1.4.0",
  releases: [
    {
      version: "1.4.0",
      fileName: "sake-koreader-1.4.0.zip",
      sha256: "a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d6e7f80",
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      isLatest: true,
      downloadUrl: "#",
    },
    {
      version: "1.3.0",
      fileName: "sake-koreader-1.3.0.zip",
      sha256: "f0e9d8c7b6a5948372615049382716a5b4c3d2e1f0a9b8c7d6e5f4030201af",
      updatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      isLatest: false,
      downloadUrl: "#",
    },
  ],
};

export const mockPluginUpstreamVersion: KoreaderPluginUpstreamVersionResponse = {
  uploadedVersion: "1.4.0",
  upstreamVersion: "1.4.0",
  status: "up_to_date",
  sourceUrl: "https://github.com/Sudashiii/Sake",
  checkedAt: new Date().toISOString(),
};

export const mockHardcoverStatus: HardcoverProgressSyncStatus = {
  tokenConfigured: true,
  enabled: true,
  available: true,
  demoMode: false,
  lastSuccessfulSyncAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  counts: {
    pending: 2,
    processing: 0,
    completed: 148,
    failed: 1,
    skipped: 3,
  },
};

export const mockZlibraryMirrors: string[] = ["https://z-library.sk"];
