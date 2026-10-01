import type { DeviceProgressDownloadRepositoryPort } from "@/lib/server/application/ports";
import { drizzleDb } from "@/lib/server/infrastructure/db/client";
import { deviceProgressDownloads } from "@/lib/server/infrastructure/db/schema";
import { eq } from "drizzle-orm";

// Recortado a deleteByDeviceId (igual razón que DeviceDownloadRepository) —
// upsertByDeviceAndBook es del flujo de confirmación de progreso de la Fase
// de library/books.
export class DeviceProgressDownloadRepository implements DeviceProgressDownloadRepositoryPort {
  async deleteByDeviceId(deviceId: string): Promise<void> {
    await drizzleDb.delete(deviceProgressDownloads).where(eq(deviceProgressDownloads.deviceId, deviceId));
  }
}
