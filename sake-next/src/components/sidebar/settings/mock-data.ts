import type { HardcoverProgressSyncStatus } from "@/lib/types/integrations";

// Datos de ejemplo para lo que la Fase 3 todavía no conecta: la parte de
// Hardcover dentro de Integrations (depende de BookRepository, que no existe
// hasta que se porte el dominio de library/books — ver sección "Fase 3d" del
// handoff). Account, Devices, Plugin, los mirrors de Z-Library y App ya
// pegan contra /api real.

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
