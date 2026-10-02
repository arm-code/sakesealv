"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ZLibraryMirrorsApi } from "@/lib/client/zlibrary-mirrors-api";
import { errorMessage } from "@/lib/client/api-client";

export function useZlibraryMirrors(enabled: boolean) {
  const [mirrors, setMirrors] = useState<string[]>([]);
  const [mirrorsError, setMirrorsError] = useState<string | null>(null);
  const [isLoadingMirrors, setIsLoadingMirrors] = useState(true);
  const [isSavingMirrors, setIsSavingMirrors] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setIsLoadingMirrors(true);
    setMirrorsError(null);
    ZLibraryMirrorsApi.get()
      .then((result) => setMirrors(result.urls))
      .catch((cause: unknown) => setMirrorsError(errorMessage(cause, "Failed to load mirror settings")))
      .finally(() => setIsLoadingMirrors(false));
  }, [enabled]);

  async function saveMirrors(urls: string[]): Promise<boolean> {
    if (isSavingMirrors) return false;
    setIsSavingMirrors(true);
    try {
      const result = await ZLibraryMirrorsApi.replace(urls);
      setMirrors(result.urls);
      toast.success("Mirror configuration saved");
      return true;
    } catch (cause: unknown) {
      toast.error(`Failed to save mirrors: ${errorMessage(cause, "unknown error")}`);
      return false;
    } finally {
      setIsSavingMirrors(false);
    }
  }

  return { mirrors, mirrorsError, isLoadingMirrors, isSavingMirrors, saveMirrors };
}
