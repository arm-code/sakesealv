import type { HardcoverProgressSyncStatus } from "@/lib/types/integrations";
import type { AppVersionResponse } from "@/lib/types/app-version";

// Datos de ejemplo para las pestañas que la Fase 3 todavía no conecta
// (App/Integrations). Account, Devices y Plugin ya pegan contra /api real
// desde la Fase 3b/3c — sus mocks se quitaron de aquí.

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
