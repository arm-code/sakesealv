import { cookies } from "next/headers";
import { reportDeviceVersionUseCase, resolveRequestAuthUseCase } from "@/lib/server/application/composition";
import { errorResponse } from "@/lib/server/http/api";
import type { AuthActor } from "@/lib/server/domain/auth";
import { logger, toLogError } from "@/lib/server/infrastructure/logging/logger";
import { SAKE_API_KEY_HEADER_NAME, SAKE_SESSION_COOKIE_NAME, SAKE_VERSION_HEADER_NAME } from "./constants";

// Variante de requireSession() para las rutas que el original permite tanto
// con sesión como con API key de dispositivo (isApiKeyAllowedRoute en
// requestAccess.ts). Es una allowlist POR RUTA: solo las rutas que llaman a
// este helper aceptan API key — el resto sigue con requireSession(), que
// rechaza cualquier actor que no sea "session" (equivalente al 403 "API key
// is not allowed for this route" del hooks.server.ts original).
//
// Igual que el hook original, si el actor es api_key y manda el header
// Sake-Version, se sincroniza la versión del plugin del device (best-effort,
// un fallo solo se loguea).
export async function requireActor(request: Request): Promise<{ actor: AuthActor } | { response: Response }> {
  const sessionToken = (await cookies()).get(SAKE_SESSION_COOKIE_NAME)?.value ?? null;
  const apiKey = request.headers.get(SAKE_API_KEY_HEADER_NAME)?.trim() || null;

  if (!sessionToken && !apiKey) {
    return { response: errorResponse("Authentication required", 401) };
  }

  const actor = await resolveRequestAuthUseCase.execute({ sessionToken, apiKey });
  if (!actor) {
    return { response: errorResponse("Authentication required", 401) };
  }

  if (actor.type === "api_key") {
    await syncDeviceVersionFromHeader(request, actor);
  }

  return { actor };
}

async function syncDeviceVersionFromHeader(request: Request, actor: Extract<AuthActor, { type: "api_key" }>): Promise<void> {
  const version = request.headers.get(SAKE_VERSION_HEADER_NAME)?.trim();
  if (!version) {
    return;
  }

  try {
    await reportDeviceVersionUseCase.execute({
      userId: actor.user.id,
      deviceId: actor.deviceId,
      version,
      skipIfUnchanged: true,
    });
  } catch (cause: unknown) {
    logger.error({ event: "device.version.header_sync.failed", error: toLogError(cause) }, "Failed to sync device version from request header");
  }
}
