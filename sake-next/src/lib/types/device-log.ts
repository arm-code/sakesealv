export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "unknown"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export const DEVICE_LOG_BACKLOG_LIMIT = 500;

export function normalizeLogLevel(value: unknown): LogLevel {
  if (typeof value === "string") {
    return (LOG_LEVELS as readonly string[]).includes(value) ? (value as LogLevel) : "unknown";
  }
  if (typeof value !== "number") return "unknown";
  if (value >= 60) return "fatal";
  if (value >= 50) return "error";
  if (value >= 40) return "warn";
  if (value >= 30) return "info";
  if (value >= 20) return "debug";
  if (value >= 10) return "trace";
  return "unknown";
}

export interface DeviceLogEntry {
  id: string;
  deviceId: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source: string;
}
