"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HardcoverProgressApi } from "@/lib/client/hardcover-progress-api";
import { errorMessage } from "@/lib/client/api-client";
import type { HardcoverProgressSyncStatus } from "@/lib/types/integrations";

export function useHardcoverProgress(enabled: boolean) {
  const [status, setStatus] = useState<HardcoverProgressSyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    HardcoverProgressApi.getStatus()
      .then(setStatus)
      .catch((cause: unknown) => setError(errorMessage(cause, "Failed to load Hardcover status")))
      .finally(() => setIsLoading(false));
  }, [enabled]);

  async function setSyncEnabled(next: boolean): Promise<void> {
    if (isSaving) return;
    setIsSaving(true);
    try {
      setStatus(await HardcoverProgressApi.setEnabled(next));
      toast.success(next ? "Hardcover sync enabled" : "Hardcover sync disabled");
    } catch (cause: unknown) {
      toast.error(`Failed to update Hardcover sync: ${errorMessage(cause, "unknown error")}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function syncNow(): Promise<void> {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await HardcoverProgressApi.syncNow();
      toast.success(`Queued ${result.enqueued} book${result.enqueued === 1 ? "" : "s"} for Hardcover sync`);
      setStatus(await HardcoverProgressApi.getStatus());
    } catch (cause: unknown) {
      toast.error(`Failed to sync Hardcover: ${errorMessage(cause, "unknown error")}`);
    } finally {
      setIsSyncing(false);
    }
  }

  return { status, error, isLoading, isSaving, isSyncing, setSyncEnabled, syncNow };
}
