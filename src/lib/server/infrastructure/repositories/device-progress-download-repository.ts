import type { DeviceProgressDownloadRepositoryPort } from "@/lib/server/application/ports";
import type { DeviceProgressDownload } from "@/lib/server/domain/device";
import { drizzleDb } from "@/lib/server/infrastructure/db/client";
import { deviceProgressDownloads } from "@/lib/server/infrastructure/db/schema";
import { eq } from "drizzle-orm";

export class DeviceProgressDownloadRepository implements DeviceProgressDownloadRepositoryPort {
  async deleteByDeviceId(deviceId: string): Promise<void> {
    await drizzleDb.delete(deviceProgressDownloads).where(eq(deviceProgressDownloads.deviceId, deviceId));
  }

  async upsertByDeviceAndBook(input: Omit<DeviceProgressDownload, "id">): Promise<DeviceProgressDownload> {
    const [record] = await drizzleDb
      .insert(deviceProgressDownloads)
      .values(input)
      .onConflictDoUpdate({
        target: [deviceProgressDownloads.deviceId, deviceProgressDownloads.bookId],
        set: { progressUpdatedAt: input.progressUpdatedAt },
      })
      .returning();

    if (!record) {
      throw new Error("Failed to upsert progress confirmation");
    }
    return record;
  }
}
