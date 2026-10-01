import type { DeviceDownloadRepositoryPort } from "@/lib/server/application/ports";
import { drizzleDb } from "@/lib/server/infrastructure/db/client";
import { deviceDownloads } from "@/lib/server/infrastructure/db/schema";
import { eq } from "drizzle-orm";

// Recortado a deleteByDeviceId: es lo único que usa DeleteDeviceUseCase. El
// resto de métodos del original (getAll/getByDevice/getByBookId/create/
// ensureByDeviceAndBook/deleteByBookIdAndDeviceId/delete, + sus wrappers
// static) pertenecen al flujo de descargas de la Fase de library/books.
export class DeviceDownloadRepository implements DeviceDownloadRepositoryPort {
  async deleteByDeviceId(deviceId: string): Promise<void> {
    await drizzleDb.delete(deviceDownloads).where(eq(deviceDownloads.deviceId, deviceId));
  }
}
