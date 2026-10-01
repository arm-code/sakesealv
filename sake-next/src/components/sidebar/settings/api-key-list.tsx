import { Button } from "@/components/ui/button";
import { notImplemented } from "./not-implemented";
import type { AuthApiKey } from "@/lib/types/auth";

interface ApiKeyListProps {
  apiKeys: AuthApiKey[];
  apiKeysError: string | null;
  isLoadingApiKeys?: boolean;
  revokingApiKeyId: number | null;
  formatDateTime: (value: string | null) => string;
}

export function ApiKeyList({
  apiKeys,
  apiKeysError,
  isLoadingApiKeys = false,
  revokingApiKeyId,
  formatDateTime,
}: ApiKeyListProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-foreground">Device API Keys</h4>
          <p className="text-sm text-muted-foreground">
            Masked keys are listed by device ID. Revoke one to force that device to pair again.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => notImplemented("Refreshing API keys")}
          disabled={isLoadingApiKeys || revokingApiKeyId !== null}
        >
          Refresh
        </Button>
      </div>

      {apiKeysError ? (
        <p className="text-sm text-destructive">{apiKeysError}</p>
      ) : isLoadingApiKeys ? (
        <p className="text-sm text-muted-foreground">Loading device keys...</p>
      ) : apiKeys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No device API keys have been issued yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {apiKeys.map((apiKey) => (
            <article key={apiKey.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{apiKey.deviceId}</p>
                  <p className="font-mono text-xs text-muted-foreground">{apiKey.keyPreview}</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => notImplemented("Revoking an API key")}
                  disabled={revokingApiKeyId !== null}
                >
                  {revokingApiKeyId === apiKey.id ? "Revoking..." : "Revoke"}
                </Button>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-1.5 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Created</dt>
                  <dd className="text-foreground">{formatDateTime(apiKey.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Last Used</dt>
                  <dd className="text-foreground">{formatDateTime(apiKey.lastUsedAt)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
