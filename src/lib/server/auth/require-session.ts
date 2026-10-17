import { cookies, headers } from "next/headers";
import { resolveRequestAuthUseCase } from "@/lib/server/application/composition";
import { errorResponse } from "@/lib/server/http/api";
import type { SessionAuthActor } from "@/lib/server/domain/auth";
import { SAKE_API_KEY_HEADER_NAME, SAKE_SESSION_COOKIE_NAME } from "./constants";

// Reemplaza el gate centralizado que SvelteKit resolvía una vez en
// hooks.server.ts (event.locals.auth): en Next.js App Router, proxy.ts
// (antes middleware.ts) no puede compartir objetos tipados con los Route
// Handlers — solo headers/cookies — así que cada ruta protegida resuelve su
// propia sesión llamando a este helper. Mismo resultado, sin la complejidad
// de serializar el actor a través de un header.
export async function requireSession(): Promise<{ actor: SessionAuthActor } | { response: Response }> {
  const sessionToken = (await cookies()).get(SAKE_SESSION_COOKIE_NAME)?.value ?? null;
  const apiKey = (await headers()).get(SAKE_API_KEY_HEADER_NAME)?.trim() || null;

  if (!sessionToken && !apiKey) {
    return { response: errorResponse("Authentication required", 401) };
  }

  const actor = await resolveRequestAuthUseCase.execute({ sessionToken, apiKey });
  if (!actor) {
    return { response: errorResponse("Authentication required", 401) };
  }
  // Las rutas que usan requireSession() no están en la allowlist de API key
  // (ver requireActor()): mismo 403 que el hooks.server.ts original.
  if (actor.type !== "session") {
    return { response: errorResponse("API key is not allowed for this route", 403) };
  }

  return { actor };
}
