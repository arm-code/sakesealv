"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AccountApi } from "@/lib/client/account-api";
import { errorMessage } from "@/lib/client/api-client";
import type { AuthApiKey, CurrentUser } from "@/lib/types/auth";

interface UseAccountDataOptions {
  enabled: boolean;
  onSessionEnded: () => void;
}

export function useAccountData({ enabled, onSessionEnded }: UseAccountDataOptions) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [currentUserError, setCurrentUserError] = useState<string | null>(null);
  const [isLoadingCurrentUser, setIsLoadingCurrentUser] = useState(true);

  const [apiKeys, setApiKeys] = useState<AuthApiKey[]>([]);
  const [apiKeysError, setApiKeysError] = useState<string | null>(null);
  const [isLoadingApiKeys, setIsLoadingApiKeys] = useState(true);
  const [revokingApiKeyId, setRevokingApiKeyId] = useState<number | null>(null);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingOutEverywhere, setIsLoggingOutEverywhere] = useState(false);
  const [isSavingBasicAuthPassword, setIsSavingBasicAuthPassword] = useState(false);
  const [isRemovingBasicAuthPassword, setIsRemovingBasicAuthPassword] = useState(false);

  async function loadCurrentUser(): Promise<void> {
    setIsLoadingCurrentUser(true);
    setCurrentUserError(null);
    try {
      const result = await AccountApi.getCurrentUser();
      setCurrentUser(result.user);
    } catch (cause: unknown) {
      setCurrentUserError(errorMessage(cause, "Failed to load account"));
    } finally {
      setIsLoadingCurrentUser(false);
    }
  }

  async function loadApiKeys(): Promise<void> {
    setIsLoadingApiKeys(true);
    setApiKeysError(null);
    try {
      const result = await AccountApi.listApiKeys();
      setApiKeys(result.apiKeys);
    } catch (cause: unknown) {
      setApiKeysError(errorMessage(cause, "Failed to load API keys"));
    } finally {
      setIsLoadingApiKeys(false);
    }
  }

  useEffect(() => {
    if (!enabled) return;
    void loadCurrentUser();
    void loadApiKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  async function revokeApiKey(apiKeyId: number, deviceId: string): Promise<void> {
    if (revokingApiKeyId !== null) return;
    setRevokingApiKeyId(apiKeyId);
    try {
      await AccountApi.revokeApiKey(apiKeyId);
      setApiKeys((prev) => prev.filter((key) => key.id !== apiKeyId));
      toast.success(`Revoked API key for ${deviceId}`);
    } catch (cause: unknown) {
      toast.error(`Failed to revoke API key: ${errorMessage(cause, "unknown error")}`);
    } finally {
      setRevokingApiKeyId(null);
    }
  }

  async function logout(): Promise<void> {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await AccountApi.logout();
      onSessionEnded();
    } catch (cause: unknown) {
      toast.error(`Failed to log out: ${errorMessage(cause, "unknown error")}`);
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function logoutAll(): Promise<void> {
    if (isLoggingOutEverywhere) return;
    setIsLoggingOutEverywhere(true);
    try {
      await AccountApi.logoutAll();
      onSessionEnded();
    } catch (cause: unknown) {
      toast.error(`Failed to log out all sessions: ${errorMessage(cause, "unknown error")}`);
    } finally {
      setIsLoggingOutEverywhere(false);
    }
  }

  async function saveBasicAuthPassword(password: string): Promise<boolean> {
    if (isSavingBasicAuthPassword) return false;
    setIsSavingBasicAuthPassword(true);
    try {
      await AccountApi.setBasicAuthPassword(password);
      await loadCurrentUser();
      toast.success("Basic authentication password saved");
      return true;
    } catch (cause: unknown) {
      toast.error(`Failed to save Basic authentication password: ${errorMessage(cause, "unknown error")}`);
      return false;
    } finally {
      setIsSavingBasicAuthPassword(false);
    }
  }

  async function removeBasicAuthPassword(): Promise<boolean> {
    if (isRemovingBasicAuthPassword) return false;
    setIsRemovingBasicAuthPassword(true);
    try {
      await AccountApi.removeBasicAuthPassword();
      await loadCurrentUser();
      toast.success("Basic authentication password removed");
      return true;
    } catch (cause: unknown) {
      toast.error(`Failed to remove Basic authentication password: ${errorMessage(cause, "unknown error")}`);
      return false;
    } finally {
      setIsRemovingBasicAuthPassword(false);
    }
  }

  return {
    currentUser,
    currentUserError,
    isLoadingCurrentUser,
    apiKeys,
    apiKeysError,
    isLoadingApiKeys,
    revokingApiKeyId,
    refreshApiKeys: loadApiKeys,
    revokeApiKey,
    isLoggingOut,
    isLoggingOutEverywhere,
    logout,
    logoutAll,
    isSavingBasicAuthPassword,
    isRemovingBasicAuthPassword,
    saveBasicAuthPassword,
    removeBasicAuthPassword,
  };
}
