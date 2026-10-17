import { cookies } from "next/headers";
import {
  SAKE_SESSION_COOKIE_NAME,
  ZLIBRARY_COOKIE_TTL_MS,
  ZLIBRARY_USER_ID_COOKIE_NAME,
  ZLIBRARY_USER_KEY_COOKIE_NAME,
} from "./constants";
import type { ZLibraryCredentials } from "@/lib/server/application/ports";

// Simplificado respecto al original: sin el chequeo de socket de plataforma
// (no aplica a Next.js Route Handlers) ni el parseo del header `forwarded`
// completo — `x-forwarded-proto` cubre el caso estándar de self-hosting
// detrás de un reverse proxy (ver README/docker-compose).
export function isSecureRequest(request: Request): boolean {
  const xForwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (xForwardedProto === "http" || xForwardedProto === "https") {
    return xForwardedProto === "https";
  }

  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export async function setSakeSessionCookie(request: Request, token: string, expiresAt: string): Promise<void> {
  const store = await cookies();
  store.set(SAKE_SESSION_COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    expires: new Date(expiresAt),
  });
}

export async function clearSakeSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SAKE_SESSION_COOKIE_NAME);
}

export async function setZLibraryCookies(request: Request, credentials: ZLibraryCredentials): Promise<void> {
  const store = await cookies();
  const options = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecureRequest(request),
    expires: new Date(Date.now() + ZLIBRARY_COOKIE_TTL_MS),
  };
  store.set(ZLIBRARY_USER_ID_COOKIE_NAME, credentials.userId, options);
  store.set(ZLIBRARY_USER_KEY_COOKIE_NAME, credentials.userKey, options);
}

export async function clearZLibraryCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ZLIBRARY_USER_ID_COOKIE_NAME);
  store.delete(ZLIBRARY_USER_KEY_COOKIE_NAME);
}

export async function getZLibraryCredentials(): Promise<ZLibraryCredentials | null> {
  const store = await cookies();
  const userId = store.get(ZLIBRARY_USER_ID_COOKIE_NAME)?.value;
  const userKey = store.get(ZLIBRARY_USER_KEY_COOKIE_NAME)?.value;
  return userId && userKey ? { userId, userKey } : null;
}
