"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { notImplemented } from "./not-implemented";
import type { HardcoverProgressSyncStatus } from "@/lib/types/integrations";

interface IntegrationsPaneProps {
  status: HardcoverProgressSyncStatus | null;
  error: string | null;
  zlibName: string;
  showZLibraryLogin: boolean;
  isLoggingOutZLibrary?: boolean;
  onOpenZLibraryLogin: () => void;
  onLogoutZLibrary: () => void;
  isLoading?: boolean;
  isSaving?: boolean;
  isSyncing?: boolean;
  formatDateTime: (value: string | null) => string;
  mirrors: string[];
  mirrorsError: string | null;
  isLoadingMirrors?: boolean;
  isSavingMirrors?: boolean;
  onSaveMirrors: (urls: string[]) => Promise<boolean>;
}

const MAX_MIRRORS = 5;

export function IntegrationsPane({
  status,
  error,
  zlibName,
  showZLibraryLogin,
  isLoggingOutZLibrary = false,
  onOpenZLibraryLogin,
  onLogoutZLibrary,
  isLoading = false,
  isSyncing = false,
  formatDateTime,
  mirrors: savedMirrors,
  mirrorsError,
  isLoadingMirrors = false,
  isSavingMirrors = false,
  onSaveMirrors,
}: IntegrationsPaneProps) {
  const [mirrors, setMirrors] = useState(savedMirrors);

  useEffect(() => {
    setMirrors(savedMirrors);
  }, [savedMirrors]);

  const unavailableReason = status?.demoMode
    ? "Outbound integrations are disabled in demo mode."
    : "Set HARDCOVER_API_TOKEN on the server to enable progress sync.";

  function moveMirror(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= mirrors.length) return;
    const next = [...mirrors];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setMirrors(next);
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <h4 className="text-base font-semibold text-foreground">Z-Library</h4>
          <p className="text-sm text-muted-foreground">
            Manage account access and the mirror order used for provider requests.
          </p>
        </div>

        {showZLibraryLogin && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">{zlibName ? "Connected" : "Not connected"}</p>
              {zlibName && <p className="text-sm text-muted-foreground">{zlibName}</p>}
            </div>
            <Button
              variant={zlibName ? "destructive" : "default"}
              size="sm"
              disabled={isLoggingOutZLibrary}
              onClick={zlibName ? onLogoutZLibrary : onOpenZLibraryLogin}
            >
              {zlibName ? (isLoggingOutZLibrary ? "Logging out..." : "Log out") : "Connect"}
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div>
            <h5 className="text-sm font-medium text-foreground">Mirrors</h5>
            <p className="text-sm text-muted-foreground">
              Mirrors are tried in order. The first is primary. Use HTTPS URLs; up to {MAX_MIRRORS}{" "}
              mirrors are supported.
            </p>
          </div>

          {mirrorsError ? (
            <p className="text-sm text-destructive">{mirrorsError}</p>
          ) : isLoadingMirrors ? (
            <p className="text-sm text-muted-foreground">Loading mirror configuration...</p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {mirrors.map((url, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <Label htmlFor={`mirror-${index}`} className="sr-only">
                      Mirror {index + 1}
                    </Label>
                    <Input
                      id={`mirror-${index}`}
                      type="url"
                      value={url}
                      placeholder="https://mirror.example"
                      disabled={isSavingMirrors}
                      onChange={(event) =>
                        setMirrors((prev) => prev.map((v, i) => (i === index ? event.target.value : v)))
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={index === 0 || isSavingMirrors}
                      aria-label={`Move mirror ${index + 1} up`}
                      onClick={() => moveMirror(index, -1)}
                    >
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={index === mirrors.length - 1 || isSavingMirrors}
                      aria-label={`Move mirror ${index + 1} down`}
                      onClick={() => moveMirror(index, 1)}
                    >
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={mirrors.length === 1 || isSavingMirrors}
                      aria-label={`Remove mirror ${index + 1}`}
                      onClick={() => setMirrors((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={mirrors.length >= MAX_MIRRORS || isSavingMirrors}
                  onClick={() => setMirrors((prev) => [...prev, ""])}
                >
                  Add mirror
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSavingMirrors}
                  onClick={() => void onSaveMirrors(mirrors)}
                >
                  {isSavingMirrors ? "Saving..." : "Save mirrors"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold text-foreground">Hardcover</h4>
            <p className="text-sm text-muted-foreground">
              Keep Hardcover reading progress aligned with Sake.
            </p>
          </div>
          <Switch
            checked={status?.enabled ?? false}
            disabled={!status?.available}
            onCheckedChange={() => notImplemented("Toggling Hardcover sync")}
            aria-label="Sync reading progress to Hardcover"
          />
        </div>

        {isLoading && !status ? (
          <p className="text-sm text-muted-foreground">Loading integration status...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : status ? (
          !status.available ? (
            <p className="text-sm text-muted-foreground">{unavailableReason}</p>
          ) : (
            <div className="flex flex-col gap-3">
              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">Pending</dt>
                  <dd className="font-medium text-foreground">{status.counts.pending + status.counts.processing}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">Failed</dt>
                  <dd className="font-medium text-foreground">{status.counts.failed}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">Skipped</dt>
                  <dd className="font-medium text-foreground">{status.counts.skipped}</dd>
                </div>
              </dl>
              <p className="text-sm text-muted-foreground">
                Last successful sync: {formatDateTime(status.lastSuccessfulSyncAt)}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={!status.enabled || isSyncing}
                onClick={() => notImplemented("Syncing Hardcover progress")}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {isSyncing ? "Queuing..." : "Sync now"}
              </Button>
            </div>
          )
        ) : null}
      </div>
    </section>
  );
}
