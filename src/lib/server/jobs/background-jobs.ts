import {
  annotationIndexService,
  downloadQueue,
  hardcoverApiToken,
  hardcoverProgressSyncService,
  purgeExpiredTrashUseCase,
  syncKoreaderPluginReleaseUseCase,
} from "@/lib/server/application/composition";
import { createChildLogger, toLogError } from "@/lib/server/infrastructure/logging/logger";

// Jobs de fondo del proceso web. Sustituyen a los triggers de `hooks.server.ts`
// del original, que colgaban de la primera request: aquí arrancan una sola
// vez desde `instrumentation.ts` y el purge usa un timer. Incluye también la
// recuperación de la cola de descargas, la reconciliación de Hardcover (si hay
// token) y la del índice de anotaciones.

const TRASH_PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const STARTED_KEY = Symbol.for("sake.backgroundJobs.started");

function envFlag(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

async function purgeExpiredTrash(): Promise<void> {
  const jobLogger = createChildLogger({ event: "trash.purge" });
  try {
    const result = await purgeExpiredTrashUseCase.execute();
    if (!result.ok) {
      jobLogger.error({ error: result.error }, "Trash purge failed");
    } else if (result.value.purgedBookIds.length > 0) {
      jobLogger.info({ purgedBookIds: result.value.purgedBookIds, count: result.value.purgedBookIds.length }, "Purged expired trashed books");
    }
  } catch (cause) {
    jobLogger.error({ error: toLogError(cause) }, "Trash purge failed");
  }
}

async function syncPluginRelease(): Promise<void> {
  const jobLogger = createChildLogger({ event: "plugin.sync.startup" });
  try {
    const result = await syncKoreaderPluginReleaseUseCase.execute();
    if (!result.ok) {
      jobLogger.error({ statusCode: result.error.status, reason: result.error.message }, "KOReader plugin startup sync rejected");
      return;
    }
    jobLogger.info(
      { version: result.value.version, storageKey: result.value.storageKey, uploaded: result.value.uploaded },
      "KOReader plugin startup sync finished",
    );
  } catch (cause) {
    jobLogger.error({ error: toLogError(cause) }, "KOReader plugin startup sync failed");
  }
}

// Idempotente por proceso (HMR / varias cargas del módulo comparten globalThis).
export function startBackgroundJobs(): void {
  const holder = globalThis as Record<symbol, unknown>;
  if (holder[STARTED_KEY]) return;
  holder[STARTED_KEY] = true;

  if (envFlag("SAKE_SKIP_TRASH_PURGE")) {
    createChildLogger({ event: "trash.purge" }).info({ skipped: true, reason: "SAKE_SKIP_TRASH_PURGE" }, "Skipped trash purge job");
  } else {
    void purgeExpiredTrash();
    setInterval(() => void purgeExpiredTrash(), TRASH_PURGE_INTERVAL_MS).unref();
  }

  if (envFlag("SAKE_SKIP_STARTUP_PLUGIN_SYNC")) {
    createChildLogger({ event: "plugin.sync.startup" }).info(
      { skipped: true, reason: "SAKE_SKIP_STARTUP_PLUGIN_SYNC" },
      "Skipped KOReader plugin startup sync",
    );
  } else {
    void syncPluginRelease();
  }

  // Inicializa la cola: recupera jobs activos tras un reinicio y retoma los reanudables.
  void downloadQueue.getStatus().catch((cause: unknown) => {
    createChildLogger({ event: "queue.startup" }).error({ error: toLogError(cause) }, "Download queue startup recovery failed");
  });

  // Hardcover: reconcilia (y reanuda la cola) al arrancar si hay token; es no-op si está deshabilitado.
  if (hardcoverApiToken) {
    void hardcoverProgressSyncService.reconcile(true).catch((cause: unknown) => {
      createChildLogger({ event: "hardcover.progress_sync.startup" }).error(
        { error: toLogError(cause) },
        "Hardcover progress startup reconciliation failed",
      );
    });
  }

  if (!envFlag("SAKE_SKIP_ANNOTATION_INDEX_SYNC")) {
    annotationIndexService.startReconciliation();
  }
}
