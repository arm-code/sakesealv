"use client";

import { useEffect, useState } from "react";
import { AppVersionApi } from "@/lib/client/app-version-api";
import { errorMessage } from "@/lib/client/api-client";
import type { AppVersionResponse } from "@/lib/types/app-version";

export function useAppVersion(enabled: boolean) {
  const [appVersionInfo, setAppVersionInfo] = useState<AppVersionResponse | null>(null);
  const [appVersionError, setAppVersionError] = useState<string | null>(null);
  const [isLoadingAppVersion, setIsLoadingAppVersion] = useState(true);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setIsLoadingAppVersion(true);
    setAppVersionError(null);

    AppVersionApi.get()
      .then((result) => {
        if (cancelled) return;
        setAppVersionInfo(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setAppVersionError(errorMessage(cause, "Failed to load app version"));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAppVersion(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { appVersionInfo, appVersionError, isLoadingAppVersion };
}
