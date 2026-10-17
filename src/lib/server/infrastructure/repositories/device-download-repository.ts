import type { DeviceDownloadRepositoryPort } from "@/lib/server/application/ports";
import type { DeviceDownload } from "@/lib/server/domain/device";
import { drizzleDb } from "@/lib/server/infrastructure/db/client";
import { deviceDownloads } from "@/lib/server/infrastructure/db/schema";
import { and, eq } from "drizzle-orm";

// Recortado: sin getAll/getByDevice/delete ni los wrappers static del original.
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

  async ensureByDeviceAndBook(download: Omit<DeviceDownload, "id">): Promise<DeviceDownload> {
    const [existing] = await drizzleDb
      .select()
      .from(deviceDownloads)
      .where(and(eq(deviceDownloads.deviceId, download.deviceId), eq(deviceDownloads.bookId, download.bookId)))
      .limit(1);
    return existing ?? this.create(download);
  }

  async deleteByBookIdAndDeviceId(bookId: number, deviceId: string): Promise<void> {
    await drizzleDb.delete(deviceDownloads).where(and(eq(deviceDownloads.bookId, bookId), eq(deviceDownloads.deviceId, deviceId)));
  }

  async deleteByDeviceId(deviceId: string): Promise<void> {
    await drizzleDb.delete(deviceDownloads).where(eq(deviceDownloads.deviceId, deviceId));
  }
}
