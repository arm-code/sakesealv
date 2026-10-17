"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ZLIBRARY_AUTH_CLEARED_EVENT_NAME } from "@/lib/auth-response-signals";
import { ZLibraryAuthApi } from "@/lib/client/zlibrary-auth-api";
import { errorMessage } from "@/lib/client/api-client";

const ZLIBRARY_NAME_STORAGE_KEY = "zlibName";
const ZLIBRARY_TOKEN_LOGIN_LABEL = "Connected with remix credentials";

export function useZlibraryAuth() {
  const [zlibName, setZlibName] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const clearName = useCallback((): void => {
    localStorage.removeItem(ZLIBRARY_NAME_STORAGE_KEY);
    setZlibName("");
  }, []);

  useEffect(() => {
    setZlibName(localStorage.getItem(ZLIBRARY_NAME_STORAGE_KEY) ?? "");

    // Un provider de search (p.ej. Z-Library en /api/search) puede detectar que
    // la sesion de Z-Library ya no es valida (401/403 real del upstream) y
    // pedirle al servidor que limpie las cookies — ese 401/403 llega con el
    // header x-sake-clear-zlibrary-auth, que dispara este evento (ver
    // apply-auth-response-signals.ts). Reaccionamos limpiando el estado local
    // tambien, igual que hacia +layout.svelte en el original.
    function handleAuthCleared(): void {
      clearName();
    }
    window.addEventListener(ZLIBRARY_AUTH_CLEARED_EVENT_NAME, handleAuthCleared);
    return () => window.removeEventListener(ZLIBRARY_AUTH_CLEARED_EVENT_NAME, handleAuthCleared);
  }, [clearName]);

  function storeName(name: string): void {
    localStorage.setItem(ZLIBRARY_NAME_STORAGE_KEY, name);
    setZlibName(name);
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
