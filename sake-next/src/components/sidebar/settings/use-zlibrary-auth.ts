"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ZLibraryAuthApi } from "@/lib/client/zlibrary-auth-api";
import { errorMessage } from "@/lib/client/api-client";

const ZLIBRARY_NAME_STORAGE_KEY = "zlibName";
const ZLIBRARY_TOKEN_LOGIN_LABEL = "Connected with remix credentials";

export function useZlibraryAuth() {
  const [zlibName, setZlibName] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setZlibName(localStorage.getItem(ZLIBRARY_NAME_STORAGE_KEY) ?? "");
  }, []);

  function storeName(name: string): void {
    localStorage.setItem(ZLIBRARY_NAME_STORAGE_KEY, name);
    setZlibName(name);
  }

  function clearName(): void {
    localStorage.removeItem(ZLIBRARY_NAME_STORAGE_KEY);
    setZlibName("");
  }

  async function loginWithPassword(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const result = await ZLibraryAuthApi.passwordLogin(email, password);
      storeName(result.user.name);
      return { ok: true };
    } catch (cause: unknown) {
      return { ok: false, error: errorMessage(cause, "Z-Library login failed") };
    }
  }

  async function loginWithToken(userId: string, userKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      await ZLibraryAuthApi.tokenLogin(userId, userKey);
      storeName(ZLIBRARY_TOKEN_LOGIN_LABEL);
      return { ok: true };
    } catch (cause: unknown) {
      return { ok: false, error: errorMessage(cause, "Z-Library login failed") };
    }
  }

  async function logout(): Promise<void> {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await ZLibraryAuthApi.logout();
      clearName();
      toast.success("Disconnected from Z-Library");
    } catch (cause: unknown) {
      toast.error(`Failed to log out of Z-Library: ${errorMessage(cause, "unknown error")}`);
    } finally {
      setIsLoggingOut(false);
    }
  }

  return { zlibName, isLoggingOut, loginWithPassword, loginWithToken, logout };
}
