"use client";

import { useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetaList, MetaRow } from "./meta-row";
import { ApiKeyList } from "./api-key-list";
import { notImplemented } from "./not-implemented";
import type { AuthApiKey, CurrentUser } from "@/lib/types/auth";

interface AccountPaneProps {
  currentUser: CurrentUser | null;
  currentUserError: string | null;
  isLoadingCurrentUser?: boolean;
  apiKeys: AuthApiKey[];
  apiKeysError: string | null;
  isLoadingApiKeys?: boolean;
  revokingApiKeyId: number | null;
  formatDateTime: (value: string | null) => string;
  isLoggingOut?: boolean;
  isLoggingOutEverywhere?: boolean;
}

const GENERATED_PASSWORD_LENGTH = 8;
const GENERATED_PASSWORD_CHARSET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";

function generatePassword(): string {
  const randomValues = new Uint32Array(GENERATED_PASSWORD_LENGTH);
  crypto.getRandomValues(randomValues);
  return Array.from(
    randomValues,
    (value) => GENERATED_PASSWORD_CHARSET[value % GENERATED_PASSWORD_CHARSET.length],
  ).join("");
}

export function AccountPane({
  currentUser,
  currentUserError,
  isLoadingCurrentUser = false,
  apiKeys,
  apiKeysError,
  isLoadingApiKeys = false,
  revokingApiKeyId,
  formatDateTime,
  isLoggingOut = false,
  isLoggingOutEverywhere = false,
}: AccountPaneProps) {
  const [basicAuthPassword, setBasicAuthPassword] = useState("");

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <h4 className="text-base font-semibold text-foreground">User Account</h4>
          <p className="text-sm text-muted-foreground">
            Details for the currently signed-in Sake account.
          </p>
        </div>

        {currentUserError ? (
          <p className="text-sm text-destructive">{currentUserError}</p>
        ) : isLoadingCurrentUser ? (
          <p className="text-sm text-muted-foreground">Loading account information...</p>
        ) : currentUser ? (
          <MetaList>
            <MetaRow label="Username" value={currentUser.username} />
            <MetaRow label="Status" value={currentUser.isDisabled ? "Disabled" : "Active"} />
            <MetaRow label="Created" value={formatDateTime(currentUser.createdAt)} />
            <MetaRow label="Last Login" value={formatDateTime(currentUser.lastLoginAt)} />
          </MetaList>
        ) : (
          <p className="text-sm text-muted-foreground">No account information is available.</p>
        )}
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-3">
        <div>
          <h4 className="text-base font-semibold text-foreground">Basic Authentication</h4>
          <p className="text-sm text-muted-foreground">
            Manage the optional password used by OPDS and WebDAV. Your normal account password
            will always continue to work there too.
          </p>
        </div>

        {currentUser && (
          <p className="text-sm text-muted-foreground">
            {currentUser.hasBasicAuthPassword
              ? "A separate Basic authentication password is currently configured."
              : "No separate Basic authentication password is configured."}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="basic-auth-password">Set or replace Basic authentication password</Label>
          <div className="flex gap-2">
            <Input
              id="basic-auth-password"
              type="text"
              value={basicAuthPassword}
              onChange={(event) => setBasicAuthPassword(event.target.value)}
              placeholder="Enter a new Basic authentication password"
              autoComplete="new-password"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setBasicAuthPassword(generatePassword())}
              aria-label="Generate random Basic authentication password"
              title="Generate random password"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => notImplemented("Saving the Basic authentication password")}
              disabled={!basicAuthPassword}
            >
              Save Basic Authentication Password
            </Button>
            {currentUser?.hasBasicAuthPassword && (
              <Button
                type="button"
                variant="outline"
                onClick={() => notImplemented("Removing the Basic authentication password")}
              >
                Remove Separate Basic Authentication Password
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="h-px bg-border" />

      <ApiKeyList
        apiKeys={apiKeys}
        apiKeysError={apiKeysError}
        isLoadingApiKeys={isLoadingApiKeys}
        revokingApiKeyId={revokingApiKeyId}
        formatDateTime={formatDateTime}
      />

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-3">
        <div>
          <h4 className="text-base font-semibold text-foreground">Browser Session</h4>
          <p className="text-sm text-muted-foreground">End the current Sake session for this browser.</p>
        </div>
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => notImplemented("Logging out")}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? "Logging out..." : "Log Out This Browser"}
        </Button>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-3">
        <div>
          <h4 className="text-base font-semibold text-foreground">All Devices</h4>
          <p className="text-sm text-muted-foreground">
            Revoke all sessions and API keys across every device.
          </p>
        </div>
        <Button
          variant="destructive"
          className="w-fit"
          onClick={() => notImplemented("Logging out of all devices")}
          disabled={isLoggingOutEverywhere}
        >
          <LogOut className="size-4" aria-hidden="true" />
          {isLoggingOutEverywhere ? "Logging out..." : "Log Out of All Devices"}
        </Button>
      </div>
    </section>
  );
}
