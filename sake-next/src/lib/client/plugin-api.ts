import { request } from "@/lib/client/api-client";
import type { KoreaderPluginReleasesResponse, KoreaderPluginUpstreamVersionResponse } from "@/lib/types/plugin";

export const PluginApi = {
  listReleases: () => request<KoreaderPluginReleasesResponse>("/api/plugin/koreader/releases"),

  getUpstreamVersion: () => request<KoreaderPluginUpstreamVersionResponse>("/api/plugin/koreader/upstream-version"),
};
