import type { DeviceDownloadRepositoryPort } from "@/lib/server/application/ports";
import type { DeviceDownload } from "@/lib/server/domain/device";
import { drizzleDb } from "@/lib/server/infrastructure/db/client";
import { deviceDownloads } from "@/lib/server/infrastructure/db/schema";
import { eq } from "drizzle-orm";

// Recortado a deleteByDeviceId (DeleteDeviceUseCase) y getByBookId
// (GetLibraryBookDetailUseCase, Fase 3f). El resto del original (getAll/
// getByDevice/create/ensureByDeviceAndBook/deleteByBookIdAndDeviceId/delete
// + sus wrappers static) pertenece al flujo de descarga a dispositivos.
export class DeviceDownloadRepository implements DeviceDownloadRepositoryPort {
  async getByBookId(bookId: number): Promise<{ deviceId: string }[]> {
    return drizzleDb.select({ deviceId: deviceDownloads.deviceId }).from(deviceDownloads).where(eq(deviceDownloads.bookId, bookId));
  }

  async create(download: Omit<DeviceDownload, "id">): Promise<DeviceDownload> {
    const [created] = await drizzleDb.insert(deviceDownloads).values(download).returning();
    if (!created) {
      throw new Error("Failed to create device download");
    }
    return created;
  }

  async deleteByDeviceId(deviceId: string): Promise<void> {
    await drizzleDb.delete(deviceDownloads).where(eq(deviceDownloads.deviceId, deviceId));
  }
}
