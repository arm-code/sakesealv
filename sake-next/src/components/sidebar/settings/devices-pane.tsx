import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RegisteredDevice } from "@/lib/types/auth";

interface DevicesPaneProps {
  devices: RegisteredDevice[];
  devicesError: string | null;
  isLoadingDevices?: boolean;
  deletingDeviceId: string | null;
  formatDateTime: (value: string | null) => string;
  onRefresh: () => void;
  onDelete: (deviceId: string) => void;
}

export function DevicesPane({
  devices,
  devicesError,
  isLoadingDevices = false,
  deletingDeviceId,
  formatDateTime,
  onRefresh,
  onDelete,
}: DevicesPaneProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-foreground">Devices</h4>
          <p className="text-sm text-muted-foreground">
            Manage devices that have connected to this Sake account.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoadingDevices || deletingDeviceId !== null}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {devicesError ? (
        <p className="text-sm text-destructive">{devicesError}</p>
      ) : isLoadingDevices ? (
        <p className="text-sm text-muted-foreground">Loading devices...</p>
      ) : devices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No devices have reported themselves yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {devices.map((device) => (
            <article key={device.deviceId} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium text-foreground">{device.deviceId}</p>
                  <Badge variant={device.hasActiveApiKey ? "default" : "secondary"}>
                    {device.hasActiveApiKey ? "API key active" : "No active API key"}
                  </Badge>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(device.deviceId)}
                  disabled={deletingDeviceId !== null}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  {deletingDeviceId === device.deviceId ? "Deleting..." : "Delete"}
                </Button>
              </div>

              <dl className="mt-3 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Plugin Version</dt>
                  <dd className="text-foreground">{device.pluginVersion}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Last Seen</dt>
                  <dd className="text-foreground">{formatDateTime(device.lastSeenAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Added</dt>
                  <dd className="text-foreground">{formatDateTime(device.createdAt)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
