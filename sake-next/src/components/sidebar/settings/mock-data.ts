import type { HardcoverProgressSyncStatus } from "@/lib/types/integrations";
import type { AppVersionResponse } from "@/lib/types/app-version";

// Datos de ejemplo para lo que la Fase 3 todavía no conecta: App, y la
// parte de Hardcover dentro de Integrations (depende de BookRepository,
// que no existe hasta que se porte el dominio de library/books — ver
// sección "Fase 3d" del handoff). Account, Devices, Plugin y los mirrors
// de Z-Library ya pegan contra /api real.

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
