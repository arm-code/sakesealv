"use client";

import { useEffect, useState } from "react";
import { PluginApi } from "@/lib/client/plugin-api";
import { errorMessage } from "@/lib/client/api-client";
import type { KoreaderPluginReleasesResponse, KoreaderPluginUpstreamVersionResponse } from "@/lib/types/plugin";

export function usePluginData(enabled: boolean) {
  const [releasesInfo, setReleasesInfo] = useState<KoreaderPluginReleasesResponse | null>(null);
  const [releasesError, setReleasesError] = useState<string | null>(null);
  const [isLoadingPluginReleases, setIsLoadingPluginReleases] = useState(true);

  const [upstreamVersionInfo, setUpstreamVersionInfo] = useState<KoreaderPluginUpstreamVersionResponse | null>(null);
  const [upstreamVersionError, setUpstreamVersionError] = useState<string | null>(null);
  const [isCheckingPluginUpstreamVersion, setIsCheckingPluginUpstreamVersion] = useState(false);

  async function loadReleases(): Promise<void> {
    setIsLoadingPluginReleases(true);
    setReleasesError(null);
    try {
      const result = await PluginApi.listReleases();
      setReleasesInfo(result);
    } catch (cause: unknown) {
      // 404 "Plugin releases not found" es un estado válido (nada sincronizado
      // todavía) — se muestra como lista vacía, no como error.
      setReleasesInfo({ latestVersion: "", releases: [] });
      setReleasesError(null);
      void cause;
    } finally {
      setIsLoadingPluginReleases(false);
    }
  }

  async function checkUpstreamVersion(): Promise<void> {
    if (isCheckingPluginUpstreamVersion) return;
    setIsCheckingPluginUpstreamVersion(true);
    setUpstreamVersionError(null);
    try {
      const result = await PluginApi.getUpstreamVersion();
      setUpstreamVersionInfo(result);
    } catch (cause: unknown) {
      setUpstreamVersionError(errorMessage(cause, "Failed to check upstream plugin version"));
    } finally {
      setIsCheckingPluginUpstreamVersion(false);
    }
  }

  useEffect(() => {
    if (!enabled) return;
    void loadReleases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    releasesInfo,
    releasesError,
    isLoadingPluginReleases,
    refreshReleases: loadReleases,
    upstreamVersionInfo,
    upstreamVersionError,
    isCheckingPluginUpstreamVersion,
    checkUpstreamVersion,
  };
}
