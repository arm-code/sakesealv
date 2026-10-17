export interface Device {
  id: number;
  userId: number;
  deviceId: string;
  pluginVersion: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

export interface DeviceDownload {
  id: number;
  deviceId: string;
  bookId: number;
}

export interface DeviceProgressDownload {
  id: number;
  deviceId: string;
  bookId: number;
  progressUpdatedAt: string;
}
