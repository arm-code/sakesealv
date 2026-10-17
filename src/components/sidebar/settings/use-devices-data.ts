"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DevicesApi } from "@/lib/client/devices-api";
import { errorMessage } from "@/lib/client/api-client";
import type { RegisteredDevice } from "@/lib/types/auth";

export function useDevicesData(enabled: boolean) {
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [deletingDeviceId, setDeletingDeviceId] = useState<string | null>(null);

  async function loadDevices(): Promise<void> {
    setIsLoadingDevices(true);
    setDevicesError(null);
    try {
      const result = await DevicesApi.list();
      setDevices(result.devices);
    } catch (cause: unknown) {
      setDevicesError(errorMessage(cause, "Failed to load devices"));
    } finally {
      setIsLoadingDevices(false);
    }
  }

  useEffect(() => {
    if (!enabled) return;
    void loadDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  async function deleteDevice(deviceId: string): Promise<void> {
    if (deletingDeviceId !== null) return;
    setDeletingDeviceId(deviceId);
    try {
      await DevicesApi.remove(deviceId);
      setDevices((prev) => prev.filter((device) => device.deviceId !== deviceId));
      toast.success(`Deleted device "${deviceId}"`);
    } catch (cause: unknown) {
      toast.error(`Failed to delete device: ${errorMessage(cause, "unknown error")}`);
    } finally {
      setDeletingDeviceId(null);
    }
  }

  return { devices, devicesError, isLoadingDevices, deletingDeviceId, refreshDevices: loadDevices, deleteDevice };
}
