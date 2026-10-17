import { request } from "@/lib/client/api-client";
import type { RegisteredDevice } from "@/lib/types/auth";

export const DevicesApi = {
  list: () => request<{ success: true; devices: RegisteredDevice[] }>("/api/devices"),

  remove: (deviceId: string) =>
    request<{ success: true; deviceId: string }>(`/api/devices/${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
    }),
};
