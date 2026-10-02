import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  KoreaderPluginRelease,
  KoreaderPluginReleasesResponse,
  KoreaderPluginUpstreamStatus,
  KoreaderPluginUpstreamVersionResponse,
} from "@/lib/types/plugin";

interface PluginPaneProps {
  releasesInfo: KoreaderPluginReleasesResponse | null;
  releasesError: string | null;
  isLoadingPluginReleases?: boolean;
  upstreamVersionInfo: KoreaderPluginUpstreamVersionResponse | null;
  upstreamVersionError: string | null;
  isCheckingPluginUpstreamVersion?: boolean;
  formatDateTime: (value: string | null) => string;
  onRefresh: () => void;
  onCheckUpstream: () => void;
}

function formatSha(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function getStatusLabel(status: KoreaderPluginUpstreamStatus): string {
  switch (status) {
    case "up_to_date":
      return "Up to date";
    case "outdated":
      return "Update available";
    case "uploaded_newer":
      return "Uploaded newer than GitHub";
    case "unavailable":
      return "Unable to compare";
  }
}

function getStatusDetail(info: KoreaderPluginUpstreamVersionResponse): string {
  if (!info.upstreamVersion) return "GitHub metadata could not be read.";
  if (!info.uploadedVersion) {
    return `GitHub reports ${info.upstreamVersion}, but no uploaded release is available.`;
  }
  return `Uploaded ${info.uploadedVersion}, GitHub ${info.upstreamVersion}.`;
}

function getReleaseLabel(release: KoreaderPluginRelease): string {
  return release.isLatest ? `${release.version} latest` : release.version;
}

export function PluginPane({
  releasesInfo,
  releasesError,
  isLoadingPluginReleases = false,
  upstreamVersionInfo,
  upstreamVersionError,
  isCheckingPluginUpstreamVersion = false,
  formatDateTime,
  onRefresh,
  onCheckUpstream,
}: PluginPaneProps) {
  const releases = releasesInfo?.releases ?? [];
  const latestRelease = releases.find((release) => release.isLatest) ?? releases[0] ?? null;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-foreground">Plugin</h4>
          <p className="text-sm text-muted-foreground">
            Download the KOReader Sake plugin artifacts uploaded by this server.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoadingPluginReleases}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {releasesError ? (
        <p className="text-sm text-destructive">{releasesError}</p>
      ) : isLoadingPluginReleases && releases.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading plugin releases...</p>
      ) : releases.length === 0 ? (
        <p className="text-sm text-muted-foreground">No uploaded plugin releases are available yet.</p>
      ) : (
        <>
          {latestRelease && (
            <article className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 p-4">
              <div>
                <p className="text-xs text-muted-foreground">Latest uploaded</p>
                <h5 className="text-sm font-semibold text-foreground">{latestRelease.version}</h5>
                <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <div className="flex gap-1">
                    <dt>Updated</dt>
                    <dd>{formatDateTime(latestRelease.updatedAt)}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt>SHA-256</dt>
                    <dd className="font-mono">{formatSha(latestRelease.sha256)}</dd>
                  </div>
                </dl>
              </div>
              <Button
                size="sm"
                nativeButton={false}
                render={<a href={latestRelease.downloadUrl} download={latestRelease.fileName} />}
              >
                <Download className="size-4" aria-hidden="true" />
                Download
              </Button>
            </article>
          )}

          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">GitHub version check</p>
              {upstreamVersionError ? (
                <p className="text-sm text-destructive">{upstreamVersionError}</p>
              ) : upstreamVersionInfo ? (
                <>
                  <p className="text-sm text-foreground">{getStatusLabel(upstreamVersionInfo.status)}</p>
                  <p className="text-sm text-muted-foreground">{getStatusDetail(upstreamVersionInfo)}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Manual check only. Opening settings does not contact GitHub.
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={onCheckUpstream} disabled={isCheckingPluginUpstreamVersion}>
              <RefreshCw className="size-4" aria-hidden="true" />
              {isCheckingPluginUpstreamVersion ? "Checking..." : "Check upstream"}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-semibold text-foreground">Uploaded versions</h5>
              <span className="text-xs text-muted-foreground">{releases.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {releases.map((release) => (
                <article
                  key={release.version}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{getReleaseLabel(release)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(release.updatedAt)} · {formatSha(release.sha256)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<a href={release.downloadUrl} download={release.fileName} />}
                    aria-label={`Download plugin version ${release.version}`}
                  >
                    <Download className="size-4" aria-hidden="true" />
                    Download
                  </Button>
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
