import type { DeviceRepositoryPort } from "@/lib/server/application/ports";
import type { Device } from "@/lib/server/domain/device";
import { drizzleDb } from "@/lib/server/infrastructure/db/client";
import { devices } from "@/lib/server/infrastructure/db/schema";
import { createChildLogger } from "@/lib/server/infrastructure/logging/logger";
import { and, desc, eq } from "drizzle-orm";

function mapRow(row: typeof devices.$inferSelect): Device {
  return {
    id: row.id,
    userId: row.userId,
    deviceId: row.deviceId,
    pluginVersion: row.pluginVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastSeenAt: row.lastSeenAt,
  };
}

export class DeviceRepository implements DeviceRepositoryPort {
  private readonly repoLogger = createChildLogger({ repository: "DeviceRepository" });

  async listByUserId(userId: number): Promise<Device[]> {
    const rows = await drizzleDb
      .select()
      .from(devices)
      .where(eq(devices.userId, userId))
      .orderBy(desc(devices.lastSeenAt), devices.deviceId);

    return rows.map(mapRow);
  }

  async getByUserIdAndDeviceId(userId: number, deviceId: string): Promise<Device | undefined> {
    const [row] = await drizzleDb
      .select()
      .from(devices)
      .where(and(eq(devices.userId, userId), eq(devices.deviceId, deviceId)))
      .limit(1);

    return row ? mapRow(row) : undefined;
  }

  async deleteByUserIdAndDeviceId(userId: number, deviceId: string): Promise<boolean> {
    const [deleted] = await drizzleDb
      .delete(devices)
      .where(and(eq(devices.userId, userId), eq(devices.deviceId, deviceId)))
      .returning({ id: devices.id });

    if (deleted) {
      this.repoLogger.info({ event: "device.deleted", userId, deviceId }, "Device deleted from registry");
    }

    return Boolean(deleted);
  }
}
