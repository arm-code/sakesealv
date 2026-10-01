import { cookies } from "next/headers";
import { SAKE_SESSION_COOKIE_NAME } from "./constants";

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
